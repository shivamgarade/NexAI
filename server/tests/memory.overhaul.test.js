import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Memory } from '../src/models/Memory.js';
import { generateAccessToken } from '../src/utils/token.js';
import { memoryService } from '../src/services/memory.service.js';
import { vectorDbService } from '../src/services/vectorDb.service.js';

describe('Memory Engine Phase 1 Overhaul Tests', () => {
  let user = null;
  let token = '';

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    if (user) {
      await Memory.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }
    await disconnectDB();
  });

  beforeEach(async () => {
    vectorDbService.clearLocalStore();
    if (user) {
      await Memory.deleteMany({ userId: user._id });
      await User.deleteOne({ _id: user._id });
    }

    user = await User.create({
      email: `mem_phase1_${Date.now()}_${Math.random()}@memtest.nexai.test`,
      wallet: { creditsRemaining: 200, tier: 'free' },
    });
    token = generateAccessToken(user);
  });

  describe('1. Threshold-Based Retrieval & Recency Backfill Elimination', () => {
    it('should inject only identity/pinned memories when vector similarity falls below threshold', async () => {
      // Create an identity memory
      const idMem = await memoryService.createManualMemory(user._id, {
        fact: "User's name is Maya",
        category: 'identity',
      });

      // Create an unrelated preference memory
      const prefMem = await memoryService.createManualMemory(user._id, {
        fact: 'User codes exclusively in Rust and WebAssembly',
        category: 'preference',
      });

      // Query on completely unrelated topic with high threshold
      const retrieved = await memoryService.getRelevantMemories({
        userId: user._id,
        query: 'What is the recipe for chocolate chip cookies?',
        threshold: 0.85,
        limit: 5,
      });

      // Only the identity memory should be returned (no random recency backfill of the Rust memory)
      expect(retrieved.length).toBe(1);
      expect(retrieved[0]._id.toString()).toBe(idMem._id.toString());
      const facts = retrieved.map((m) => m.fact);
      expect(facts).not.toContain(prefMem.fact);
    }, 15000);

    it('should update telemetry lastUsedAt and increment useCount when memories are retrieved', async () => {
      const mem = await memoryService.createManualMemory(user._id, {
        fact: "User's preferred theme is Solarized Dark",
        pinned: true,
      });

      expect(mem.useCount).toBe(0);
      expect(mem.lastUsedAt).toBeNull();

      const retrieved = await memoryService.getRelevantMemories({
        userId: user._id,
        query: 'Hello',
      });

      expect(retrieved.length).toBeGreaterThan(0);

      // Verify DB update
      const updated = await Memory.findById(mem._id);
      expect(updated.useCount).toBe(1);
      expect(updated.lastUsedAt).toBeInstanceOf(Date);
    });
  });

  describe('2. Project Scoping & Isolation', () => {
    it('should retrieve project memories only when querying inside that project', async () => {
      const fakeProjA = '65f1a2b3c4d5e6f7a8b9c0d1';
      const fakeProjB = '65f1a2b3c4d5e6f7a8b9c0d2';

      // Global memory
      await memoryService.createManualMemory(user._id, {
        fact: "User's name is Liam",
        category: 'identity',
        scope: 'global',
      });

      // Project A memory
      await memoryService.createManualMemory(user._id, {
        fact: 'Project A uses PostgreSQL with Prisma ORM',
        category: 'project',
        pinned: true,
        scope: 'project',
        projectId: fakeProjA,
      });

      // Project B memory
      await memoryService.createManualMemory(user._id, {
        fact: 'Project B uses Cassandra with CQL',
        category: 'project',
        pinned: true,
        scope: 'project',
        projectId: fakeProjB,
      });

      // Query from Project A
      const retrievedProjA = await memoryService.getRelevantMemories({
        userId: user._id,
        query: 'Database structure',
        projectId: fakeProjA,
      });

      const factsA = retrievedProjA.map((m) => m.fact);
      expect(factsA).toContain("User's name is Liam"); // Global is visible
      expect(factsA).toContain('Project A uses PostgreSQL with Prisma ORM'); // Proj A is visible
      expect(factsA).not.toContain('Project B uses Cassandra with CQL'); // Proj B is isolated
    }, 15000);
  });

  describe('3. Safety Guards & Boundary Validation', () => {
    it('should skip memory extraction in temporary chats', async () => {
      const res = await memoryService.extractAndSaveMemories({
        userId: user._id,
        messageContent: 'My name is Bob and I am a secret agent',
        isTemporary: true,
      });

      expect(res.extractedCount).toBe(0);
      expect(res.skippedTemporary).toBe(true);

      const count = await Memory.countDocuments({ userId: user._id });
      expect(count).toBe(0);
    });

    it('should filter out sensitive credentials unless explicitly told to remember', async () => {
      // Sensitive data without explicit "remember that" directive
      const res1 = await memoryService.extractAndSaveMemories({
        userId: user._id,
        messageContent: 'My api_key is sk-proj-1234567890abcdef and password is SuperSecret!',
      });

      expect(res1.extractedCount).toBe(0);
      expect(res1.skippedSensitive).toBe(true);

      const count1 = await Memory.countDocuments({ userId: user._id });
      expect(count1).toBe(0);
    });
  });

  describe('4. Temporal Superseding & Schema Persistence via API', () => {
    it('POST /api/memories should create memory with scope, key, and validFrom', async () => {
      const res = await request(app)
        .post('/api/memories')
        .set('Authorization', `Bearer ${token}`)
        .send({
          fact: 'User lives in Seattle, Washington',
          category: 'identity',
          key: 'user.location',
          scope: 'global',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.fact).toBe('User lives in Seattle, Washington');
      expect(res.body.data.key).toBe('user.location');
      expect(res.body.data.scope).toBe('global');
      expect(res.body.data.validFrom).toBeDefined();
      expect(res.body.data.validTo).toBeNull();
      expect(res.body.data.supersededBy).toBeNull();
    });

    it('PATCH /api/memories/:id should update memory key, scope, and active flags', async () => {
      const mem = await memoryService.createManualMemory(user._id, {
        fact: 'User uses VS Code',
        category: 'preference',
      });

      const res = await request(app)
        .patch(`/api/memories/${mem._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          key: 'user.pref.editor',
          scope: 'global',
          pinned: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.key).toBe('user.pref.editor');
      expect(res.body.data.pinned).toBe(true);
    });
  });
});

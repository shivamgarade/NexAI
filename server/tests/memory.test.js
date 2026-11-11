import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Memory } from '../src/models/Memory.js';
import { Chat } from '../src/models/Chat.js';
import { Message } from '../src/models/Message.js';
import { generateAccessToken } from '../src/utils/token.js';
import { memoryService } from '../src/services/memory.service.js';
import * as geminiService from '../src/services/gemini.service.js';

describe('Long-Term Memory API & Workflow Tests', () => {
  let userA = null;
  let userB = null;
  let tokenA = '';
  let tokenB = '';

  beforeAll(async () => {
    await connectDB();
  });

  const cleanupUserRecords = async (userIds) => {
    if (!userIds || userIds.length === 0) return;
    await Memory.deleteMany({ userId: { $in: userIds } });
    const chats = await Chat.find({ userId: { $in: userIds } }).select('_id');
    const chatIds = chats.map((c) => c._id);
    await Message.deleteMany({ chatId: { $in: chatIds } });
    await Chat.deleteMany({ _id: { $in: chatIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  };

  afterAll(async () => {
    const testUsers = await User.find({ email: /@memtest\.nexai\.test$/ }).select('_id');
    await cleanupUserRecords(testUsers.map((u) => u._id));
    await disconnectDB();
  });

  beforeEach(async () => {
    if (userA || userB) {
      const ids = [userA?._id, userB?._id].filter(Boolean);
      await cleanupUserRecords(ids);
    }

    userA = await User.create({
      email: `user_a_${Date.now()}_${Math.random()}@memtest.nexai.test`,
      wallet: { creditsRemaining: 100, tier: 'free', totalTokensConsumed: 0 },
    });

    userB = await User.create({
      email: `user_b_${Date.now()}_${Math.random()}@memtest.nexai.test`,
      wallet: { creditsRemaining: 100, tier: 'free', totalTokensConsumed: 0 },
    });

    tokenA = generateAccessToken(userA);
    tokenB = generateAccessToken(userB);
  });

  describe('Authentication & User Isolation', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/memories');
      expect(res.status).toBe(401);
    });

    it('should isolate memories strictly by userId', async () => {
      await Memory.create({
        userId: userA._id,
        fact: "User's name is Alice",
        category: 'identity',
      });

      await Memory.create({
        userId: userB._id,
        fact: "User's name is Bob",
        category: 'identity',
      });

      const resA = await request(app)
        .get('/api/memories')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(resA.status).toBe(200);
      expect(resA.body.data).toHaveLength(1);
      expect(resA.body.data[0].fact).toBe("User's name is Alice");

      const resB = await request(app)
        .get('/api/memories')
        .set('Authorization', `Bearer ${tokenB}`);

      expect(resB.status).toBe(200);
      expect(resB.body.data).toHaveLength(1);
      expect(resB.body.data[0].fact).toBe("User's name is Bob");
    });
  });

  describe('Memory CRUD Operations', () => {
    it('POST /api/memories should manually create a memory', async () => {
      const res = await request(app)
        .post('/api/memories')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          fact: 'User prefers dark mode and concise code',
          category: 'preference',
          pinned: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.fact).toBe('User prefers dark mode and concise code');
      expect(res.body.data.category).toBe('preference');
      expect(res.body.data.pinned).toBe(true);

      const inDb = await Memory.findOne({ userId: userA._id });
      expect(inDb).not.toBeNull();
    });

    it('PATCH /api/memories/:id should update a memory for owner', async () => {
      const mem = await Memory.create({
        userId: userA._id,
        fact: 'User likes Node.js',
        category: 'preference',
      });

      const res = await request(app)
        .patch(`/api/memories/${mem._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          fact: 'User prefers TypeScript and Go',
          pinned: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.data.fact).toBe('User prefers TypeScript and Go');
      expect(res.body.data.pinned).toBe(true);
    });

    it('PATCH /api/memories/:id should return 404 when updating another user memory', async () => {
      const memA = await Memory.create({
        userId: userA._id,
        fact: "User's secret",
      });

      const res = await request(app)
        .patch(`/api/memories/${memA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ fact: 'Hacked' });

      expect(res.status).toBe(404);
    });

    it('DELETE /api/memories/:id should remove memory for owner', async () => {
      const mem = await Memory.create({
        userId: userA._id,
        fact: 'Temporary note',
      });

      const res = await request(app)
        .delete(`/api/memories/${mem._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);

      const check = await Memory.findById(mem._id);
      expect(check).toBeNull();
    });

    it('DELETE /api/memories should clear all memories for the user', async () => {
      await Memory.create([
        { userId: userA._id, fact: 'Fact 1' },
        { userId: userA._id, fact: 'Fact 2' },
      ]);

      const res = await request(app)
        .delete('/api/memories')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deletedCount).toBe(2);

      const remaining = await Memory.find({ userId: userA._id });
      expect(remaining).toHaveLength(0);
    });
  });

  describe('Memory Extraction and Cross-Chat Persistence', () => {
    it('extractAndSaveMemories should extract identity from "My name is ..."', async () => {
      const extraction = await memoryService.extractAndSaveMemories({
        userId: userA._id,
        messageContent: 'Hello NexAI! My name is Rewan and I am a software engineer.',
        isSimulation: true,
      });

      expect(extraction.extractedCount).toBeGreaterThan(0);

      const memories = await Memory.find({ userId: userA._id });
      const nameMem = memories.find((m) => m.fact.includes('Rewan'));
      expect(nameMem).toBeDefined();
      expect(nameMem.category).toBe('identity');
    });

    it('getRelevantMemories should return priority memories for user', async () => {
      await Memory.create({
        userId: userA._id,
        fact: "User's name is Sarah",
        category: 'identity',
        active: true,
      });

      const retrieved = await memoryService.getRelevantMemories({
        userId: userA._id,
        query: 'What is my name?',
      });

      expect(retrieved.length).toBeGreaterThan(0);
      expect(retrieved[0].fact).toBe("User's name is Sarah");
    });

    it('should respect aiMemoryEnabled: false and skip automatic memory extraction', async () => {
      userA.settings = {
        personalization: {
          aiMemoryEnabled: false,
          customInstructions: 'Never extract memories',
        },
      };
      await userA.save();

      const result = await memoryService.extractAndSaveMemories({
        userId: userA._id,
        messageContent: 'My name is John Doe and I like Python',
        isSimulation: false,
      });

      expect(result.extractedCount).toBe(0);
      expect(result.disabled).toBe(true);

      const memCount = await Memory.countDocuments({ userId: userA._id });
      expect(memCount).toBe(0);
    });

    it('POST /api/memories/consolidate should return status 200 with result message', async () => {
      vi.spyOn(geminiService, 'generateContent').mockResolvedValue({
        text: JSON.stringify({
          consolidated: [
            { fact: 'User works with React and Next.js', category: 'preference', pinned: false },
          ],
        }),
        totalTokens: 60,
      });

      await Memory.create([
        { userId: userA._id, fact: 'User works with React', category: 'preference' },
        { userId: userA._id, fact: 'User works with Next.js', category: 'preference' },
      ]);

      const res = await request(app)
        .post('/api/memories/consolidate')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('PATCH /api/users/me/settings should update personalization settings', async () => {
      const res = await request(app)
        .patch('/api/users/me/settings')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          personalization: {
            customInstructions: 'Always answer in TypeScript and concise bullet points.',
            responseTone: 'concise',
            aiMemoryEnabled: true,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.settings.personalization.customInstructions).toBe(
        'Always answer in TypeScript and concise bullet points.',
      );
      expect(res.body.data.user.settings.personalization.responseTone).toBe('concise');
      expect(res.body.data.user.settings.personalization.aiMemoryEnabled).toBe(true);
    });
  });
});

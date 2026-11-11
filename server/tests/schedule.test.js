import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Schedule } from '../src/models/Schedule.js';
import { ConnectedApp } from '../src/models/ConnectedApp.js';
import { generateAccessToken } from '../src/utils/token.js';
import * as geminiService from '../src/services/gemini.service.js';

describe('Automations Hub & Schedules API Integration Tests', () => {
  let user;
  let token;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await Schedule.deleteMany({});
    await ConnectedApp.deleteMany({});
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({ email: 'autouser@example.com' });
    await Schedule.deleteMany({});
    await ConnectedApp.deleteMany({});

    user = await User.create({
      email: 'autouser@example.com',
      passwordHash: 'hashed_password',
      wallet: { creditsRemaining: 50, totalTokensConsumed: 0 },
      settings: {
        toolExecutionMode: 'auto',
      },
    });
    token = generateAccessToken(user);
  });

  describe('Schedules CRUD & Run-Now Execution', () => {
    it('should reject unauthenticated schedule requests with 401', async () => {
      const res = await request(app).get('/api/schedules');
      expect(res.status).toBe(401);
    });

    it('should create a new automated schedule', async () => {
      const res = await request(app)
        .post('/api/schedules')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Daily Tech Briefing',
          instructions: 'Summarize top 3 breakthroughs in AI today.',
          frequency: 'daily',
          runTime: '09:00',
          deliveryTarget: 'chat',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('Daily Tech Briefing');
      expect(res.body.data.frequency).toBe('daily');
      expect(res.body.data.isActive).toBe(true);
    });

    it('should list schedules belonging to the authenticated user', async () => {
      await Schedule.create({
        userId: user._id,
        title: 'Weekly Sprint Check',
        instructions: 'Analyze open issues',
        frequency: 'weekly',
        weeklyDays: [1, 3, 5],
        runTime: '10:00',
      });

      const res = await request(app)
        .get('/api/schedules')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].title).toBe('Weekly Sprint Check');
    });

    it('should toggle schedule active status', async () => {
      const schedule = await Schedule.create({
        userId: user._id,
        title: 'Morning Monitor',
        instructions: 'Check system status',
        frequency: 'daily',
        runTime: '08:00',
        isActive: true,
      });

      const res = await request(app)
        .patch(`/api/schedules/${schedule._id}/toggle`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
    });

    it('should execute a schedule on demand with Run Now and deduct credits', async () => {
      vi.spyOn(geminiService, 'generateContent').mockResolvedValue({
        text: 'Executive Summary:\n- Task completed.\n- All systems nominal.',
        totalTokens: 120,
      });

      const schedule = await Schedule.create({
        userId: user._id,
        title: 'Live Viva Test Schedule',
        instructions: 'Generate a quick 3-bullet test executive summary.',
        frequency: 'daily',
        runTime: '09:00',
        deliveryTarget: 'chat',
      });

      const res = await request(app)
        .post(`/api/schedules/${schedule._id}/run-now`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.resultText).toBeDefined();

      const updated = await Schedule.findById(schedule._id);
      expect(updated.lastRunStatus).toBe('success');
      expect(updated.totalRuns).toBe(1);
      expect(updated.lastRunAt).toBeDefined();

      const updatedUser = await User.findById(user._id);
      expect(updatedUser.wallet.creditsRemaining).toBeLessThan(50);
    }, 20000);

    it('should delete a schedule', async () => {
      const schedule = await Schedule.create({
        userId: user._id,
        title: 'To Be Deleted',
        instructions: 'Temp task',
        frequency: 'daily',
        runTime: '09:00',
      });

      const res = await request(app)
        .delete(`/api/schedules/${schedule._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const exists = await Schedule.findById(schedule._id);
      expect(exists).toBeNull();
    });
  });

  describe('Connected Apps API', () => {
    it('should initialize and return system connected apps', async () => {
      const res = await request(app)
        .get('/api/connected-apps')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(4);
      const appSlugs = res.body.data.map((a) => a.appSlug);
      expect(appSlugs).toContain('web-search');
      expect(appSlugs).toContain('github');
    });

    it('should update connection status and credentials for an app', async () => {
      const res = await request(app)
        .patch('/api/connected-apps/github')
        .set('Authorization', `Bearer ${token}`)
        .send({
          isConnected: true,
          accountName: 'my-org',
          webhookUrl: 'https://webhook.site/test',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.isConnected).toBe(true);
      expect(res.body.data.credentials.accountName).toBe('my-org');
    });
  });
});

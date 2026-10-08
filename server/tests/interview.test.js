import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { InterviewSession } from '../src/models/InterviewSession.js';
import { LibraryItem } from '../src/models/LibraryItem.js';
import { UsageLog } from '../src/models/UsageLog.js';
import { generateAccessToken } from '../src/utils/token.js';
import * as interviewAgent from '../src/agents/interview.agent.js';
import * as geminiService from '../src/services/gemini.service.js';
import * as edgeTtsService from '../src/services/edgeTts.service.js';

describe('AI Mock Interview Platform Integration Tests (Step 9)', () => {
  let userA = null;
  let userB = null;
  let tokenA = '';
  let tokenB = '';

  beforeAll(async () => {
    await connectDB();
  });

  const cleanupRecords = async (userIds) => {
    if (!userIds || userIds.length === 0) return;
    await InterviewSession.deleteMany({ userId: { $in: userIds } });
    await LibraryItem.deleteMany({ userId: { $in: userIds } });
    await UsageLog.deleteMany({ userId: { $in: userIds } });
    await User.deleteMany({ _id: { $in: userIds } });
  };

  afterAll(async () => {
    const testUsers = await User.find({ email: /@interviewtest\.nexai\.test$/ }).select('_id');
    await cleanupRecords(testUsers.map((u) => u._id));
    await disconnectDB();
  });

  beforeEach(async () => {
    if (userA || userB) {
      const ids = [userA?._id, userB?._id].filter(Boolean);
      await cleanupRecords(ids);
    }

    userA = await User.create({
      email: `user_a_${Date.now()}_${Math.random()}@interviewtest.nexai.test`,
      wallet: { creditsRemaining: 100, tier: 'free', totalTokensConsumed: 0 },
    });

    userB = await User.create({
      email: `user_b_${Date.now()}_${Math.random()}@interviewtest.nexai.test`,
      wallet: { creditsRemaining: 100, tier: 'free', totalTokensConsumed: 0 },
    });

    tokenA = generateAccessToken(userA);
    tokenB = generateAccessToken(userB);

    vi.restoreAllMocks();
  });

  describe('Authentication & User Isolation', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/interview');
      expect(res.status).toBe(401);
    });

    it('should isolate interview sessions strictly by userId', async () => {
      const sessionB = await InterviewSession.create({
        userId: userB._id,
        role: 'Frontend React',
        difficulty: 'mid',
        topic: 'State Management & Virtual DOM',
        status: 'in_progress',
        messages: [{ role: 'assistant', content: 'Explain reconciliation', tokensUsed: 50 }],
      });

      // User A attempts to access User B's session
      const getRes = await request(app)
        .get(`/api/interview/${sessionB._id}`)
        .set('Authorization', `Bearer ${tokenA}`);
      expect(getRes.status).toBe(404);

      // User A lists interviews - should not see User B's session
      const listRes = await request(app)
        .get('/api/interview')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(listRes.status).toBe(200);
      expect(listRes.body.interviews.length).toBe(0);

      // User B can access their own session
      const userBRes = await request(app)
        .get(`/api/interview/${sessionB._id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      expect(userBRes.status).toBe(200);
      expect(userBRes.body.interview.role).toBe('Frontend React');
    });
  });

  describe('POST /api/interview/start', () => {
    it('should reject invalid input payload with 400', async () => {
      const res = await request(app)
        .post('/api/interview/start')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ role: 'A' }); // missing difficulty, topic, short role

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should block session start with 402 when user has 0 credits', async () => {
      userA.wallet.creditsRemaining = 0;
      await userA.save();

      const res = await request(app)
        .post('/api/interview/start')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          role: 'Full-Stack Engineer',
          difficulty: 'senior',
          topic: 'Microservices & Distributed Caching',
        });

      expect(res.status).toBe(402);
      expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
    });

    it('should initialize interview session, call agent for greeting, and meter tokens', async () => {
      vi.spyOn(interviewAgent, 'generateInterviewGreeting').mockResolvedValue({
        text: 'Welcome! Let us start by discussing how you would architect a real-time event streaming pipeline.',
        tokensUsed: 120, // 120 tokens = 2 credits
      });

      const res = await request(app)
        .post('/api/interview/start')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          role: 'Full-Stack Engineer',
          difficulty: 'senior',
          topic: 'Event-Driven Architectures',
        });

      expect(res.status).toBe(201);
      expect(res.body.session).toBeDefined();
      expect(res.body.session.status).toBe('in_progress');
      expect(res.body.session.role).toBe('Full-Stack Engineer');
      expect(res.body.session.difficulty).toBe('senior');
      expect(res.body.session.topic).toBe('Event-Driven Architectures');
      expect(res.body.session.messages.length).toBe(1);
      expect(res.body.session.messages[0].role).toBe('assistant');
      expect(res.body.session.messages[0].content).toContain('architect a real-time event streaming');

      expect(res.body.creditsDeducted).toBe(2);
      expect(res.body.creditsRemaining).toBe(98);

      // Verify DB persistence
      const savedSession = await InterviewSession.findById(res.body.session._id);
      expect(savedSession).toBeTruthy();
      expect(savedSession.totalTokensUsed).toBe(120);

      // Verify UsageLog
      const log = await UsageLog.findOne({ userId: userA._id, feature: 'interview' });
      expect(log).toBeTruthy();
      expect(log.tokensUsed).toBe(120);
      expect(log.creditsDeducted).toBe(2);
    });
  });

  describe('POST /api/interview/:id/respond (SSE Streaming & Metering)', () => {
    it('should block response with 402 when credits are 0', async () => {
      userA.wallet.creditsRemaining = 0;
      await userA.save();

      const session = await InterviewSession.create({
        userId: userA._id,
        role: 'Node.js Backend',
        difficulty: 'mid',
        topic: 'Express & Event Loop',
        status: 'in_progress',
        messages: [{ role: 'assistant', content: 'How does libuv threadpool work?', tokensUsed: 50 }],
      });

      const res = await request(app)
        .post(`/api/interview/${session._id}/respond`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'It handles asynchronous I/O and crypto tasks.' });

      expect(res.status).toBe(402);
      expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
    });

    it('should stream interviewer critique & question over SSE and deduct credits', async () => {
      const session = await InterviewSession.create({
        userId: userA._id,
        role: 'Node.js Backend',
        difficulty: 'mid',
        topic: 'Express & Event Loop',
        status: 'in_progress',
        messages: [{ role: 'assistant', content: 'How does libuv threadpool work?', tokensUsed: 50 }],
      });

      const mockStreamTurn = async function* () {
        yield { text: 'Good start. ' };
        yield { text: 'How do you tune UV_THREADPOOL_SIZE for high throughput?' };
        yield { usageMetadata: { totalTokenCount: 180 } }; // 180 tokens = 2 credits
      };
      vi.spyOn(interviewAgent, 'streamInterviewTurn').mockImplementation(mockStreamTurn);

      const res = await request(app)
        .post(`/api/interview/${session._id}/respond`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ content: 'It offloads CPU-bound operations such as pbkdf2 and fs operations.' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');

      const textOutput = res.text;
      expect(textOutput).toContain('event: token');
      expect(textOutput).toContain('Good start.');
      expect(textOutput).toContain('UV_THREADPOOL_SIZE');
      expect(textOutput).toContain('event: done');
      expect(textOutput).toContain('"tokensUsed":180');
      expect(textOutput).toContain('"creditsDeducted":2');

      // Verify session updated in DB
      const updatedSession = await InterviewSession.findById(session._id);
      expect(updatedSession.messages.length).toBe(3);
      expect(updatedSession.messages[1].role).toBe('user');
      expect(updatedSession.messages[2].role).toBe('assistant');
      expect(updatedSession.messages[2].content).toContain('Good start. How do you tune UV_THREADPOOL_SIZE');
    });
  });

  describe('POST /api/interview/:id/conclude (Scorecard & Auto-Archival)', () => {
    it('should generate scorecard, deduct credits, and auto-archive to Library', async () => {
      const session = await InterviewSession.create({
        userId: userA._id,
        role: 'MSBTE Capstone Viva',
        difficulty: 'senior',
        topic: 'AI Developer Assistant Architecture',
        status: 'in_progress',
        messages: [
          { role: 'assistant', content: 'Explain your authentication and token verification flow.', tokensUsed: 40 },
          { role: 'user', content: 'We use JWT access tokens with httpOnly refresh cookies and HMAC-SHA256 signature verification.', tokensUsed: 0 },
          { role: 'assistant', content: 'What happens if MongoDB goes offline during a transaction?', tokensUsed: 40 },
          { role: 'user', content: 'We use two-phase commits, retry queues, and explicit error handlers to rollback state.', tokensUsed: 0 },
        ],
        totalTokensUsed: 80,
      });

      const mockScorecard = {
        overallScore: 92,
        rating: 'Strong Hire',
        categories: {
          technicalAccuracy: 95,
          problemSolving: 90,
          communication: 92,
          systemDesign: 90,
        },
        strengths: [
          'Crystal clear explanation of JWT security semantics',
          'Solid understanding of database transaction rollbacks',
        ],
        improvements: [
          'Could elaborate on distributed consensus protocols under network partitions',
        ],
        summary: 'Outstanding technical performance demonstrating deep knowledge of full-stack engineering and system defense.',
        recommendedTopics: ['Raft Consensus', 'Zero Trust Architecture'],
      };

      vi.spyOn(interviewAgent, 'generateInterviewScorecard').mockResolvedValue({
        scorecard: mockScorecard,
        tokensUsed: 250, // 250 tokens = 3 credits
      });

      const res = await request(app)
        .post(`/api/interview/${session._id}/conclude`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.session.status).toBe('completed');
      expect(res.body.session.scorecard.overallScore).toBe(92);
      expect(res.body.session.scorecard.rating).toBe('Strong Hire');
      expect(res.body.creditsDeducted).toBe(3);
      expect(res.body.creditsRemaining).toBe(97);

      // Verify auto-archival into LibraryItem
      expect(res.body.libraryItem).toBeDefined();
      expect(res.body.libraryItem.type).toBe('interview');
      expect(res.body.libraryItem.title).toBe('Mock Interview: MSBTE Capstone Viva (AI Developer Assistant Architecture)');
      expect(res.body.libraryItem.role).toBe('MSBTE Capstone Viva');
      expect(res.body.libraryItem.difficulty).toBe('senior');
      expect(res.body.libraryItem.scorecard.overallScore).toBe(92);

      const archivedInDb = await LibraryItem.findById(res.body.libraryItem._id);
      expect(archivedInDb).toBeTruthy();
      expect(archivedInDb.userId.toString()).toBe(userA._id.toString());
      expect(archivedInDb.transcript.length).toBe(4);
    });
  });

  describe('GET /api/interview & GET /api/interview/:id', () => {
    it('should list all sessions for the user and retrieve a single session', async () => {
      const session1 = await InterviewSession.create({
        userId: userA._id,
        role: 'Frontend React',
        difficulty: 'mid',
        topic: 'React 19 & Suspense',
        status: 'completed',
        messages: [{ role: 'assistant', content: 'Explain Actions', tokensUsed: 30 }],
      });

      const session2 = await InterviewSession.create({
        userId: userA._id,
        role: 'Full-Stack Engineer',
        difficulty: 'junior',
        topic: 'REST API Design',
        status: 'in_progress',
        messages: [{ role: 'assistant', content: 'What is idempotency?', tokensUsed: 30 }],
      });

      const listRes = await request(app)
        .get('/api/interview')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.interviews.length).toBe(2);

      const singleRes = await request(app)
        .get(`/api/interview/${session1._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(singleRes.status).toBe(200);
      expect(singleRes.body.interview.role).toBe('Frontend React');
      expect(singleRes.body.interview.topic).toBe('React 19 & Suspense');

      const singleRes2 = await request(app)
        .get(`/api/interview/${session2._id}`)
        .set('Authorization', `Bearer ${tokenA}`);

      expect(singleRes2.status).toBe(200);
      expect(singleRes2.body.interview.role).toBe('Full-Stack Engineer');
    });
  });

  describe('Demo Simulation Mode (No Credits Required)', () => {
    it('should allow user with 0 credits to run full interview lifecycle without AI or token charges', async () => {
      // Set user credits to 0
      userA.wallet.creditsRemaining = 0;
      await userA.save();

      // 1. Start simulation
      const startRes = await request(app)
        .post('/api/interview/start')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          role: 'Full-Stack Engineer',
          difficulty: 'mid',
          topic: 'MERN Stack Architecture',
          isSimulation: true,
        });

      expect(startRes.status).toBe(201);
      expect(startRes.body.session.isSimulation).toBe(true);
      expect(startRes.body.creditsDeducted).toBe(0);
      expect(startRes.body.creditsRemaining).toBe(0);
      expect(startRes.body.session.messages[0].content).toContain('simulated technical screening');

      const sessionId = startRes.body.session._id;

      // 2. Respond to simulation question over SSE
      const respondRes = await request(app)
        .post(`/api/interview/${sessionId}/respond`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-simulation', 'true')
        .send({
          content: 'I isolate service boundaries into domain modules and use structured error handling.',
          isSimulation: true,
        });

      expect(respondRes.status).toBe(200);
      expect(respondRes.headers['content-type']).toContain('text/event-stream');
      expect(respondRes.text).toContain('event: token');
      expect(respondRes.text).toContain('event: done');
      expect(respondRes.text).toContain('"creditsDeducted":0');

      // 3. Conclude simulation and generate scorecard
      const concludeRes = await request(app)
        .post(`/api/interview/${sessionId}/conclude`)
        .set('Authorization', `Bearer ${tokenA}`)
        .set('x-simulation', 'true')
        .send({ isSimulation: true });

      expect(concludeRes.status).toBe(200);
      expect(concludeRes.body.session.status).toBe('completed');
      expect(concludeRes.body.session.scorecard).toBeDefined();
      expect(concludeRes.body.session.scorecard.overallScore).toBeGreaterThanOrEqual(70);
      expect(concludeRes.body.creditsDeducted).toBe(0);
      expect(concludeRes.body.creditsRemaining).toBe(0);

      // Verify auto-archival into Library with simulation markers
      expect(concludeRes.body.libraryItem).toBeDefined();
      expect(concludeRes.body.libraryItem.type).toBe('interview');
      expect(concludeRes.body.libraryItem.title).toContain('[Simulation]');
      expect(concludeRes.body.libraryItem.tags).toContain('simulation');

      // Verify user credits remain 0 (no unauthorized deductions or negatives)
      const freshUser = await User.findById(userA._id);
      expect(freshUser.wallet.creditsRemaining).toBe(0);
    });
  });

  describe('POST /api/interview/tts (Gemini 3.8 Flash-Lite TTS & Dual-Mode Voice)', () => {
    it('should reject unauthenticated requests with 401', async () => {
      const res = await request(app).post('/api/interview/tts').send({ text: 'Hello' });
      expect(res.status).toBe(401);
    });

    it('should reject empty or missing text with 400', async () => {
      const res = await request(app)
        .post('/api/interview/tts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ text: '   ' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 204 in simulation mode without calling Gemini or deducting credits', async () => {
      const generateSpeechSpy = vi.spyOn(geminiService, 'generateSpeech');

      const res = await request(app)
        .post('/api/interview/tts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          text: 'This is a simulation test question.',
          isSimulation: true,
        });

      expect(res.status).toBe(204);
      expect(generateSpeechSpy).not.toHaveBeenCalled();

      const freshUser = await User.findById(userA._id);
      expect(freshUser.wallet.creditsRemaining).toBe(100);

      const usageLogs = await UsageLog.find({ userId: userA._id, model: 'tts' });
      expect(usageLogs).toHaveLength(0);
    });

    it('should synthesize audio via Edge Neural TTS by default, return audio/mpeg, and consume 0 credits', async () => {
      const fakeMp3Buffer = Buffer.from('ID3....FAKE_MP3_DATA....');
      const edgeSpy = vi.spyOn(edgeTtsService, 'synthesizeEdgeSpeech').mockResolvedValueOnce({
        audioBuffer: fakeMp3Buffer,
        mimeType: 'audio/mpeg',
        voice: 'en-US-ChristopherNeural',
      });

      const res = await request(app)
        .post('/api/interview/tts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          text: 'Welcome to your live technical assessment. Please introduce yourself.',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/mpeg');
      expect(res.headers['x-engine']).toBe('edge');
      expect(res.headers['x-voice']).toBe('en-US-ChristopherNeural');
      expect(res.headers['x-credits-remaining']).toBe('100');
      expect(res.headers['x-credits-deducted']).toBe('0');
      expect(res.headers['x-tokens-used']).toBe('0');
      expect(res.body).toEqual(fakeMp3Buffer);
      expect(edgeSpy).toHaveBeenCalled();

      // Ensure no credits deducted from user wallet
      const freshUser = await User.findById(userA._id);
      expect(freshUser.wallet.creditsRemaining).toBe(100);

      // Ensure no UsageLog recorded for 0-credit Edge TTS
      const usageLogs = await UsageLog.find({ userId: userA._id, model: 'tts' });
      expect(usageLogs).toHaveLength(0);
    });

    it('should allow Edge Neural TTS even when credits are 0 in strict mode', async () => {
      await User.findByIdAndUpdate(userA._id, { 'wallet.creditsRemaining': 0 });
      const fakeMp3Buffer = Buffer.from('ID3....ZERO_CREDIT_EDGE_TTS....');
      vi.spyOn(edgeTtsService, 'synthesizeEdgeSpeech').mockResolvedValueOnce({
        audioBuffer: fakeMp3Buffer,
        mimeType: 'audio/mpeg',
        voice: 'en-US-ChristopherNeural',
      });

      const res = await request(app)
        .post('/api/interview/tts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          text: 'Free Edge voice synthesis during viva.',
          engine: 'edge',
        });

      expect(res.status).toBe(200);
      expect(res.headers['x-engine']).toBe('edge');
      expect(res.headers['x-credits-remaining']).toBe('0');
      expect(res.headers['x-credits-deducted']).toBe('0');

      // Reset balance for remaining tests
      await User.findByIdAndUpdate(userA._id, { 'wallet.creditsRemaining': 100 });
    });

    it('should synthesize audio via Gemini TTS, return audio/wav, deduct credits, and log usage when engine is gemini', async () => {
      const fakeWavBuffer = Buffer.from('RIFF....WAVEfmt ....data....');
      vi.spyOn(geminiService, 'generateSpeech').mockResolvedValueOnce({
        audioBuffer: fakeWavBuffer,
        mimeType: 'audio/wav',
        totalTokens: 150, // 150 tokens = ceil(150 / 100) = 2 credits
        usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 100, totalTokenCount: 150 },
      });

      const res = await request(app)
        .post('/api/interview/tts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          text: 'Welcome to your live technical assessment. Please introduce yourself.',
          engine: 'gemini',
          voice: 'Kore',
          style: 'professional and engaging',
        });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(res.headers['x-engine']).toBe('gemini');
      expect(res.headers['x-credits-remaining']).toBe('98');
      expect(res.headers['x-credits-deducted']).toBe('2');
      expect(res.headers['x-tokens-used']).toBe('150');
      expect(res.body).toEqual(fakeWavBuffer);

      // Verify wallet deduction in MongoDB
      const freshUser = await User.findById(userA._id);
      expect(freshUser.wallet.creditsRemaining).toBe(98);
      expect(freshUser.wallet.totalTokensConsumed).toBe(150);

      // Verify UsageLog audit entry
      const log = await UsageLog.findOne({ userId: userA._id, model: 'tts' });
      expect(log).toBeDefined();
      expect(log.feature).toBe('interview');
      expect(log.tokensUsed).toBe(150);
      expect(log.creditsDeducted).toBe(2);
    });

    it('should block Gemini TTS with 402 when credits are 0 in strict mode', async () => {
      await User.findByIdAndUpdate(userA._id, { 'wallet.creditsRemaining': 0 });

      const res = await request(app)
        .post('/api/interview/tts')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          text: 'This should be blocked due to lack of credits.',
          engine: 'gemini',
          isSimulation: false,
        });

      expect(res.status).toBe(402);
      expect(res.body.error.code).toBe('INSUFFICIENT_CREDITS');
    });
  });
});


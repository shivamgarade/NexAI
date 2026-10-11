import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { Skill } from '../src/models/Skill.js';
import { ensureSystemSkills } from '../src/services/skill.service.js';
import { buildGeminiToolsConfig, executeAgentTool } from '../src/services/tools.service.js';
import { generateAccessToken } from '../src/utils/token.js';

describe('Skills API & Agentic Tools Integration Tests', () => {
  let user;
  let token;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await Skill.deleteMany({ userId: user?._id });
    if (user?._id) await User.deleteOne({ _id: user._id });
    await disconnectDB();
  });

  beforeEach(async () => {
    user = await User.create({
      email: `agent_${Date.now()}_${Math.random()}@skilltest.nexai.test`,
      wallet: { creditsRemaining: 500, tier: 'free', totalTokensConsumed: 0 },
    });

    token = generateAccessToken(user);
    await ensureSystemSkills();
  });

  describe('System Skills Seeder', () => {
    it('should seed the 4 default system skills with proper tools and categories', async () => {
      const skills = await Skill.find({ isSystem: true });
      expect(skills.length).toBeGreaterThanOrEqual(4);

      const researcher = skills.find((s) => s.slug === 'web-deep-researcher');
      expect(researcher).toBeDefined();
      expect(researcher.category).toBe('Research');
      expect(researcher.tools).toContain('web_search');
      expect(researcher.tools).toContain('fetch_url');

      const architect = skills.find((s) => s.slug === 'code-architect-debugger');
      expect(architect).toBeDefined();
      expect(architect.category).toBe('Coding');
      expect(architect.tools).toContain('code_execution');

      const analyst = skills.find((s) => s.slug === 'project-document-analyst');
      expect(analyst).toBeDefined();
      expect(analyst.category).toBe('Analysis');
      expect(analyst.tools).toContain('workspace_search');

      const writer = skills.find((s) => s.slug === 'executive-brief-writer');
      expect(writer).toBeDefined();
      expect(writer.category).toBe('Writing');
      expect(writer.tools).toContain('web_search');
    });
  });

  describe('GET /api/skills', () => {
    it('should require authentication', async () => {
      const res = await request(app).get('/api/skills');
      expect(res.status).toBe(401);
    });

    it('should return system skills and user custom skills', async () => {
      await Skill.create({
        userId: user._id,
        title: 'Custom SQL Optimizer',
        instructions: 'Optimize SQL queries for BigQuery',
        tools: ['code_execution'],
        category: 'Coding',
      });

      const res = await request(app)
        .get('/api/skills')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(5); // At least 4 system + 1 custom
    });

    it('should filter skills by category', async () => {
      const res = await request(app)
        .get('/api/skills?category=Coding')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((s) => s.category === 'Coding')).toBe(true);
      expect(res.body.data.some((s) => s.slug === 'code-architect-debugger')).toBe(true);
    });

    it('should filter skills by tool', async () => {
      const res = await request(app)
        .get('/api/skills?tool=web_search')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.every((s) => s.tools.includes('web_search'))).toBe(true);
    });
  });

  describe('POST /api/skills (CRUD)', () => {
    it('should create a new skill and auto-extract variables', async () => {
      const newSkillData = {
        title: 'PR Reviewer Skill',
        description: 'Reviews pull requests with security checklist',
        instructions: 'Review pull request {{ pr_url }} for project {{ repo_name }}',
        tools: ['web_search', 'code_execution'],
        category: 'Coding',
        tags: ['git', 'security'],
      };

      const res = await request(app)
        .post('/api/skills')
        .set('Authorization', `Bearer ${token}`)
        .send(newSkillData);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('PR Reviewer Skill');
      expect(res.body.data.variables).toEqual(['pr_url', 'repo_name']);
      expect(res.body.data.tools).toEqual(['web_search', 'code_execution']);
      expect(res.body.data.isSystem).toBe(false);
    });

    it('should update a user skill and re-extract variables', async () => {
      const created = await Skill.create({
        userId: user._id,
        title: 'Drafting Skill',
        instructions: 'Write summary about {{ topic }}',
        category: 'Writing',
      });

      const res = await request(app)
        .patch(`/api/skills/${created._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Updated Drafting Skill',
          instructions: 'Draft report on {{ subject }} for {{ audience }}',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Drafting Skill');
      expect(res.body.data.variables).toEqual(['subject', 'audience']);
    });

    it('should delete a user skill', async () => {
      const created = await Skill.create({
        userId: user._id,
        title: 'Temporary Skill',
        instructions: 'Do temp action',
      });

      const res = await request(app)
        .delete(`/api/skills/${created._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const exists = await Skill.findById(created._id);
      expect(exists).toBeNull();
    });

    it('should toggle favorite status', async () => {
      const systemSkill = await Skill.findOne({ isSystem: true });
      expect(systemSkill).toBeDefined();

      const initialFav = systemSkill.isFavorite;

      const res = await request(app)
        .post(`/api/skills/${systemSkill._id}/favorite`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.isFavorite).toBe(!initialFav);
    });
  });

  describe('Agentic Tool Building & Execution Engine', () => {
    it('buildGeminiToolsConfig correctly formats tools for Google GenAI SDK', () => {
      const configs = buildGeminiToolsConfig(['web_search', 'code_execution', 'fetch_url']);
      expect(configs).toEqual(
        expect.arrayContaining([
          { googleSearch: {} },
          { codeExecution: {} },
          expect.objectContaining({
            functionDeclarations: expect.arrayContaining([
              expect.objectContaining({ name: 'fetch_url' }),
            ]),
          }),
        ]),
      );
    });

    it('executeAgentTool returns invalid url error on invalid fetch_url request', async () => {
      const result = await executeAgentTool('fetch_url', { url: 'not-a-valid-url' }, { userId: user._id });
      expect(result.error).toContain('Invalid URL');
    });

    it('executeAgentTool handles workspace search with query', async () => {
      const result = await executeAgentTool('workspace_search', { query: 'test' }, { userId: user._id });
      expect(result.query).toBe('test');
      expect(Array.isArray(result.results)).toBe(true);
    });
  });
});

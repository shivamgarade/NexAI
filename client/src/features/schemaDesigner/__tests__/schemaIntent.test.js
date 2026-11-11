import { describe, it, expect } from 'vitest';
import { matchSchemaIntent } from '../schemaIntent';

describe('matchSchemaIntent', () => {
  it('matches slash commands correctly', () => {
    const res1 = matchSchemaIntent('/schema design an ecommerce store');
    expect(res1.isMatch).toBe(true);
    expect(res1.cleanPrompt).toBe('design an ecommerce store');
    expect(res1.reason).toBe('slash_command');

    const res2 = matchSchemaIntent('/erd');
    expect(res2.isMatch).toBe(true);
    expect(res2.cleanPrompt).toContain('database schema');

    const res3 = matchSchemaIntent('/datamodel Users and Posts');
    expect(res3.isMatch).toBe(true);
    expect(res3.cleanPrompt).toBe('Users and Posts');
  });

  it('matches natural language database modeling requests', () => {
    const queries = [
      'Design a database schema for an Airbnb clone',
      'Create an ER diagram for a hospital management system',
      'Model a relational database for a multi-tenant SaaS application',
      'Generate database tables for an online bookstore',
      'Design an ERD for an inventory tracking system',
      'database schema for food delivery app',
      'ER diagram for ride sharing service',
    ];

    for (const q of queries) {
      const res = matchSchemaIntent(q);
      expect(res.isMatch).toBe(true);
      expect(res.cleanPrompt).toBe(q);
    }
  });

  it('matches when active skill is database or schema related', () => {
    const activeSkill = {
      slug: 'database-erd-architect',
      title: 'Database & ERD Architect',
    };
    const res = matchSchemaIntent('I need tables for users and orders', activeSkill);
    expect(res.isMatch).toBe(true);
    expect(res.reason).toBe('active_skill');
  });

  it('does not match standard general chat prompts', () => {
    const regularPrompts = [
      'Explain quantum computing in simple terms',
      'Write a Python script to parse a CSV file',
      'Draft a polite follow-up email after an interview',
      'What is the capital of France?',
      'Help me debug this React component',
    ];

    for (const q of regularPrompts) {
      const res = matchSchemaIntent(q);
      expect(res.isMatch).toBe(false);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { lintSchema, autoFixIssue } from '../schemaLinter';
import { schemaToIR } from '../schemaIR';

describe('Schema Linter & Health Score Engine', () => {
  it('awards 100% health score to an empty or ideal schema', () => {
    const { score, issues, summary } = lintSchema(schemaToIR({ entities: [] }));
    expect(score).toBe(100);
    expect(issues).toHaveLength(0);
    expect(summary.grade).toBe('A+');
  });

  it('detects missing primary key and flags error with penalty', () => {
    const ir = schemaToIR({
      entities: [
        {
          name: 'LogEntry',
          fields: [
            { name: 'message', type: 'VARCHAR(255)' },
            { name: 'createdAt', type: 'TIMESTAMP' },
            { name: 'updatedAt', type: 'TIMESTAMP' },
          ],
        },
      ],
    });

    const { score, issues, summary } = lintSchema(ir);
    expect(summary.errors).toBe(1);
    expect(issues.some((i) => i.code === 'MISSING_PRIMARY_KEY')).toBe(true);
    expect(score).toBeLessThan(100);
  });

  it('detects unindexed foreign keys and missing audit timestamps', () => {
    const ir = schemaToIR({
      entities: [
        {
          name: 'User',
          fields: [{ name: 'id', type: 'UUID', isPrimary: true }],
        },
        {
          name: 'Comment',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'userId', type: 'UUID', references: 'User.id' },
          ],
        },
      ],
    });

    const { issues } = lintSchema(ir);
    const hasUnindexed = issues.some((i) => i.code === 'UNINDEXED_FOREIGN_KEY');
    const hasMissingTimestamps = issues.some((i) => i.code === 'MISSING_AUDIT_TIMESTAMPS');

    expect(hasUnindexed).toBe(true);
    expect(hasMissingTimestamps).toBe(true);
  });

  it('applies auto-fix to insert missing primary key', () => {
    const ir = schemaToIR({
      entities: [
        {
          name: 'Event',
          fields: [{ name: 'title', type: 'VARCHAR(255)' }],
        },
      ],
    });

    const { issues } = lintSchema(ir);
    const pkIssue = issues.find((i) => i.code === 'MISSING_PRIMARY_KEY');
    expect(pkIssue).toBeDefined();

    const fixedIR = autoFixIssue(ir, pkIssue.id);
    const fixedEnt = Object.values(fixedIR.entities)[0];
    const hasPkNow = fixedEnt.fields.some((f) => f.pk);
    expect(hasPkNow).toBe(true);
  });
});

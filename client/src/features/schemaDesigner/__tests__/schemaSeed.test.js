import { describe, it, expect } from 'vitest';
import { topoSortEntities, generateSeedData } from '../schemaSeed';
import { schemaToIR } from '../schemaIR';

describe('Schema Seed Data Generator', () => {
  it('topologically sorts tables so parent tables precede dependent children', () => {
    const ir = schemaToIR({
      entities: [
        {
          name: 'OrderItem',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'orderId', type: 'UUID', references: 'Order.id' },
          ],
        },
        {
          name: 'User',
          fields: [{ name: 'id', type: 'UUID', isPrimary: true }],
        },
        {
          name: 'Order',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'userId', type: 'UUID', references: 'User.id' },
          ],
        },
      ],
    });

    const sorted = topoSortEntities(ir);
    const names = sorted.map((e) => e.name);

    // User must appear before Order; Order must appear before OrderItem
    expect(names.indexOf('User')).toBeLessThan(names.indexOf('Order'));
    expect(names.indexOf('Order')).toBeLessThan(names.indexOf('OrderItem'));
  });

  it('generates mock relational seed data rows matching foreign key references', () => {
    const ir = schemaToIR({
      entities: [
        {
          name: 'Author',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'name', type: 'VARCHAR(255)' },
          ],
        },
        {
          name: 'Book',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'title', type: 'VARCHAR(255)' },
            { name: 'authorId', type: 'UUID', references: 'Author.id' },
          ],
        },
      ],
    });

    const seed = generateSeedData(ir, 3);
    expect(seed.Author).toHaveLength(3);
    expect(seed.Book).toHaveLength(3);

    // Verify foreign key in Book references one of the generated Author IDs
    const authorIds = seed.Author.map((a) => a.id);
    seed.Book.forEach((book) => {
      expect(authorIds).toContain(book.authorId);
    });
  });
});

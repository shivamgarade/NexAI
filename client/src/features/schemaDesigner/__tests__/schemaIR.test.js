import { describe, it, expect } from 'vitest';
import {
  createEmptyIR,
  schemaToIR,
  irToLegacySchema,
  getDerivedRelationships,
  generateSQL,
  generatePrisma,
  generateMongoose,
  generateTypeScript,
  generateMermaid,
  generateDBML,
} from '../schemaIR';

describe('Canonical Schema IR Engine', () => {
  it('creates an empty IR with version 1', () => {
    const ir = createEmptyIR('Test Title', 'Test Summary');
    expect(ir.version).toBe(1);
    expect(ir.title).toBe('Test Title');
    expect(ir.summary).toBe('Test Summary');
    expect(ir.entities).toEqual({});
  });

  it('converts legacy/raw schema into canonical IR with stable IDs and resolves FKs', () => {
    const raw = {
      title: 'E-Commerce Model',
      entities: [
        {
          name: 'User',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'email', type: 'VARCHAR(255)', isUnique: true },
          ],
        },
        {
          name: 'Order',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'userId', type: 'UUID', isForeignKey: true, references: 'User.id' },
            { name: 'total', type: 'INTEGER' },
          ],
        },
      ],
    };

    const ir = schemaToIR(raw);
    const entities = Object.values(ir.entities);
    expect(entities).toHaveLength(2);

    const userEnt = entities.find((e) => e.name === 'User');
    const orderEnt = entities.find((e) => e.name === 'Order');
    expect(userEnt).toBeDefined();
    expect(orderEnt).toBeDefined();

    const orderFkField = orderEnt.fields.find((f) => f.name === 'userId');
    expect(orderFkField.fk).toBeDefined();
    expect(orderFkField.fk.entityId).toBe(userEnt.id);

    const relationships = getDerivedRelationships(ir);
    expect(relationships).toHaveLength(1);
    expect(relationships[0].sourceEntityName).toBe('Order');
    expect(relationships[0].targetEntityName).toBe('User');
    expect(relationships[0].cardinality).toBe('1 : N');
  });

  it('derives 1:1 cardinality when foreign key is marked unique', () => {
    const raw = {
      entities: [
        {
          name: 'User',
          fields: [{ name: 'id', type: 'UUID', isPrimary: true }],
        },
        {
          name: 'Profile',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'userId', type: 'UUID', isUnique: true, references: 'User.id' },
          ],
        },
      ],
    };

    const ir = schemaToIR(raw);
    const relationships = getDerivedRelationships(ir);
    expect(relationships).toHaveLength(1);
    expect(relationships[0].cardinality).toBe('1 : 1');
  });

  it('generates valid SQL DDL from IR with constraints and indexes', () => {
    const ir = schemaToIR({
      entities: [
        {
          name: 'Customer',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'name', type: 'VARCHAR(255)' },
          ],
        },
        {
          name: 'Invoice',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'customerId', type: 'UUID', references: 'Customer.id' },
          ],
        },
      ],
    });

    const sql = generateSQL(ir);
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "customer"');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "invoice"');
    expect(sql).toContain('FOREIGN KEY ("customerid") REFERENCES "customer" ("id")');
    expect(sql).toContain('CREATE INDEX IF NOT EXISTS "idx_invoice_customerid"');
  });

  it('generates valid Prisma schema from IR', () => {
    const ir = schemaToIR({
      entities: [
        {
          name: 'Post',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'title', type: 'VARCHAR(255)' },
          ],
        },
      ],
    });

    const prisma = generatePrisma(ir);
    expect(prisma).toContain('model Post {');
    expect(prisma).toContain('@id @default(uuid())');
  });

  it('generates valid Mongoose schema and DBML from IR', () => {
    const ir = schemaToIR({
      entities: [
        {
          name: 'Account',
          fields: [
            { name: 'id', type: 'UUID', isPrimary: true },
            { name: 'balance', type: 'INTEGER' },
          ],
        },
      ],
    });

    const mongooseCode = generateMongoose(ir);
    expect(mongooseCode).toContain('const accountSchema = new mongoose.Schema');
    expect(mongooseCode).toContain("export const Account = mongoose.model('Account', accountSchema);");

    const dbml = generateDBML(ir);
    expect(dbml).toContain('Table account {');
    expect(dbml).toContain('id uuid [pk]');
  });
});

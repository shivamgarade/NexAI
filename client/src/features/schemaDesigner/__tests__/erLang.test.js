import { describe, it, expect } from 'vitest';
import { parse, serialize, createEmptyModel } from '../erLang';

describe('erLang Parser & Serializer', () => {
  it('handles empty text and empty model cleanly', () => {
    const { model, errors } = parse('');
    expect(errors).toHaveLength(0);
    expect(model.entities).toHaveLength(0);
    expect(model.relations).toHaveLength(0);
    expect(serialize(model)).toBe('');
  });

  it('parses entity blocks with color and field modifiers', () => {
    const code = `
users [color: blue] {
  id uuid pk
  email string unique
  bio text nullable
  orgId uuid
}

organizations {
  id uuid pk
  name string
}

users.orgId > organizations.id
`.trim();

    const { model, errors } = parse(code);
    expect(errors).toHaveLength(0);
    expect(model.entities).toHaveLength(2);

    const users = model.entities.find((e) => e.name === 'users');
    expect(users).toBeDefined();
    expect(users.color).toBe('blue');
    expect(users.fields).toHaveLength(4);

    const idField = users.fields.find((f) => f.name === 'id');
    expect(idField.pk).toBe(true);

    const emailField = users.fields.find((f) => f.name === 'email');
    expect(emailField.unique).toBe(true);

    const bioField = users.fields.find((f) => f.name === 'bio');
    expect(bioField.nullable).toBe(true);

    // Relations
    expect(model.relations).toHaveLength(1);
    const rel = model.relations[0];
    expect(rel.type).toBe('many-to-one');
    expect(rel.from.entityId).toBe(users.id);
    expect(rel.from.fieldId).toBe(users.fields.find((f) => f.name === 'orgId').id);
  });

  it('round-trips model cleanly: parse(serialize(model)) matches original structure', () => {
    const initialCode = `users [color: purple] {
  id uuid pk
  name string
  orgId uuid
}

organizations {
  id uuid pk
  name string
}

users.orgId > organizations.id`;

    const { model: model1 } = parse(initialCode);
    const serialized = serialize(model1);
    const { model: model2, errors } = parse(serialized, model1);

    expect(errors).toHaveLength(0);
    expect(model2.entities.length).toBe(model1.entities.length);
    expect(model2.relations.length).toBe(model1.relations.length);

    // Stable IDs preserved
    expect(model2.entities[0].id).toBe(model1.entities[0].id);
    expect(model2.entities[0].fields[0].id).toBe(model1.entities[0].fields[0].id);
    expect(model2.relations[0].id).toBe(model1.relations[0].id);
  });

  it('supports all 4 relation operators: >, <, -, <>', () => {
    const code = `
A {
  id uuid pk
  bId uuid
  cId uuid
  dId uuid
}

B {
  id uuid pk
}

C {
  id uuid pk
}

D {
  id uuid pk
}

A.bId > B.id
A.cId < C.id
A.dId - D.id
B.id <> C.id
`.trim();

    const { model, errors } = parse(code);
    expect(errors).toHaveLength(0);
    expect(model.relations).toHaveLength(4);
    expect(model.relations[0].type).toBe('many-to-one');
    expect(model.relations[1].type).toBe('one-to-many');
    expect(model.relations[2].type).toBe('one-to-one');
    expect(model.relations[3].type).toBe('many-to-many');
  });

  it('captures syntax errors gracefully without crashing', () => {
    const brokenCode = `
users {
  invalid_field_only_one_token
}

users.unknownField > orgs.id
`.trim();

    const { model, errors } = parse(brokenCode);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('Invalid field definition'))).toBe(true);
    expect(errors.some((e) => e.message.includes('not found'))).toBe(true);
  });
});

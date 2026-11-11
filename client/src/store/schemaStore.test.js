import { describe, it, expect, beforeEach } from 'vitest';
import { useSchemaStore } from './schemaStore';

describe('useSchemaStore (Single Source of Truth ER Store)', () => {
  beforeEach(() => {
    useSchemaStore.getState().reset();
  });

  it('adds an entity and immediately serializes to code', () => {
    const store = useSchemaStore.getState();
    store.addEntity('users');

    const state = useSchemaStore.getState();
    expect(state.model.entities).toHaveLength(1);
    expect(state.model.entities[0].name).toBe('users');
    expect(state.code).toContain('users {');
    expect(state.code).toContain('id uuid pk');
  });

  it('adds a relation between two entities and serializes the relation line', () => {
    const store = useSchemaStore.getState();
    store.addEntity('users');
    store.addEntity('orders');

    const state1 = useSchemaStore.getState();
    const users = state1.model.entities.find((e) => e.name === 'users');
    const orders = state1.model.entities.find((e) => e.name === 'orders');

    // Add relation: orders.id > users.id
    store.addRelation(orders.id, orders.fields[0].id, users.id, users.fields[0].id, 'many-to-one');

    const state2 = useSchemaStore.getState();
    expect(state2.model.relations).toHaveLength(1);
    expect(state2.code).toContain('orders.id > users.id');
  });

  it('deleting an entity cascades and removes its relations from both model and code', () => {
    const store = useSchemaStore.getState();
    store.addEntity('authors');
    store.addEntity('books');

    const state1 = useSchemaStore.getState();
    const authors = state1.model.entities.find((e) => e.name === 'authors');
    const books = state1.model.entities.find((e) => e.name === 'books');

    store.addRelation(books.id, books.fields[0].id, authors.id, authors.fields[0].id, 'many-to-one');
    expect(useSchemaStore.getState().code).toContain('books.id > authors.id');

    // Delete authors
    store.deleteEntity(authors.id);

    const state2 = useSchemaStore.getState();
    expect(state2.model.entities).toHaveLength(1);
    expect(state2.model.relations).toHaveLength(0);
    expect(state2.code).not.toContain('authors');
    expect(state2.code).not.toContain('>');
  });

  it('updates model when valid code is typed via setCode', () => {
    const store = useSchemaStore.getState();
    const newCode = `
posts {
  id uuid pk
  title string
}

comments {
  id uuid pk
  postId uuid
}

comments.postId > posts.id
`.trim();

    store.setCode(newCode);

    const state = useSchemaStore.getState();
    expect(state.parseErrors).toHaveLength(0);
    expect(state.model.entities).toHaveLength(2);
    expect(state.model.relations).toHaveLength(1);
  });

  it('preserves the last valid model and exposes parseErrors when code has a syntax error', () => {
    const store = useSchemaStore.getState();
    store.addEntity('customers');
    const initialEntitiesCount = useSchemaStore.getState().model.entities.length;

    // Type broken syntax
    store.setCode('customers {\n  broken_field\n}');

    const state = useSchemaStore.getState();
    expect(state.parseErrors.length).toBeGreaterThan(0);
    // Diagram model preserved!
    expect(state.model.entities.length).toBe(initialEntitiesCount);
  });

  it('supports undo and redo over model mutations', () => {
    const store = useSchemaStore.getState();
    store.addEntity('first');
    expect(useSchemaStore.getState().model.entities).toHaveLength(1);

    store.addEntity('second');
    expect(useSchemaStore.getState().model.entities).toHaveLength(2);

    store.undo();
    expect(useSchemaStore.getState().model.entities).toHaveLength(1);
    expect(useSchemaStore.getState().model.entities[0].name).toBe('first');

    store.redo();
    expect(useSchemaStore.getState().model.entities).toHaveLength(2);
  });
});

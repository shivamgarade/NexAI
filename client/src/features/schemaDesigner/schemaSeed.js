/**
 * Deterministic Mock Seed Data Generator
 * Topologically sorts entities using Kahn's algorithm over foreign key edges.
 * Generates valid relational seed data in dependency order.
 */

/**
 * Topologically sort entities so referenced tables appear before tables with foreign keys.
 * Handles self-references and breaks cycles cleanly.
 *
 * @param {object} ir - Canonical IR
 * @returns {Array<object>} Sorted list of entities
 */
export function topoSortEntities(ir) {
  if (!ir?.entities) return [];
  const entities = Object.values(ir.entities);
  const inDegree = new Map();
  const adj = new Map();

  entities.forEach((e) => {
    inDegree.set(e.id, 0);
    adj.set(e.id, []);
  });

  entities.forEach((entity) => {
    (entity.fields || []).forEach((field) => {
      const targetId = field.fk?.entityId;
      // Exclude self-references to avoid immediate cycles
      if (targetId && targetId !== entity.id && inDegree.has(targetId)) {
        // targetId must be created BEFORE entity.id
        adj.get(targetId).push(entity.id);
        inDegree.set(entity.id, inDegree.get(entity.id) + 1);
      }
    });
  });

  const queue = [];
  inDegree.forEach((deg, id) => {
    if (deg === 0) queue.push(id);
  });

  const sortedIds = [];
  while (queue.length > 0) {
    const curr = queue.shift();
    sortedIds.push(curr);

    (adj.get(curr) || []).forEach((neighbor) => {
      inDegree.set(neighbor, inDegree.get(neighbor) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    });
  }

  // Append any cyclic entities at the end
  entities.forEach((e) => {
    if (!sortedIds.includes(e.id)) {
      sortedIds.push(e.id);
    }
  });

  return sortedIds.map((id) => ir.entities[id]).filter(Boolean);
}

/**
 * Generates sample values for a field based on type and semantics
 * @param {object} field
 * @param {number} rowIdx
 * @param {Map<string, string[]>} generatedPks
 * @returns {any}
 */
function generateFieldValue(field, rowIdx, generatedPks) {
  const name = field.name.toLowerCase();
  const type = field.type.toUpperCase();

  // If Foreign Key, pick a primary key from previously generated target table
  if (field.fk?.entityId) {
    const targetPks = generatedPks.get(field.fk.entityId) || [];
    if (targetPks.length > 0) {
      return targetPks[rowIdx % targetPks.length];
    }
    return `ref_${rowIdx + 1}`;
  }

  // Primary Keys
  if (field.pk) {
    if (type === 'UUID') {
      return `a${rowIdx}e${rowIdx}b${rowIdx}c-0000-4000-8000-00000000000${rowIdx + 1}`;
    }
    return rowIdx + 1;
  }

  // Semantic value inference
  if (name.includes('email')) return `user${rowIdx + 1}@example.com`;
  if (name.includes('name') || name.includes('title')) return `Sample ${field.name} ${rowIdx + 1}`;
  if (name.includes('sku') || name.includes('code')) return `SKU-${1000 + rowIdx}`;
  if (name.includes('price') || name.includes('amount') || name.includes('cost')) return 19.99 + rowIdx * 5;
  if (name.includes('status')) return ['active', 'pending', 'completed'][rowIdx % 3];
  if (name.includes('role')) return ['admin', 'member', 'editor'][rowIdx % 3];
  if (name.includes('password') || name.includes('hash')) return '$2a$12$e8Yh9f982Kjhasd...';
  if (name.includes('phone')) return `+1-555-010${rowIdx}`;
  if (name.includes('rating') || name.includes('score')) return (rowIdx % 5) + 1;

  // Type-based inference
  if (type === 'BOOLEAN') return rowIdx % 2 === 0;
  if (type === 'INTEGER' || type === 'BIGINT') return (rowIdx + 1) * 10;
  if (type.includes('DECIMAL') || type.includes('FLOAT')) return parseFloat((12.5 * (rowIdx + 1)).toFixed(2));
  if (type.includes('TIMESTAMP') || type.includes('DATE')) return new Date(Date.now() - rowIdx * 86400000).toISOString();
  if (type === 'JSON') return { key: `val_${rowIdx + 1}`, active: true };
  if (type === 'TEXT') return `Detailed text content and description for entry #${rowIdx + 1}.`;

  return `${field.name}_${rowIdx + 1}`;
}

/**
 * Generates mock seed data in topological order
 *
 * @param {object} ir - Canonical IR
 * @param {number} count - Rows per table (default 3)
 * @returns {Record<string, Array<object>>} Map of entity name to mock rows
 */
export function generateSeedData(ir, count = 3) {
  if (!ir?.entities) return {};
  const sortedEntities = topoSortEntities(ir);
  const dataset = {};
  const generatedPks = new Map(); // entityId -> Array of primary key values

  sortedEntities.forEach((entity) => {
    const rows = [];
    const pkValues = [];
    const pkField = (entity.fields || []).find((f) => f.pk);

    for (let i = 0; i < count; i++) {
      const row = {};
      (entity.fields || []).forEach((field) => {
        const val = generateFieldValue(field, i, generatedPks);
        row[field.name] = val;
        if (field.pk || (pkField && field.id === pkField.id)) {
          pkValues.push(val);
        }
      });
      rows.push(row);
    }

    generatedPks.set(entity.id, pkValues);
    dataset[entity.name] = rows;
  });

  return dataset;
}

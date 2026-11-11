/**
 * erLang.js - Deterministic Parser & Serializer for Eraser-style ER Language
 * Single Source of Truth Language for NexAI ER Diagram.
 *
 * Syntax Example:
 * users [color: blue] {
 *   id uuid pk
 *   email string unique
 *   orgId uuid
 * }
 *
 * organizations {
 *   id uuid pk
 *   name string
 * }
 *
 * users.orgId > organizations.id
 *
 * Operators:
 * >  : many-to-one
 * <  : one-to-many
 * -  : one-to-one
 * <> : many-to-many
 */

export const RELATION_OPS = {
  '>': 'many-to-one',
  '<': 'one-to-many',
  '-': 'one-to-one',
  '<>': 'many-to-many',
};

export const RELATION_TYPES_TO_OP = {
  'many-to-one': '>',
  'one-to-many': '<',
  'one-to-one': '-',
  'many-to-many': '<>',
};

/**
 * Generate stable unique IDs
 * @param {string} prefix
 * @returns {string}
 */
export function generateId(prefix = 'id') {
  const rand = Math.random().toString(36).substring(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}_${time}${rand}`;
}

/**
 * Creates a fresh, empty ER model
 * @returns {object}
 */
export function createEmptyModel() {
  return {
    entities: [],
    relations: [],
    layout: {},
  };
}

/**
 * Serializes an ER model into human-readable Eraser-style ER code.
 *
 * @param {object} model - The ER model { entities, relations, layout }
 * @returns {string}
 */
export function serialize(model) {
  if (!model || !Array.isArray(model.entities)) {
    return '';
  }

  const lines = [];

  // Entity lookup maps for relation resolution
  const entityIdMap = new Map();
  const fieldIdMap = new Map();

  // 1. Serialize Entity Blocks
  model.entities.forEach((entity, idx) => {
    entityIdMap.set(entity.id, entity.name);

    const colorAttr = entity.color ? ` [color: ${entity.color}]` : '';
    lines.push(`${entity.name}${colorAttr} {`);

    (entity.fields || []).forEach((field) => {
      fieldIdMap.set(`${entity.id}.${field.id}`, field.name);

      const parts = [`  ${field.name}`, field.type || 'string'];
      if (field.pk) parts.push('pk');
      if (field.unique) parts.push('unique');
      if (field.nullable) parts.push('nullable');

      lines.push(parts.join(' '));
    });

    lines.push('}');
    if (idx < model.entities.length - 1 || (model.relations && model.relations.length > 0)) {
      lines.push('');
    }
  });

  // 2. Serialize Relations with dedicated section comment
  if (Array.isArray(model.relations) && model.relations.length > 0) {
    lines.push('// relations');
    model.relations.forEach((rel) => {
      const fromEntityName = entityIdMap.get(rel.from?.entityId);
      const fromFieldName = fieldIdMap.get(`${rel.from?.entityId}.${rel.from?.fieldId}`);
      const toEntityName = entityIdMap.get(rel.to?.entityId);
      const toFieldName = fieldIdMap.get(`${rel.to?.entityId}.${rel.to?.fieldId}`);

      if (fromEntityName && fromFieldName && toEntityName && toFieldName) {
        const op = RELATION_TYPES_TO_OP[rel.type] || '>';
        lines.push(`${fromEntityName}.${fromFieldName} ${op} ${toEntityName}.${toFieldName}`);
      }
    });
  }

  return lines.join('\n');
}

/**
 * Parses Eraser-style ER language code into an ER model.
 * Preserves stable IDs and layout from existingModel if available.
 *
 * @param {string} text - ER code
 * @param {object|null} existingModel - Optional current model for ID stability
 * @returns {{ model: object, errors: Array<{ line: number, message: string }> }}
 */
export function parse(text = '', existingModel = null) {
  const lines = (text || '').split('\n');
  const errors = [];

  const entities = [];
  const rawRelations = [];

  // Existing lookup maps to preserve stable IDs across edits
  const existingEntityMap = new Map(); // lowercaseName -> entity
  const existingFieldMap = new Map(); // entityId:lowercaseFieldName -> field
  const existingRelMap = new Map(); // key -> rel

  if (existingModel && Array.isArray(existingModel.entities)) {
    existingModel.entities.forEach((e) => {
      existingEntityMap.set(e.name.toLowerCase(), e);
      (e.fields || []).forEach((f) => {
        existingFieldMap.set(`${e.id}:${f.name.toLowerCase()}`, f);
      });
    });

    if (Array.isArray(existingModel.relations)) {
      existingModel.relations.forEach((r) => {
        const key = `${r.from?.entityId}:${r.from?.fieldId}->${r.to?.entityId}:${r.to?.fieldId}:${r.type}`;
        existingRelMap.set(key, r);
      });
    }
  }

  let currentEntity = null;
  const entityNameMap = new Map(); // name.toLowerCase() -> entity
  const entityNameCaseMap = new Map(); // name.toLowerCase() -> actualEntity

  lines.forEach((rawLine, idx) => {
    const lineNum = idx + 1;
    // Strip comments (// or #)
    const line = rawLine.replace(/(\/\/|#).*$/, '').trim();

    if (!line) return;

    // Check Entity Block Open: e.g. "users [color: blue] {" or "users {"
    const entityHeaderMatch = line.match(/^([a-zA-Z0-9_]+)(?:\s*\[color:\s*([^\]]+)\])?\s*\{$/);
    if (entityHeaderMatch) {
      if (currentEntity) {
        errors.push({
          line: lineNum,
          message: `Unexpected entity declaration before closing "${currentEntity.name}".`,
        });
        return;
      }

      const entityName = entityHeaderMatch[1];
      const color = entityHeaderMatch[2]?.trim();
      const existing = existingEntityMap.get(entityName.toLowerCase());

      currentEntity = {
        id: existing?.id || generateId('ent'),
        name: entityName,
        color: color || existing?.color || undefined,
        fields: [],
      };

      entityNameMap.set(entityName.toLowerCase(), currentEntity);
      entityNameCaseMap.set(entityName.toLowerCase(), currentEntity);
      return;
    }

    // Check Entity Block Close: "}"
    if (line === '}') {
      if (!currentEntity) {
        errors.push({
          line: lineNum,
          message: 'Unexpected closing brace "}" without open entity block.',
        });
        return;
      }
      entities.push(currentEntity);
      currentEntity = null;
      return;
    }

    // Inside Entity Block: Field definition
    if (currentEntity) {
      const fieldTokens = line.split(/\s+/);
      if (fieldTokens.length < 2) {
        errors.push({
          line: lineNum,
          message: `Invalid field definition "${line}". Expected: "<name> <type> [pk] [unique] [nullable]".`,
        });
        return;
      }

      const fieldName = fieldTokens[0];
      const fieldType = fieldTokens[1];
      const modifiers = fieldTokens.slice(2).map((m) => m.toLowerCase());

      const existingField = existingFieldMap.get(
        `${currentEntity.id}:${fieldName.toLowerCase()}`
      );

      const field = {
        id: existingField?.id || generateId('fld'),
        name: fieldName,
        type: fieldType,
        pk: modifiers.includes('pk'),
        unique: modifiers.includes('unique'),
        nullable: modifiers.includes('nullable'),
      };

      currentEntity.fields.push(field);
      return;
    }

    // Outside Entity Block: Check Relationship Definition
    // e.g. "users.orgId > organizations.id" or "posts.author_id <> authors.id"
    const relMatch = line.match(
      /^([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*(>|<|-|<>)\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)$/
    );

    if (relMatch) {
      rawRelations.push({
        lineNum,
        fromEntity: relMatch[1],
        fromField: relMatch[2],
        op: relMatch[3],
        toEntity: relMatch[4],
        toField: relMatch[5],
      });
      return;
    }

    // Unrecognized Line Syntax
    errors.push({
      line: lineNum,
      message: `Unrecognized syntax: "${line}".`,
    });
  });

  if (currentEntity) {
    errors.push({
      line: lines.length,
      message: `Unclosed entity block "${currentEntity.name}". Missing "}".`,
    });
    entities.push(currentEntity);
  }

  // Resolve Relationships against Parsed Entities
  const relations = [];
  rawRelations.forEach((r) => {
    const fromEnt = entityNameMap.get(r.fromEntity.toLowerCase());
    const toEnt = entityNameMap.get(r.toEntity.toLowerCase());

    if (!fromEnt) {
      errors.push({
        line: r.lineNum,
        message: `Entity "${r.fromEntity}" in relationship not found.`,
      });
      return;
    }

    if (!toEnt) {
      errors.push({
        line: r.lineNum,
        message: `Entity "${r.toEntity}" in relationship not found.`,
      });
      return;
    }

    const fromFld = fromEnt.fields.find(
      (f) => f.name.toLowerCase() === r.fromField.toLowerCase()
    );
    const toFld = toEnt.fields.find(
      (f) => f.name.toLowerCase() === r.toField.toLowerCase()
    );

    if (!fromFld) {
      errors.push({
        line: r.lineNum,
        message: `Field "${r.fromEntity}.${r.fromField}" in relationship not found.`,
      });
      return;
    }

    if (!toFld) {
      errors.push({
        line: r.lineNum,
        message: `Field "${r.toEntity}.${r.toField}" in relationship not found.`,
      });
      return;
    }

    const relType = RELATION_OPS[r.op] || 'many-to-one';
    const key = `${fromEnt.id}:${fromFld.id}->${toEnt.id}:${toFld.id}:${relType}`;
    const existing = existingRelMap.get(key);

    relations.push({
      id: existing?.id || generateId('rel'),
      from: {
        entityId: fromEnt.id,
        fieldId: fromFld.id,
      },
      to: {
        entityId: toEnt.id,
        fieldId: toFld.id,
      },
      type: relType,
    });
  });

  // Reconcile Layout: preserve coordinates from existingModel, assign default grid positions for new entities
  const layout = { ...(existingModel?.layout || {}) };
  entities.forEach((entity, idx) => {
    if (!layout[entity.id]) {
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      layout[entity.id] = { x: 50 + col * 340, y: 50 + row * 280 };
    }
  });

  return {
    model: {
      entities,
      relations,
      layout,
    },
    errors,
  };
}

/* ==========================================================================
   OPTIONAL EXPORTERS: PostgreSQL, Prisma, Mongoose
   ========================================================================== */

/**
 * Generate PostgreSQL DDL from ER Model
 * @param {object} model
 * @returns {string}
 */
export function exportToSQL(model) {
  if (!model?.entities?.length) return '';
  const lines = ['-- Generated PostgreSQL DDL from NexAI ER Diagram\n'];

  model.entities.forEach((e) => {
    lines.push(`CREATE TABLE IF NOT EXISTS "${e.name.toLowerCase()}" (`);
    const cols = [];
    const pks = [];

    (e.fields || []).forEach((f) => {
      let t = f.type.toUpperCase();
      if (t === 'UUID') t = 'UUID DEFAULT gen_random_uuid()';
      else if (t === 'STRING') t = 'VARCHAR(255)';

      let def = `  "${f.name.toLowerCase()}" ${t}`;
      if (!f.nullable) def += ' NOT NULL';
      if (f.unique) def += ' UNIQUE';
      cols.push(def);

      if (f.pk) pks.push(`"${f.name.toLowerCase()}"`);
    });

    if (pks.length > 0) {
      cols.push(`  PRIMARY KEY (${pks.join(', ')})`);
    }

    lines.push(cols.join(',\n'));
    lines.push(');\n');
  });

  // Foreign keys
  (model.relations || []).forEach((r) => {
    const fromEnt = model.entities.find((e) => e.id === r.from.entityId);
    const fromFld = fromEnt?.fields.find((f) => f.id === r.from.fieldId);
    const toEnt = model.entities.find((e) => e.id === r.to.entityId);
    const toFld = toEnt?.fields.find((f) => f.id === r.to.fieldId);

    if (fromEnt && fromFld && toEnt && toFld) {
      lines.push(
        `ALTER TABLE "${fromEnt.name.toLowerCase()}" ` +
        `ADD CONSTRAINT "fk_${fromEnt.name.toLowerCase()}_${fromFld.name.toLowerCase()}" ` +
        `FOREIGN KEY ("${fromFld.name.toLowerCase()}") REFERENCES "${toEnt.name.toLowerCase()}" ("${toFld.name.toLowerCase()}") ON DELETE CASCADE;\n`
      );
    }
  });

  return lines.join('\n');
}

/**
 * Generate Prisma Schema from ER Model
 * @param {object} model
 * @returns {string}
 */
export function exportToPrisma(model) {
  if (!model?.entities?.length) return '';
  const lines = [
    'datasource db {',
    '  provider = "postgresql"',
    '  url      = env("DATABASE_URL")',
    '}',
    '',
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    '',
  ];

  model.entities.forEach((e) => {
    lines.push(`model ${e.name} {`);
    (e.fields || []).forEach((f) => {
      let pt = 'String';
      if (f.type.toLowerCase() === 'int' || f.type.toLowerCase() === 'integer') pt = 'Int';
      if (f.type.toLowerCase() === 'boolean' || f.type.toLowerCase() === 'bool') pt = 'Boolean';
      if (f.type.toLowerCase() === 'datetime') pt = 'DateTime';

      let attr = '';
      if (f.pk) attr += ' @id @default(uuid())';
      if (f.unique) attr += ' @unique';
      const opt = f.nullable ? '?' : '';
      lines.push(`  ${f.name.padEnd(16)} ${pt}${opt}${attr}`);
    });
    lines.push('}\n');
  });

  return lines.join('\n');
}

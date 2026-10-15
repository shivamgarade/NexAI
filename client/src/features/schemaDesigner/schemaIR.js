/**
 * Canonical Schema Intermediate Representation (IR) Engine
 * Single Source of Truth for NexAI Data Modeling Studio.
 *
 * All code outputs (Mongoose, SQL, Prisma, TypeScript, Mermaid, DBML)
 * and Canvas layouts are pure projections of this IR.
 */

export const IR_VERSION = 1;

/**
 * Generate lightweight unique stable identifiers
 * @param {string} prefix
 * @returns {string}
 */
export function generateStableId(prefix = 'id') {
  const rand = Math.random().toString(36).substring(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}_${time}${rand}`;
}

/**
 * Creates a fresh, empty canonical IR structure
 * @returns {object}
 */
export function createEmptyIR(title = 'Custom Data Model', summary = 'Data architecture model') {
  return {
    version: IR_VERSION,
    title,
    summary,
    entities: {},
    layout: {},
    designNotes: [],
  };
}

/**
 * Normalize arbitrary field type into standard IR type
 * @param {string} rawType
 * @returns {string}
 */
export function normalizeIRType(rawType = 'VARCHAR(255)') {
  const t = String(rawType || '').trim().toUpperCase();
  if (t.includes('UUID') || t.includes('OBJECTID')) return 'UUID';
  if (t.includes('BIGINT')) return 'BIGINT';
  if (t.includes('INT') || t.includes('NUMBER')) return 'INTEGER';
  if (t.includes('DECIMAL') || t.includes('FLOAT') || t.includes('NUMERIC')) return 'DECIMAL(12,2)';
  if (t.includes('BOOL')) return 'BOOLEAN';
  if (t.includes('DATE') || t.includes('TIME')) return 'TIMESTAMP';
  if (t.includes('JSON')) return 'JSON';
  if (t.includes('TEXT')) return 'TEXT';
  if (t.includes('ARRAY')) return 'ARRAY';
  if (t.startsWith('VARCHAR')) return t;
  return 'VARCHAR(255)';
}

/**
 * Derives relationship links (1:1, 1:N, N:M) strictly from Foreign Keys & Uniqueness.
 * Stable, deterministic, and name-independent.
 *
 * @param {object} ir - Canonical IR
 * @returns {Array<object>}
 */
export function getDerivedRelationships(ir) {
  if (!ir?.entities) return [];
  const relationships = [];
  const entityList = Object.values(ir.entities);

  // Track junction candidates for N:M inference
  const junctionCandidates = new Map();

  entityList.forEach((entity) => {
    const fks = (entity.fields || []).filter((f) => f.fk && f.fk.entityId);

    // If an entity has exactly 2 FKs and minimal other fields, it is a junction entity
    if (fks.length === 2 && entity.fields.length <= 4) {
      junctionCandidates.set(entity.id, {
        junctionEntity: entity,
        fk1: fks[0],
        fk2: fks[1],
      });
    }

    fks.forEach((field) => {
      const targetEntity = ir.entities[field.fk.entityId];
      if (!targetEntity) return;

      const targetField = (targetEntity.fields || []).find((f) => f.id === field.fk.fieldId) ||
        targetEntity.fields?.find((f) => f.pk) || { id: 'pk', name: 'id' };

      // Determine cardinality:
      // If the FK field is unique, it's a 1:1 relationship; otherwise 1:N
      const isOneToOne = Boolean(field.unique);
      const cardinality = isOneToOne ? '1 : 1' : '1 : N';

      relationships.push({
        id: `${entity.id}.${field.id}->${targetEntity.id}.${targetField.id}`,
        sourceEntityId: entity.id,
        sourceEntityName: entity.name,
        sourceFieldId: field.id,
        sourceFieldName: field.name,
        targetEntityId: targetEntity.id,
        targetEntityName: targetEntity.name,
        targetFieldId: targetField.id,
        targetFieldName: targetField.name,
        cardinality,
        onDelete: field.fk.onDelete || 'CASCADE',
        isJunction: false,
      });
    });
  });

  return relationships;
}

/**
 * Converts legacy/AI schema format to the Canonical IR
 *
 * @param {object} rawSchema
 * @param {object} existingLayout
 * @returns {object}
 */
export function schemaToIR(rawSchema, existingLayout = {}) {
  if (!rawSchema) return createEmptyIR();

  // If already versioned IR
  if (rawSchema.version === IR_VERSION && rawSchema.entities && typeof rawSchema.entities === 'object' && !Array.isArray(rawSchema.entities)) {
    return {
      ...rawSchema,
      layout: { ...rawSchema.layout, ...existingLayout },
    };
  }

  const rawEntities = Array.isArray(rawSchema.entities)
    ? rawSchema.entities
    : Object.values(rawSchema.entities || {});

  const ir = createEmptyIR(rawSchema.title, rawSchema.summary);
  ir.designNotes = Array.isArray(rawSchema.designNotes) ? rawSchema.designNotes : [];

  // 1st Pass: Map entities and fields with stable IDs
  const nameToEntityId = new Map();
  const nameToFieldMap = new Map(); // entityName -> Map(fieldName, fieldId)

  rawEntities.forEach((rawEnt, entIdx) => {
    const entityId = rawEnt.id || generateStableId(`ent_${entIdx + 1}`);
    const entityName = (rawEnt.name || `Entity_${entIdx + 1}`).trim().replace(/[^a-zA-Z0-9_]/g, '');
    nameToEntityId.set(entityName.toLowerCase(), entityId);

    const fieldMap = new Map();
    const fields = (rawEnt.fields || []).map((rawFld, fldIdx) => {
      const fieldId = rawFld.id || generateStableId(`fld_${fldIdx + 1}`);
      const fieldName = (rawFld.name || `field_${fldIdx + 1}`).trim().replace(/[^a-zA-Z0-9_]/g, '');
      fieldMap.set(fieldName.toLowerCase(), fieldId);

      return {
        id: fieldId,
        name: fieldName,
        type: normalizeIRType(rawFld.type),
        pk: Boolean(rawFld.isPrimary || rawFld.pk),
        unique: Boolean(rawFld.isUnique || rawFld.unique),
        nullable: rawFld.isRequired !== undefined ? !rawFld.isRequired : (rawFld.nullable ?? true),
        default: rawFld.default || undefined,
        description: rawFld.description || '',
        _rawRef: rawFld.references || (rawFld.isForeignKey ? rawFld.references : null),
      };
    });

    nameToFieldMap.set(entityName.toLowerCase(), fieldMap);

    ir.entities[entityId] = {
      id: entityId,
      name: entityName,
      description: rawEnt.description || `${entityName} entity`,
      fields,
      indexes: Array.isArray(rawEnt.indexes) ? rawEnt.indexes : [],
    };

    // Layout positioning
    if (existingLayout[entityId]) {
      ir.layout[entityId] = existingLayout[entityId];
    } else if (existingLayout[entityName]) {
      ir.layout[entityId] = existingLayout[entityName];
    } else {
      const col = entIdx % 3;
      const row = Math.floor(entIdx / 3);
      ir.layout[entityId] = { x: 40 + col * 340, y: 40 + row * 300 };
    }
  });

  // 2nd Pass: Resolve foreign keys to stable entityId & fieldId
  Object.values(ir.entities).forEach((entity) => {
    entity.fields.forEach((field) => {
      let refString = field._rawRef;

      // Also auto-infer if field ends in Id / _id if not explicitly referenced
      if (!refString && field.name.toLowerCase().endsWith('id') && !field.pk) {
        const potentialEntity = field.name.replace(/_?id$/i, '').toLowerCase();
        if (nameToEntityId.has(potentialEntity) && nameToEntityId.get(potentialEntity) !== entity.id) {
          refString = `${potentialEntity}.id`;
        }
      }

      if (refString) {
        const [targetEntNameRaw, targetFldNameRaw = 'id'] = refString.split('.');
        const targetEntityId = nameToEntityId.get(targetEntNameRaw.toLowerCase());

        if (targetEntityId && targetEntityId !== entity.id) {
          const targetFieldMap = nameToFieldMap.get(targetEntNameRaw.toLowerCase());
          let targetFieldId = targetFieldMap?.get(targetFldNameRaw.toLowerCase());

          // If specific target field not found, fall back to PK of target
          if (!targetFieldId) {
            const targetEnt = ir.entities[targetEntityId];
            const pkField = targetEnt?.fields?.find((f) => f.pk);
            targetFieldId = pkField ? pkField.id : targetEnt?.fields?.[0]?.id;
          }

          if (targetFieldId) {
            field.fk = {
              entityId: targetEntityId,
              fieldId: targetFieldId,
              onDelete: 'CASCADE',
            };
          }
        }
      }

      delete field._rawRef;
    });
  });

  return ir;
}

/**
 * Converts Canonical IR back to the UI/Legacy schema structure for backward compatibility
 *
 * @param {object} ir
 * @returns {object}
 */
export function irToLegacySchema(ir) {
  if (!ir) return null;
  const entities = Object.values(ir.entities || {}).map((ent) => ({
    id: ent.id,
    name: ent.name,
    description: ent.description || '',
    fields: (ent.fields || []).map((fld) => {
      let references = undefined;
      let isForeignKey = false;

      if (fld.fk?.entityId) {
        const targetEnt = ir.entities[fld.fk.entityId];
        const targetFld = targetEnt?.fields?.find((f) => f.id === fld.fk.fieldId);
        if (targetEnt) {
          isForeignKey = true;
          references = `${targetEnt.name}.${targetFld?.name || 'id'}`;
        }
      }

      return {
        id: fld.id,
        name: fld.name,
        type: fld.type,
        isPrimary: Boolean(fld.pk),
        isRequired: !fld.nullable,
        isUnique: Boolean(fld.unique),
        isForeignKey,
        references,
        description: fld.description,
      };
    }),
  }));

  const codeOutputs = generateAllProjections(ir);

  return {
    title: ir.title || 'Database Schema Architecture',
    summary: ir.summary || 'Entity-relationship data model',
    entities,
    mermaidErDiagram: codeOutputs.mermaid,
    codeOutputs: {
      mongoose: codeOutputs.mongoose,
      sql: codeOutputs.sql,
      prisma: codeOutputs.prisma,
      typescript: codeOutputs.typescript,
      dbml: codeOutputs.dbml,
    },
    designNotes: ir.designNotes || [],
  };
}

/* ==========================================================================
   PURE PROJECTION GENERATORS (IR -> Projections)
   ========================================================================== */

/**
 * Pure generator: PostgreSQL DDL
 * @param {object} ir
 * @returns {string}
 */
export function generateSQL(ir) {
  if (!ir?.entities || Object.keys(ir.entities).length === 0) return '';
  const lines = ['-- PostgreSQL Schema DDL Generated by NexAI Data Modeling Studio\n'];
  lines.push('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";\n');

  const entities = Object.values(ir.entities);

  // 1. Tables & Columns
  entities.forEach((entity) => {
    const tableName = entity.name.toLowerCase();
    lines.push(`CREATE TABLE IF NOT EXISTS "${tableName}" (`);

    const colDefs = [];
    const pkFields = [];

    (entity.fields || []).forEach((field) => {
      const colName = `"${field.name.toLowerCase()}"`;
      let typeStr = field.type;

      if (field.type === 'UUID') {
        typeStr = 'UUID DEFAULT uuid_generate_v4()';
      } else if (field.type.includes('TIMESTAMP')) {
        typeStr = 'TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP';
      }

      let colDef = `  ${colName} ${typeStr}`;
      if (!field.nullable && !field.pk) colDef += ' NOT NULL';
      if (field.unique && !field.pk) colDef += ' UNIQUE';

      colDefs.push(colDef);
      if (field.pk) pkFields.push(colName);
    });

    if (pkFields.length > 0) {
      colDefs.push(`  PRIMARY KEY (${pkFields.join(', ')})`);
    }

    lines.push(colDefs.join(',\n'));
    lines.push(');\n');
  });

  // 2. Foreign Key Constraints
  const fkConstraints = [];
  entities.forEach((entity) => {
    (entity.fields || []).forEach((field) => {
      if (field.fk?.entityId) {
        const targetEntity = ir.entities[field.fk.entityId];
        const targetField = targetEntity?.fields?.find((f) => f.id === field.fk.fieldId);
        if (targetEntity && targetField) {
          const fkName = `fk_${entity.name.toLowerCase()}_${field.name.toLowerCase()}`;
          const onDelete = field.fk.onDelete || 'CASCADE';
          fkConstraints.push(
            `ALTER TABLE "${entity.name.toLowerCase()}" ` +
            `ADD CONSTRAINT "${fkName}" FOREIGN KEY ("${field.name.toLowerCase()}") ` +
            `REFERENCES "${targetEntity.name.toLowerCase()}" ("${targetField.name.toLowerCase()}") ` +
            `ON DELETE ${onDelete};`
          );
        }
      }
    });
  });

  if (fkConstraints.length > 0) {
    lines.push('-- Foreign Key Constraints');
    lines.push(fkConstraints.join('\n'));
    lines.push('\n');
  }

  // 3. Recommended Foreign Key Indexes
  const fkIndexes = [];
  entities.forEach((entity) => {
    (entity.fields || []).forEach((field) => {
      if (field.fk?.entityId) {
        const idxName = `idx_${entity.name.toLowerCase()}_${field.name.toLowerCase()}`;
        fkIndexes.push(
          `CREATE INDEX IF NOT EXISTS "${idxName}" ON "${entity.name.toLowerCase()}" ("${field.name.toLowerCase()}");`
        );
      }
    });
  });

  if (fkIndexes.length > 0) {
    lines.push('-- Performance Indexes on Foreign Keys');
    lines.push(fkIndexes.join('\n'));
    lines.push('\n');
  }

  return lines.join('\n');
}

/**
 * Pure generator: Prisma Schema
 * @param {object} ir
 * @returns {string}
 */
export function generatePrisma(ir) {
  if (!ir?.entities || Object.keys(ir.entities).length === 0) return '';
  const lines = [
    '// Prisma Schema definition generated by NexAI',
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

  const entities = Object.values(ir.entities);

  entities.forEach((entity) => {
    lines.push(`model ${entity.name} {`);

    // Standard fields
    (entity.fields || []).forEach((field) => {
      let pType = 'String';
      if (field.type === 'INTEGER') pType = 'Int';
      else if (field.type === 'BIGINT') pType = 'BigInt';
      else if (field.type === 'DECIMAL' || field.type.includes('DECIMAL')) pType = 'Decimal';
      else if (field.type === 'BOOLEAN') pType = 'Boolean';
      else if (field.type.includes('TIMESTAMP')) pType = 'DateTime';
      else if (field.type === 'JSON') pType = 'Json';

      let attributes = '';
      if (field.pk) attributes += ' @id @default(uuid())';
      else if (field.unique) attributes += ' @unique';

      if (field.name.toLowerCase() === 'createdat' && field.type.includes('TIMESTAMP')) {
        attributes += ' @default(now())';
      } else if (field.name.toLowerCase() === 'updatedat' && field.type.includes('TIMESTAMP')) {
        attributes += ' @updatedAt';
      }

      const isOptional = field.nullable && !field.pk ? '?' : '';
      lines.push(`  ${field.name.padEnd(16)} ${pType}${isOptional}${attributes}`);

      // If foreign key, also add the Prisma relation attribute
      if (field.fk?.entityId) {
        const targetEntity = ir.entities[field.fk.entityId];
        const targetField = targetEntity?.fields?.find((f) => f.id === field.fk.fieldId);
        if (targetEntity && targetField) {
          const relationName = targetEntity.name.charAt(0).toLowerCase() + targetEntity.name.slice(1);
          lines.push(`  ${relationName.padEnd(16)} ${targetEntity.name} @relation(fields: [${field.name}], references: [${targetField.name}])`);
        }
      }
    });

    // Reverse relations from other models pointing here
    entities.forEach((otherEntity) => {
      if (otherEntity.id === entity.id) return;
      (otherEntity.fields || []).forEach((otherFld) => {
        if (otherFld.fk?.entityId === entity.id) {
          const is1to1 = Boolean(otherFld.unique);
          const propName = otherEntity.name.charAt(0).toLowerCase() + otherEntity.name.slice(1) + (is1to1 ? '' : 's');
          const propType = is1to1 ? `${otherEntity.name}?` : `${otherEntity.name}[]`;
          lines.push(`  ${propName.padEnd(16)} ${propType}`);
        }
      });
    });

    lines.push('}\n');
  });

  return lines.join('\n');
}

/**
 * Pure generator: Mongoose Models (MongoDB)
 * @param {object} ir
 * @returns {string}
 */
export function generateMongoose(ir) {
  if (!ir?.entities || Object.keys(ir.entities).length === 0) return '';
  const lines = [
    "import mongoose from 'mongoose';",
    '',
  ];

  const entities = Object.values(ir.entities);

  entities.forEach((entity) => {
    const schemaVar = `${entity.name.charAt(0).toLowerCase() + entity.name.slice(1)}Schema`;
    lines.push(`const ${schemaVar} = new mongoose.Schema({`);

    (entity.fields || []).forEach((field) => {
      if (field.name === '_id' || (field.pk && field.name.toLowerCase() === 'id')) return;

      let mgType = 'String';
      if (field.fk?.entityId) {
        const targetEntity = ir.entities[field.fk.entityId];
        mgType = `mongoose.Schema.Types.ObjectId, ref: '${targetEntity?.name || 'Entity'}'`;
      } else if (field.type === 'INTEGER' || field.type.includes('DECIMAL')) {
        mgType = 'Number';
      } else if (field.type === 'BOOLEAN') {
        mgType = 'Boolean';
      } else if (field.type.includes('TIMESTAMP')) {
        mgType = 'Date';
      } else if (field.type === 'JSON') {
        mgType = 'mongoose.Schema.Types.Mixed';
      }

      const opts = [`type: ${mgType}`];
      if (!field.nullable) opts.push('required: true');
      if (field.unique) opts.push('unique: true');
      if (field.fk?.entityId) opts.push('index: true');

      lines.push(`  ${field.name}: { ${opts.join(', ')} },`);
    });

    lines.push('}, { timestamps: true });\n');
    lines.push(`export const ${entity.name} = mongoose.model('${entity.name}', ${schemaVar});\n`);
  });

  return lines.join('\n');
}

/**
 * Pure generator: TypeScript Types & Interfaces
 * @param {object} ir
 * @returns {string}
 */
export function generateTypeScript(ir) {
  if (!ir?.entities || Object.keys(ir.entities).length === 0) return '';
  const lines = ['// TypeScript Data Model Interfaces generated by NexAI\n'];

  const entities = Object.values(ir.entities);

  entities.forEach((entity) => {
    lines.push(`export interface ${entity.name} {`);

    (entity.fields || []).forEach((field) => {
      let tsType = 'string';
      if (field.type === 'INTEGER' || field.type === 'BIGINT' || field.type.includes('DECIMAL')) {
        tsType = 'number';
      } else if (field.type === 'BOOLEAN') {
        tsType = 'boolean';
      } else if (field.type.includes('TIMESTAMP')) {
        tsType = 'Date | string';
      } else if (field.type === 'JSON') {
        tsType = 'Record<string, unknown>';
      }

      const optionalMark = field.nullable && !field.pk ? '?' : '';
      lines.push(`  ${field.name}${optionalMark}: ${tsType};`);
    });

    lines.push('}\n');
  });

  return lines.join('\n');
}

/**
 * Pure generator: Mermaid.js ER Diagram
 * Uses standard crow's foot notations:
 * ||--|| (1:1), ||--o{ (1:N), }|--|{ (N:M)
 *
 * @param {object} ir
 * @returns {string}
 */
export function generateMermaid(ir) {
  if (!ir?.entities || Object.keys(ir.entities).length === 0) {
    return 'erDiagram\n';
  }

  const lines = ['erDiagram'];
  const entities = Object.values(ir.entities);
  const relationships = getDerivedRelationships(ir);

  // Render relationships
  relationships.forEach((rel) => {
    const symbol = rel.cardinality === '1 : 1' ? '||--||' : '||--o{';
    lines.push(`    ${rel.targetEntityName} ${symbol} ${rel.sourceEntityName} : "references"`);
  });

  // Render entity blocks with fields
  entities.forEach((entity) => {
    lines.push(`    ${entity.name} {`);
    (entity.fields || []).forEach((field) => {
      const typeClean = field.type.replace(/[(),\s]/g, '_');
      let constraint = '';
      if (field.pk) constraint = 'PK';
      else if (field.fk?.entityId) constraint = 'FK';
      else if (field.unique) constraint = 'UK';

      lines.push(`        ${typeClean} ${field.name} ${constraint}`.trimEnd());
    });
    lines.push('    }');
  });

  return lines.join('\n') + '\n';
}

/**
 * Pure generator: DBML (Database Markup Language for dbdiagram.io)
 * @param {object} ir
 * @returns {string}
 */
export function generateDBML(ir) {
  if (!ir?.entities || Object.keys(ir.entities).length === 0) return '';
  const lines = ['// DBML Schema generated by NexAI Data Modeling Studio\n'];

  const entities = Object.values(ir.entities);

  entities.forEach((entity) => {
    lines.push(`Table ${entity.name.toLowerCase()} {`);
    (entity.fields || []).forEach((field) => {
      const fieldType = field.type.toLowerCase();
      const settings = [];
      if (field.pk) settings.push('pk');
      if (field.unique) settings.push('unique');
      if (!field.nullable && !field.pk) settings.push('not null');

      const settingsStr = settings.length > 0 ? ` [${settings.join(', ')}]` : '';
      lines.push(`  ${field.name.toLowerCase()} ${fieldType}${settingsStr}`);
    });
    lines.push('}\n');
  });

  // DBML Relationships
  const relationships = getDerivedRelationships(ir);
  relationships.forEach((rel) => {
    const symbol = rel.cardinality === '1 : 1' ? '-' : '<';
    lines.push(
      `Ref: ${rel.targetEntityName.toLowerCase()}.${rel.targetFieldName.toLowerCase()} ${symbol} ${rel.sourceEntityName.toLowerCase()}.${rel.sourceFieldName.toLowerCase()}`
    );
  });

  return lines.join('\n') + '\n';
}

/**
 * Generate all dialect projections from canonical IR
 * @param {object} ir
 * @returns {object}
 */
export function generateAllProjections(ir) {
  return {
    sql: generateSQL(ir),
    prisma: generatePrisma(ir),
    mongoose: generateMongoose(ir),
    typescript: generateTypeScript(ir),
    mermaid: generateMermaid(ir),
    dbml: generateDBML(ir),
  };
}

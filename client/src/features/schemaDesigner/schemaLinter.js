/**
 * Deterministic Schema Linter & Health Score Engine
 * Analyzes Canonical IR against production database best practices.
 * Runs 100% locally with zero compute cost.
 */

/**
 * @typedef {object} LintIssue
 * @property {string} id
 * @property {string} code
 * @property {'error' | 'warning' | 'info'} severity
 * @property {string} title
 * @property {string} message
 * @property {string} entityId
 * @property {string} entityName
 * @property {string} [fieldId]
 * @property {string} [fieldName]
 * @property {string} [suggestion]
 * @property {boolean} canAutoFix
 */

/**
 * Analyzes an IR schema and returns lint issues and health score (0-100).
 *
 * @param {object} ir - Canonical IR
 * @returns {{ score: number, issues: Array<LintIssue>, summary: object }}
 */
export function lintSchema(ir) {
  if (!ir?.entities || Object.keys(ir.entities).length === 0) {
    return {
      score: 100,
      issues: [],
      summary: { errors: 0, warnings: 0, info: 0, grade: 'A+' },
    };
  }

  const issues = [];
  const entities = Object.values(ir.entities);
  const totalEntities = entities.length;

  entities.forEach((entity) => {
    const fields = entity.fields || [];

    // Rule 1: Missing Primary Key (High Severity: -15 pts)
    const hasPk = fields.some((f) => f.pk);
    if (!hasPk) {
      issues.push({
        id: `no-pk-${entity.id}`,
        code: 'MISSING_PRIMARY_KEY',
        severity: 'error',
        title: 'Missing Primary Key',
        message: `Entity "${entity.name}" does not have a primary key defined.`,
        entityId: entity.id,
        entityName: entity.name,
        suggestion: 'Add an "id" UUID or BIGINT field as Primary Key.',
        canAutoFix: true,
      });
    }

    // Rule 2: Foreign Key without Index (Medium Severity: -8 pts)
    fields.forEach((field) => {
      if (field.fk?.entityId) {
        // Check if index exists on this field
        const hasIndex = (entity.indexes || []).some((idx) =>
          (idx.fields || []).includes(field.name)
        );
        if (!hasIndex) {
          issues.push({
            id: `fk-no-index-${entity.id}-${field.id}`,
            code: 'UNINDEXED_FOREIGN_KEY',
            severity: 'warning',
            title: 'Unindexed Foreign Key',
            message: `Field "${entity.name}.${field.name}" is a Foreign Key but has no database index. This leads to slow JOIN queries and table locks during cascades.`,
            entityId: entity.id,
            entityName: entity.name,
            fieldId: field.id,
            fieldName: field.name,
            suggestion: `Add an index on "${field.name}".`,
            canAutoFix: true,
          });
        }
      }
    });

    // Rule 3: Missing Audit Timestamps (Low Severity: -4 pts)
    const hasCreatedAt = fields.some((f) =>
      ['createdat', 'created_at'].includes(f.name.toLowerCase())
    );
    const hasUpdatedAt = fields.some((f) =>
      ['updatedat', 'updated_at'].includes(f.name.toLowerCase())
    );

    if (!hasCreatedAt || !hasUpdatedAt) {
      issues.push({
        id: `no-audit-timestamps-${entity.id}`,
        code: 'MISSING_AUDIT_TIMESTAMPS',
        severity: 'info',
        title: 'Missing Audit Timestamps',
        message: `Entity "${entity.name}" is missing standard audit fields (${!hasCreatedAt ? 'createdAt ' : ''}${!hasUpdatedAt ? 'updatedAt' : ''}).`,
        entityId: entity.id,
        entityName: entity.name,
        suggestion: 'Add createdAt and updatedAt timestamp columns for change tracking.',
        canAutoFix: true,
      });
    }

    // Rule 4: Unbounded Generic VARCHAR / TEXT without constraint
    fields.forEach((field) => {
      if (field.type === 'VARCHAR(255)' && ['description', 'content', 'body', 'bio'].includes(field.name.toLowerCase())) {
        issues.push({
          id: `unbounded-desc-${entity.id}-${field.id}`,
          code: 'TYPE_PRECISION_MISMATCH',
          severity: 'info',
          title: 'Potential Type Truncation',
          message: `Field "${entity.name}.${field.name}" is typed as VARCHAR(255) but descriptive content might exceed 255 characters.`,
          entityId: entity.id,
          entityName: entity.name,
          fieldId: field.id,
          fieldName: field.name,
          suggestion: 'Change column type to TEXT.',
          canAutoFix: true,
        });
      }
    });

    // Rule 5: Orphan Entity in complex schema (Warning: -5 pts)
    if (totalEntities >= 3) {
      const hasOutgoingFk = fields.some((f) => f.fk?.entityId);
      const hasIncomingFk = entities.some(
        (other) =>
          other.id !== entity.id &&
          (other.fields || []).some((f) => f.fk?.entityId === entity.id)
      );

      if (!hasOutgoingFk && !hasIncomingFk) {
        issues.push({
          id: `orphan-entity-${entity.id}`,
          code: 'ORPHAN_ENTITY',
          severity: 'warning',
          title: 'Isolated / Orphan Entity',
          message: `Entity "${entity.name}" has no relationships with other tables in this schema.`,
          entityId: entity.id,
          entityName: entity.name,
          suggestion: 'Verify if this table should relate via a foreign key.',
          canAutoFix: false,
        });
      }
    }
  });

  // Calculate Health Score
  let score = 100;
  let errors = 0;
  let warnings = 0;
  let info = 0;

  issues.forEach((issue) => {
    if (issue.severity === 'error') {
      score -= 15;
      errors += 1;
    } else if (issue.severity === 'warning') {
      score -= 6;
      warnings += 1;
    } else {
      score -= 2;
      info += 1;
    }
  });

  score = Math.max(0, Math.min(100, Math.round(score)));

  let grade = 'A+';
  if (score < 50) grade = 'F';
  else if (score < 65) grade = 'D';
  else if (score < 75) grade = 'C';
  else if (score < 85) grade = 'B';
  else if (score < 95) grade = 'A';

  return {
    score,
    issues,
    summary: {
      errors,
      warnings,
      info,
      grade,
    },
  };
}

/**
 * Automatically applies a fix for a recognized linter issue to the IR
 *
 * @param {object} ir - Canonical IR (cloned or mutated)
 * @param {string} issueId
 * @returns {object} updated IR
 */
export function autoFixIssue(ir, issueId) {
  if (!ir?.entities) return ir;
  const nextEntities = { ...ir.entities };

  Object.values(nextEntities).forEach((entity) => {
    // Fix Missing PK
    if (issueId === `no-pk-${entity.id}`) {
      const updatedFields = [
        {
          id: `fld_pk_${Date.now().toString(36)}`,
          name: 'id',
          type: 'UUID',
          pk: true,
          unique: true,
          nullable: false,
          description: 'Primary identifier',
        },
        ...(entity.fields || []),
      ];
      nextEntities[entity.id] = { ...entity, fields: updatedFields };
    }

    // Fix Missing Audit Timestamps
    if (issueId === `no-audit-timestamps-${entity.id}`) {
      const fields = [...(entity.fields || [])];
      const hasCreatedAt = fields.some((f) => ['createdat', 'created_at'].includes(f.name.toLowerCase()));
      const hasUpdatedAt = fields.some((f) => ['updatedat', 'updated_at'].includes(f.name.toLowerCase()));

      if (!hasCreatedAt) {
        fields.push({
          id: `fld_cat_${Date.now().toString(36)}`,
          name: 'createdAt',
          type: 'TIMESTAMP',
          nullable: false,
          description: 'Record creation timestamp',
        });
      }
      if (!hasUpdatedAt) {
        fields.push({
          id: `fld_uat_${Date.now().toString(36)}`,
          name: 'updatedAt',
          type: 'TIMESTAMP',
          nullable: false,
          description: 'Record last updated timestamp',
        });
      }
      nextEntities[entity.id] = { ...entity, fields };
    }

    // Fix Type Precision Mismatch
    (entity.fields || []).forEach((field, fIdx) => {
      if (issueId === `unbounded-desc-${entity.id}-${field.id}`) {
        const nextFields = [...entity.fields];
        nextFields[fIdx] = { ...field, type: 'TEXT' };
        nextEntities[entity.id] = { ...entity, fields: nextFields };
      }
    });
  });

  return {
    ...ir,
    entities: nextEntities,
  };
}

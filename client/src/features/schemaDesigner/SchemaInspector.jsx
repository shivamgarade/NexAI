import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Table2,
  Code2,
  ShieldCheck,
  Activity,
  Plus,
  Trash2,
  Key,
  Link2,
  Copy,
  Check,
  Download,
  AlertCircle,
  AlertTriangle,
  Info,
  Sparkles,
  Edit2,
  CheckCircle2,
} from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { Button } from '@/components/ui';
import { toast } from '@/components/ui/Toast';
import styles from './SchemaInspector.module.scss';

const FIELD_TYPES = [
  'VARCHAR(255)',
  'UUID',
  'INTEGER',
  'BIGINT',
  'BOOLEAN',
  'TIMESTAMP',
  'TEXT',
  'JSON',
  'DECIMAL(12,2)',
];

const DIALECTS = [
  { id: 'mongoose', label: 'Mongoose (MongoDB)' },
  { id: 'sql', label: 'PostgreSQL (DDL)' },
  { id: 'prisma', label: 'Prisma Schema' },
  { id: 'typescript', label: 'TypeScript Interfaces' },
  { id: 'dbml', label: 'DBML (dbdiagram.io)' },
];

export function SchemaInspector() {
  const {
    ir,
    currentSchema,
    selectedEntityId,
    setSelectedEntityId,
    activeInspectorTab,
    setActiveInspectorTab,
    activeDialect,
    setActiveDialect,
    addField,
    updateField,
    deleteField,
    renameEntity,
    deleteEntity,
    healthScore,
    linterIssues,
    linterSummary,
    autoFixLinterIssue,
    telemetry,
  } = useSchemaStore();

  const [copied, setCopied] = useState(false);
  const [editingEntityName, setEditingEntityName] = useState(false);
  const [nameInput, setNameInput] = useState('');

  // Selected entity lookup
  const selectedEntity = useMemo(() => {
    if (!ir?.entities || !selectedEntityId) return null;
    return ir.entities[selectedEntityId] || Object.values(ir.entities).find((e) => e.name === selectedEntityId) || null;
  }, [ir, selectedEntityId]);

  const activeCode = currentSchema?.codeOutputs?.[activeDialect] || '';

  const handleCopyCode = async () => {
    if (!activeCode) return;
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const handleDownloadCode = () => {
    if (!activeCode) return;
    const extMap = {
      mongoose: 'models.js',
      sql: 'schema.sql',
      prisma: 'schema.prisma',
      typescript: 'types.ts',
      dbml: 'schema.dbml',
    };
    const filename = extMap[activeDialect] || 'schema.txt';
    const blob = new Blob([activeCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${filename}`);
  };

  const handleStartRename = () => {
    if (!selectedEntity) return;
    setNameInput(selectedEntity.name);
    setEditingEntityName(true);
  };

  const handleSaveRename = () => {
    if (selectedEntity && nameInput.trim()) {
      renameEntity(selectedEntity.id, nameInput.trim());
    }
    setEditingEntityName(false);
  };

  return (
    <aside className={styles.inspectorContainer}>
      {/* Inspector Segmented Tabs */}
      <div className={styles.tabBar} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeInspectorTab === 'fields'}
          className={`${styles.tabBtn} ${activeInspectorTab === 'fields' ? styles.tabActive : ''}`}
          onClick={() => setActiveInspectorTab('fields')}
        >
          <Table2 size={13} />
          <span>Fields</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeInspectorTab === 'code'}
          className={`${styles.tabBtn} ${activeInspectorTab === 'code' ? styles.tabActive : ''}`}
          onClick={() => setActiveInspectorTab('code')}
        >
          <Code2 size={13} />
          <span>Code</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeInspectorTab === 'lint'}
          className={`${styles.tabBtn} ${activeInspectorTab === 'lint' ? styles.tabActive : ''}`}
          onClick={() => setActiveInspectorTab('lint')}
        >
          <ShieldCheck size={13} />
          <span>Lint ({healthScore}%)</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeInspectorTab === 'telemetry'}
          className={`${styles.tabBtn} ${activeInspectorTab === 'telemetry' ? styles.tabActive : ''}`}
          onClick={() => setActiveInspectorTab('telemetry')}
        >
          <Activity size={13} />
          <span>Telemetry</span>
        </button>
      </div>

      <div className={styles.tabContent}>
        {/* TAB 1: FIELDS EDITOR */}
        {activeInspectorTab === 'fields' && (
          <div className={styles.fieldsPane}>
            {selectedEntity ? (
              <>
                <div className={styles.entityHeaderBar}>
                  <div className={styles.entityTitleArea}>
                    {editingEntityName ? (
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        onBlur={handleSaveRename}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename()}
                        autoFocus
                        className={styles.renameInput}
                      />
                    ) : (
                      <div className={styles.nameRow}>
                        <h3 className={styles.entityName}>{selectedEntity.name}</h3>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          onClick={handleStartRename}
                          title="Rename table"
                        >
                          <Edit2 size={12} />
                        </button>
                      </div>
                    )}
                    <span className={styles.fieldsCount}>
                      {selectedEntity.fields?.length || 0} fields
                    </span>
                  </div>

                  <button
                    type="button"
                    className={styles.deleteEntityBtn}
                    onClick={() => {
                      deleteEntity(selectedEntity.id);
                      setSelectedEntityId(null);
                    }}
                    title="Delete entity"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                {/* Fields Table */}
                <div className={styles.fieldsTableWrapper}>
                  <table className={styles.fieldsTable}>
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th title="Primary Key">PK</th>
                        <th title="Unique">UQ</th>
                        <th title="Nullable">Null</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedEntity.fields || []).map((field, idx) => (
                        <tr key={field.id || idx}>
                          <td>
                            <input
                              type="text"
                              value={field.name}
                              onChange={(e) =>
                                updateField(selectedEntity.id, field.id, { name: e.target.value })
                              }
                              className={styles.fieldNameInput}
                            />
                          </td>
                          <td>
                            <select
                              value={field.type}
                              onChange={(e) =>
                                updateField(selectedEntity.id, field.id, { type: e.target.value })
                              }
                              className={styles.typeSelect}
                            >
                              {FIELD_TYPES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className={styles.centerCell}>
                            <input
                              type="checkbox"
                              checked={Boolean(field.pk)}
                              onChange={(e) =>
                                updateField(selectedEntity.id, field.id, { pk: e.target.checked })
                              }
                              className={styles.checkbox}
                            />
                          </td>
                          <td className={styles.centerCell}>
                            <input
                              type="checkbox"
                              checked={Boolean(field.unique)}
                              onChange={(e) =>
                                updateField(selectedEntity.id, field.id, {
                                  unique: e.target.checked,
                                })
                              }
                              className={styles.checkbox}
                            />
                          </td>
                          <td className={styles.centerCell}>
                            <input
                              type="checkbox"
                              checked={Boolean(field.nullable)}
                              onChange={(e) =>
                                updateField(selectedEntity.id, field.id, {
                                  nullable: e.target.checked,
                                })
                              }
                              className={styles.checkbox}
                            />
                          </td>
                          <td className={styles.actionCell}>
                            <button
                              type="button"
                              className={styles.deleteFieldBtn}
                              onClick={() => deleteField(selectedEntity.id, field.id)}
                              title="Delete field"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className={styles.addFieldRow}>
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Plus size={13} />}
                    onClick={() =>
                      addField(selectedEntity.id, {
                        name: `col_${(selectedEntity.fields?.length || 0) + 1}`,
                        type: 'VARCHAR(255)',
                        nullable: true,
                      })
                    }
                  >
                    Add Field
                  </Button>
                </div>
              </>
            ) : (
              <div className={styles.emptySelectState}>
                <Table2 size={32} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No Entity Selected</p>
                <p className={styles.emptyDesc}>
                  Click any entity card on the ERD canvas or select below to edit its columns and
                  relationships.
                </p>

                <div className={styles.quickEntityList}>
                  {Object.values(ir?.entities || {}).map((ent) => (
                    <button
                      key={ent.id}
                      type="button"
                      className={styles.quickEntityPill}
                      onClick={() => setSelectedEntityId(ent.id)}
                    >
                      <span>{ent.name}</span>
                      <span className={styles.pillCount}>{ent.fields?.length || 0}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MULTI-DIALECT CODE */}
        {activeInspectorTab === 'code' && (
          <div className={styles.codePane}>
            <div className={styles.codeToolbar}>
              <select
                value={activeDialect}
                onChange={(e) => setActiveDialect(e.target.value)}
                className={styles.dialectDropdown}
              >
                {DIALECTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>

              <div className={styles.codeActions}>
                <button
                  type="button"
                  className={styles.codeActionBtn}
                  onClick={handleCopyCode}
                  title="Copy code"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
                <button
                  type="button"
                  className={styles.codeActionBtn}
                  onClick={handleDownloadCode}
                  title="Download file"
                >
                  <Download size={13} />
                </button>
              </div>
            </div>

            <div className={styles.codeView}>
              <pre className={styles.codePre}>
                <code>{activeCode || '// No code generated yet'}</code>
              </pre>
            </div>
          </div>
        )}

        {/* TAB 3: SCHEMA LINTER */}
        {activeInspectorTab === 'lint' && (
          <div className={styles.lintPane}>
            <div className={styles.lintScoreHero}>
              <div className={styles.lintScoreGauge}>
                <span
                  className={`${styles.lintScoreNum} ${
                    healthScore >= 90
                      ? styles.scoreGreen
                      : healthScore >= 70
                      ? styles.scoreYellow
                      : styles.scoreRed
                  }`}
                >
                  {healthScore}
                </span>
                <span className={styles.lintScoreMax}>/100</span>
              </div>
              <div className={styles.lintScoreMeta}>
                <span className={styles.lintGrade}>Grade: {linterSummary.grade}</span>
                <div className={styles.lintCounts}>
                  <span>{linterSummary.errors} errors</span> ·{' '}
                  <span>{linterSummary.warnings} warnings</span>
                </div>
              </div>
            </div>

            <div className={styles.lintIssuesScroll}>
              {linterIssues.length === 0 ? (
                <div className={styles.lintAllClean}>
                  <CheckCircle2 size={32} className="text-success" />
                  <h4>100% Normalized!</h4>
                  <p>All primary keys, constraints, and audit rules are satisfied.</p>
                </div>
              ) : (
                linterIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`${styles.lintCard} ${
                      issue.severity === 'error'
                        ? styles.lintCardError
                        : issue.severity === 'warning'
                        ? styles.lintCardWarn
                        : styles.lintCardInfo
                    }`}
                  >
                    <div className={styles.lintCardTop}>
                      {issue.severity === 'error' ? (
                        <AlertCircle size={14} className={styles.errIcon} />
                      ) : issue.severity === 'warning' ? (
                        <AlertTriangle size={14} className={styles.warnIcon} />
                      ) : (
                        <Info size={14} className={styles.infoIcon} />
                      )}
                      <span className={styles.lintCardTitle}>{issue.title}</span>
                      <span className={styles.lintEntityBadge}>{issue.entityName}</span>
                    </div>

                    <p className={styles.lintCardMsg}>{issue.message}</p>

                    {issue.canAutoFix && (
                      <div className={styles.lintFixRow}>
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Sparkles size={11} />}
                          onClick={() => autoFixLinterIssue(issue.id)}
                        >
                          Auto-Fix
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 4: TELEMETRY */}
        {activeInspectorTab === 'telemetry' && (
          <div className={styles.telemetryPane}>
            <div className={styles.telemetryCard}>
              <span className={styles.telLabel}>Active AI Model</span>
              <span className={styles.telValue}>{telemetry?.model || 'Gemini 2.5 Flash'}</span>
            </div>

            <div className={styles.telemetryCard}>
              <span className={styles.telLabel}>Tokens Consumed</span>
              <span className={styles.telValue}>{telemetry?.tokensUsed || 0} tokens</span>
            </div>

            <div className={styles.telemetryCard}>
              <span className={styles.telLabel}>Credits Deducted</span>
              <span className={styles.telValue}>{telemetry?.creditsDeducted || 0} credits</span>
            </div>

            <div className={styles.telemetryCard}>
              <span className={styles.telLabel}>API Response Time</span>
              <span className={styles.telValue}>{telemetry?.durationMs || 0} ms</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

SchemaInspector.propTypes = {};

import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Search,
  Globe,
  Code2,
  FileText,
  Brain,
  Star,
  Check,
  Zap,
  PenTool,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { TagInput } from '@/components/ui/TagInput';
import { cn } from '@/lib/utils/cn';
import styles from './SkillFormModal.module.scss';

const AVAILABLE_TOOLS = [
  { id: 'web_search', label: 'Web Search', icon: <Search size={14} />, desc: 'Google Search live web grounding' },
  { id: 'fetch_url', label: 'Web Scraper', icon: <Globe size={14} />, desc: 'Extract full page content from links' },
  { id: 'code_execution', label: 'Code Sandbox', icon: <Code2 size={14} />, desc: 'Execute Python code scripts' },
  { id: 'workspace_search', label: 'Workspace Files', icon: <FileText size={14} />, desc: 'Query project sources & documents' },
  { id: 'memory_search', label: 'Long-term Memory', icon: <Brain size={14} />, desc: 'Retrieve personal cross-chat memory' },
];

const CATEGORIES = ['Research', 'Coding', 'Writing', 'Analysis', 'Productivity', 'General'];
const ICONS = ['Zap', 'Search', 'Globe', 'Code2', 'FileText', 'PenTool'];

export function SkillFormModal({ open, onClose, initialData, onSubmit }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState('General');
  const [icon, setIcon] = useState('Zap');
  const [tools, setTools] = useState([]);
  const [tags, setTags] = useState([]);
  const [isFavorite, setIsFavorite] = useState(false);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialData) {
        setTitle(initialData.title || '');
        setDescription(initialData.description || '');
        setInstructions(initialData.instructions || initialData.template || '');
        setCategory(initialData.category || 'General');
        setIcon(initialData.icon || 'Zap');
        setTools(Array.isArray(initialData.tools) ? initialData.tools : []);
        setTags(initialData.tags || []);
        setIsFavorite(Boolean(initialData.isFavorite));
      } else {
        setTitle('');
        setDescription('');
        setInstructions('');
        setCategory('General');
        setIcon('Zap');
        setTools([]);
        setTags([]);
        setIsFavorite(false);
      }
      setErrors({});
      setIsSubmitting(false);
    }
  }, [open, initialData]);

  // Live variable extraction
  const detectedVariables = useMemo(() => {
    if (!instructions) return [];
    const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    const matches = [...instructions.matchAll(regex)];
    const vars = matches.map((m) => m[1].trim());
    return [...new Set(vars)];
  }, [instructions]);

  const toggleTool = (toolId) => {
    setTools((prev) =>
      prev.includes(toolId) ? prev.filter((id) => id !== toolId) : [...prev, toolId],
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Skill title is required';
    }
    if (!instructions.trim()) {
      newErrors.instructions = 'Skill instructions/prompt is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        instructions: instructions.trim(),
        template: instructions.trim(),
        category,
        icon,
        tools,
        tags,
        isFavorite,
      });
      onClose();
    } catch {
      // Error handled by caller
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? 'Edit AI Skill' : 'Create Custom AI Skill'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Skill Title</label>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: null }));
            }}
            placeholder="e.g. Next.js 15 Migrator & Refactorer"
            error={errors.title}
            autoFocus
          />
        </div>

        <div className={styles.row}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={styles.select}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Icon</label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className={styles.select}
            >
              {ICONS.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Description</label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short summary of what this skill accomplishes"
          />
        </div>

        {/* Enabled Tools Checklist */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Autonomous Agentic Tools</label>
          <div className={styles.toolsGrid}>
            {AVAILABLE_TOOLS.map((t) => {
              const active = tools.includes(t.id);
              return (
                <div
                  key={t.id}
                  className={cn(styles.toolToggle, active && styles.active)}
                  onClick={() => toggleTool(t.id)}
                  role="checkbox"
                  aria-checked={active}
                  tabIndex={0}
                >
                  {t.icon}
                  <span>{t.label}</span>
                  {active && <Check size={12} style={{ marginLeft: 'auto' }} />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Instructions / Template text */}
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            Skill System Instructions & Workflow (supports {'{{variables}}'})
          </label>
          <textarea
            value={instructions}
            onChange={(e) => {
              setInstructions(e.target.value);
              if (errors.instructions) setErrors((prev) => ({ ...prev, instructions: null }));
            }}
            placeholder="You are an expert... When asked to migrate {{ component_name }} to Next.js 15, inspect {{ repo_url }} and..."
            className={styles.textarea}
          />
          {errors.instructions && (
            <span style={{ color: 'var(--color-error)', fontSize: 12 }}>{errors.instructions}</span>
          )}
        </div>

        {detectedVariables.length > 0 && (
          <div className={styles.variablesSection}>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)' }}>
              Detected Parameters ({detectedVariables.length}):
            </span>
            <div className={styles.variableChips}>
              {detectedVariables.map((v) => (
                <span key={v} className={styles.variableChip}>
                  {`{{ ${v} }}`}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className={styles.fieldGroup}>
          <label className={styles.label}>Tags</label>
          <TagInput tags={tags} onChange={setTags} placeholder="Add a tag..." />
        </div>

        <div className={styles.actions}>
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {initialData ? 'Update Skill' : 'Create Skill'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

SkillFormModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  onSubmit: PropTypes.func.isRequired,
};

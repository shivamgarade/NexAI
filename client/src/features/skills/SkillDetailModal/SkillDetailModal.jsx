import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Modal,
} from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import {
  Zap,
  Copy,
  Check,
  Search,
  Globe,
  Code2,
  FileText,
  Brain,
  Sparkles,
} from 'lucide-react';
import { toast } from '@/store/uiStore';
import styles from './SkillDetailModal.module.scss';

export function SkillDetailModal({ open, onClose, skill, onUse }) {
  const [copied, setCopied] = useState(false);

  if (!skill) return null;

  const rawInstructions = skill.instructions || skill.template || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawInstructions);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Skill instructions copied');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={skill.title} size="md">
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.meta}>
            {skill.category && <span className={styles.badge}>{skill.category}</span>}
            {skill.isSystem ? (
              <span className={styles.systemBadge}>Built-in System Skill</span>
            ) : (
              <span className={styles.customBadge}>Custom User Skill</span>
            )}
          </div>
          <p className={styles.description}>{skill.description}</p>
        </div>

        {Array.isArray(skill.tools) && skill.tools.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Enabled Agentic Tools</span>
            <div className={styles.toolsList}>
              {skill.tools.map((tool) => (
                <div key={tool} className={styles.toolChip}>
                  {tool === 'web_search' && <Search size={12} />}
                  {tool === 'fetch_url' && <Globe size={12} />}
                  {tool === 'code_execution' && <Code2 size={12} />}
                  {tool === 'workspace_search' && <FileText size={12} />}
                  {tool === 'memory_search' && <Brain size={12} />}
                  <span>{tool.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(skill.variables) && skill.variables.length > 0 && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>Dynamic Parameters</span>
            <div className={styles.varsList}>
              {skill.variables.map((v) => (
                <code key={v} className={styles.varCode}>
                  {`{{ ${v} }}`}
                </code>
              ))}
            </div>
          </div>
        )}

        <div className={styles.section}>
          <div className={styles.instructionsHeader}>
            <span className={styles.sectionTitle}>System Directives & Instructions</span>
            <button type="button" className={styles.copyBtn} onClick={handleCopy}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <pre className={styles.codeBlock}>{rawInstructions}</pre>
        </div>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            rightIcon={<Zap size={14} />}
            onClick={() => {
              onClose();
              onUse?.(skill);
            }}
          >
            Use Skill in Chat
          </Button>
        </div>
      </div>
    </Modal>
  );
}

SkillDetailModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  skill: PropTypes.object,
  onUse: PropTypes.func,
};

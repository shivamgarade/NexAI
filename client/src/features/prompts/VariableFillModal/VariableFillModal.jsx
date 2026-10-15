import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Copy, Check, Sparkles, Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { toast } from '@/store/uiStore';
import styles from './VariableFillModal.module.scss';

export function VariableFillModal({
  open,
  onClose,
  prompt,
  skill,
  onConfirm,
  actionLabel = 'Use Prompt in Chat',
}) {
  const targetItem = skill || prompt;
  const [values, setValues] = useState({});
  const [copied, setCopied] = useState(false);

  const variables = useMemo(() => {
    return targetItem?.variables || [];
  }, [targetItem]);

  useEffect(() => {
    if (open && targetItem) {
      const initial = {};
      (targetItem.variables || []).forEach((v) => {
        initial[v] = '';
      });
      setValues(initial);
      setCopied(false);
    }
  }, [open, targetItem]);

  // Real-time compilation of the template with user substituted variables
  const compiledPrompt = useMemo(() => {
    const templateText = targetItem?.template || targetItem?.instructions;
    if (!templateText) return '';
    let result = templateText;
    const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
    result = result.replace(regex, (match, varName) => {
      const trimmed = varName.trim();
      const val = values[trimmed];
      return val !== undefined && val !== '' ? val : match;
    });
    return result;
  }, [targetItem, values]);

  const handleValueChange = (varName, val) => {
    setValues((prev) => ({ ...prev, [varName]: val }));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(compiledPrompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Compiled prompt copied to clipboard');
    } catch {
      toast.error('Failed to copy prompt');
    }
  };

  const handleConfirm = () => {
    onConfirm?.(compiledPrompt);
    onClose?.();
  };

  if (!prompt) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Use Prompt: ${prompt.title}`}
      className={styles.modalContent}
      footer={
        <div className={styles.footerButtons}>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
            onClick={handleCopy}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="primary"
            leftIcon={<Send size={14} />}
            onClick={handleConfirm}
          >
            {actionLabel}
          </Button>
        </div>
      }
    >
      <div className={styles.container}>
        {variables.length > 0 ? (
          <div className={styles.variablesSection}>
            <div className={styles.sectionHeader}>
              <Sparkles size={15} className={styles.sectionIcon} />
              <span className={styles.sectionTitle}>Fill Template Variables</span>
            </div>
            <div className={styles.variableInputs}>
              {variables.map((v) => {
                // If the variable name suggests long text (e.g. code, content, body), use Textarea
                const isLongText = /code|content|body|context|text|document/i.test(v);
                return isLongText ? (
                  <Textarea
                    key={v}
                    label={`{{${v}}}`}
                    placeholder={`Enter value for ${v}...`}
                    value={values[v] || ''}
                    onChange={(e) => handleValueChange(v, e.target.value)}
                    rows={3}
                  />
                ) : (
                  <Input
                    key={v}
                    label={`{{${v}}}`}
                    placeholder={`Enter value for ${v}...`}
                    value={values[v] || ''}
                    onChange={(e) => handleValueChange(v, e.target.value)}
                  />
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.staticNotice}>
            <p>This prompt has no dynamic variables and is ready to insert directly.</p>
          </div>
        )}

        <div className={styles.previewSection}>
          <div className={styles.previewHeader}>
            <span className={styles.previewLabel}>Live Preview</span>
          </div>
          <div className={styles.previewBox}>
            <pre className={styles.previewText}>{compiledPrompt}</pre>
          </div>
        </div>
      </div>
    </Modal>
  );
}

VariableFillModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  prompt: PropTypes.shape({
    _id: PropTypes.string,
    title: PropTypes.string,
    template: PropTypes.string,
    variables: PropTypes.arrayOf(PropTypes.string),
  }),
  onConfirm: PropTypes.func,
  actionLabel: PropTypes.string,
};

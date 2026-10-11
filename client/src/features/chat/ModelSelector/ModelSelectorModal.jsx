import PropTypes from 'prop-types';
import {
  Sparkles,
  Zap,
  Brain,
  Check,
  Cpu,
  Layers,
  X,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useChatStore, AVAILABLE_MODELS } from '@/store/chatStore';
import { cn } from '@/lib/utils/cn';
import styles from './ModelSelectorModal.module.scss';

const THINKING_LEVELS = [
  {
    id: 'off',
    name: 'Off',
    desc: 'Instant streaming without reasoning traces',
  },
  {
    id: 'low',
    name: 'Low',
    desc: 'Light reasoning budget (~1K thought tokens)',
  },
  {
    id: 'medium',
    name: 'Medium',
    desc: 'Balanced step-by-step logic and validation',
  },
  {
    id: 'high',
    name: 'High',
    desc: 'Exhaustive analytical depth for complex architecture',
  },
];

export function ModelSelectorModal({ open, onClose }) {
  const {
    selectedModel,
    setSelectedModel,
    thinkingLevel,
    setThinkingLevel,
  } = useChatStore();

  const handleSelectModel = (modelId) => {
    setSelectedModel(modelId);
  };

  const handleSelectThinking = (level) => {
    setThinkingLevel(level);
  };

  return (
    <Modal open={open} onClose={onClose} title="AI Model & Reasoning Engine" size="md">
      <div className={styles.modalContent}>
        {/* Thinking / Reasoning Effort Section */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleWrapper}>
              <Brain size={16} className={styles.sectionIcon} />
              <h3 className={styles.sectionTitle}>Thinking &amp; Reasoning Depth</h3>
            </div>
            <span className={styles.currentThinkingBadge}>
              Current: {thinkingLevel.toUpperCase()}
            </span>
          </div>

          <div className={styles.thinkingGrid}>
            {THINKING_LEVELS.map((lvl) => {
              const isSelected = thinkingLevel === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  className={cn(styles.thinkingCard, isSelected && styles.activeThinkingCard)}
                  onClick={() => handleSelectThinking(lvl.id)}
                >
                  <div className={styles.thinkingCardHeader}>
                    <span className={styles.thinkingName}>{lvl.name}</span>
                    {isSelected && <Check size={14} className={styles.selectedCheck} />}
                  </div>
                  <p className={styles.thinkingDesc}>{lvl.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Available Models List */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitleWrapper}>
              <Cpu size={16} className={styles.sectionIcon} />
              <h3 className={styles.sectionTitle}>Select Model</h3>
            </div>
            <span className={styles.sectionHint}>
              Active models route natively; previews use Gemini bridge
            </span>
          </div>

          <div className={styles.modelList}>
            {AVAILABLE_MODELS.map((m) => {
              const isSelected = selectedModel === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={cn(styles.modelRow, isSelected && styles.activeModelRow)}
                  onClick={() => handleSelectModel(m.id)}
                >
                  <div className={styles.modelInfoCol}>
                    <div className={styles.modelTitleRow}>
                      <span className={styles.modelName}>{m.name}</span>
                      <span
                        className={cn(
                          styles.modelBadge,
                          m.isLive ? styles.liveBadge : styles.previewBadge,
                        )}
                      >
                        {m.badge}
                      </span>
                      <span className={styles.providerTag}>{m.provider}</span>
                    </div>
                    <p className={styles.modelTagline}>{m.tagline}</p>
                  </div>

                  <div className={styles.modelMetaCol}>
                    <div className={styles.speedIntelTags}>
                      <span className={styles.tag}>{m.speed}</span>
                    </div>
                    {isSelected && (
                      <div className={styles.checkWrapper}>
                        <Check size={16} className={styles.modelCheck} />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.footerRow}>
          <button type="button" className={styles.doneBtn} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}

ModelSelectorModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

import { useState, useRef, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Check, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import { useChatStore, AVAILABLE_MODELS, MORE_MODELS, EFFORT_LEVELS } from '@/store/chatStore';
import { cn } from '@/lib/utils/cn';
import styles from './ModelSelectorPopover.module.scss';

export function ModelSelectorPopover({ open, onClose, anchorRef, placement = 'top' }) {
  const {
    selectedModel,
    setSelectedModel,
    thinkingLevel,
    setThinkingLevel,
  } = useChatStore();

  // Navigation state: 'root' | 'effort' | 'models'
  const [currentView, setCurrentView] = useState('root');
  const popoverRef = useRef(null);

  // All known models
  const allModels = useMemo(() => [...AVAILABLE_MODELS, ...MORE_MODELS], []);

  // Currently active model object
  const activeModelObj = useMemo(() => {
    return (
      allModels.find((m) => m.id === selectedModel) ||
      AVAILABLE_MODELS.find((m) => m.id === 'flash') ||
      AVAILABLE_MODELS[0]
    );
  }, [allModels, selectedModel]);

  const currentEffortObj = useMemo(() => {
    return EFFORT_LEVELS.find((e) => e.id === thinkingLevel) || EFFORT_LEVELS[1];
  }, [thinkingLevel]);

  // Reset to root view whenever popover is closed or opened
  useEffect(() => {
    if (!open) {
      setCurrentView('root');
      return;
    }

    const handleClickOutside = (e) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target) &&
        (!anchorRef?.current || !anchorRef.current.contains(e.target))
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const handleSelectModel = (modelId) => {
    setSelectedModel(modelId);
    setCurrentView('root');
  };

  const handleSelectEffort = (effortId) => {
    setThinkingLevel(effortId);
    setCurrentView('root');
  };

  return (
    <div
      className={cn(styles.popoverWrapper, styles[placement])}
      ref={popoverRef}
      role="dialog"
      aria-label="Select AI Model and Effort"
    >
      <div className={styles.compactCard}>
        {/* VIEW 1: ROOT VIEW */}
        {currentView === 'root' && (
          <div className={styles.viewContent}>
            {/* Selected Model Card */}
            <div className={styles.selectedModelBox}>
              <div className={styles.selectedInfo}>
                <div className={styles.titleLine}>
                  <span className={styles.modelName}>{activeModelObj.name}</span>
                  {activeModelObj.badge && (
                    <span className={styles.badge}>{activeModelObj.badge}</span>
                  )}
                </div>
                <span className={styles.tagline}>
                  {activeModelObj.tagline || 'Selected reasoning model'}
                </span>
              </div>
              <div className={styles.checkWrap}>
                <Check size={16} className={styles.checkIcon} />
              </div>
            </div>

            <div className={styles.divider} />

            {/* Effort Trigger */}
            <button
              type="button"
              className={styles.navRow}
              onClick={() => setCurrentView('effort')}
            >
              <span className={styles.navLabel}>Effort</span>
              <div className={styles.navValueWrap}>
                <span className={styles.navValue}>{currentEffortObj.name}</span>
                <ChevronRight size={14} className={styles.chevronIcon} />
              </div>
            </button>

            {/* More Models Trigger */}
            <button
              type="button"
              className={styles.navRow}
              onClick={() => setCurrentView('models')}
            >
              <span className={styles.navLabel}>More models</span>
              <div className={styles.navValueWrap}>
                <ChevronRight size={14} className={styles.chevronIcon} />
              </div>
            </button>
          </div>
        )}

        {/* VIEW 2: EFFORT VIEW */}
        {currentView === 'effort' && (
          <div className={styles.viewContent}>
            <div className={styles.viewHeader}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setCurrentView('root')}
                aria-label="Back to model settings"
              >
                <ChevronLeft size={16} />
                <span>Effort</span>
              </button>
            </div>

            <p className={styles.effortHint}>
              Higher effort means more thorough responses, but takes longer and uses limits faster.
            </p>

            <div className={styles.optionsList}>
              {EFFORT_LEVELS.map((effort) => {
                const isSelected = thinkingLevel === effort.id;
                return (
                  <button
                    key={effort.id}
                    type="button"
                    className={cn(styles.optionRow, isSelected && styles.selectedOption)}
                    onClick={() => handleSelectEffort(effort.id)}
                  >
                    <div className={styles.optionInfo}>
                      <span className={styles.optionName}>{effort.name}</span>
                      {effort.badge && (
                        <span className={styles.recommendBadge}>{effort.badge}</span>
                      )}
                      {effort.warning && (
                        <span className={styles.warningBadge}>
                          <AlertTriangle size={11} />
                          {effort.warning}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check size={15} className={styles.checkIcon} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW 3: MORE MODELS VIEW */}
        {currentView === 'models' && (
          <div className={styles.viewContent}>
            <div className={styles.viewHeader}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => setCurrentView('root')}
                aria-label="Back to model settings"
              >
                <ChevronLeft size={16} />
                <span>More models</span>
              </button>
            </div>

            <div className={cn(styles.optionsList, styles.scrollableList)}>
              {allModels.map((model) => {
                const isSelected = selectedModel === model.id;
                return (
                  <button
                    key={model.id}
                    type="button"
                    className={cn(styles.optionRow, isSelected && styles.selectedOption)}
                    onClick={() => handleSelectModel(model.id)}
                  >
                    <div className={styles.optionInfo}>
                      <div className={styles.titleLine}>
                        <span className={styles.optionName}>{model.name}</span>
                        {model.badge && (
                          <span className={styles.badge}>{model.badge}</span>
                        )}
                      </div>
                      {model.tagline && (
                        <span className={styles.tagline}>{model.tagline}</span>
                      )}
                    </div>

                    <div className={styles.actionWrap}>
                      {isSelected ? (
                        <Check size={15} className={styles.checkIcon} />
                      ) : model.tierRequired ? (
                        <span className={styles.upgradeTag}>Upgrade</span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ModelSelectorPopover.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  anchorRef: PropTypes.object,
  placement: PropTypes.oneOf(['top', 'bottom']),
};

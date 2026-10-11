import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Globe,
  Search,
  Code2,
  FileText,
  Brain,
  ExternalLink,
  ChevronDown,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import styles from './AgentStepTimeline.module.scss';

export function AgentStepTimeline({
  steps = [],
  groundingMetadata = null,
  isStreaming = false,
}) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);

  const sources = useMemo(() => {
    return groundingMetadata?.sources || [];
  }, [groundingMetadata]);

  const hasContent = (steps && steps.length > 0) || sources.length > 0;

  if (!hasContent) {
    return null;
  }

  const isRunning = isStreaming && steps.some((s) => s.status === 'running');

  // Determine primary tool or title
  const headerSummary = isRunning
    ? 'Agent executing actions...'
    : `Agent completed ${steps.length} ${steps.length === 1 ? 'action' : 'actions'}${sources.length > 0 ? ` with ${sources.length} sources` : ''}`;

  const renderToolIcon = (tool, type) => {
    if (type === 'code_execution' || tool === 'code_execution') {
      return <Code2 size={14} className={styles.stepToolIcon} />;
    }
    if (tool === 'web_search') {
      return <Search size={14} className={styles.stepToolIcon} />;
    }
    if (tool === 'fetch_url') {
      return <Globe size={14} className={styles.stepToolIcon} />;
    }
    if (tool === 'workspace_search') {
      return <FileText size={14} className={styles.stepToolIcon} />;
    }
    if (tool === 'memory_search') {
      return <Brain size={14} className={styles.stepToolIcon} />;
    }
    return <Sparkles size={14} className={styles.stepToolIcon} />;
  };

  return (
    <div className={styles.timelineContainer}>
      <button
        type="button"
        className={styles.timelineHeader}
        onClick={() => setIsExpanded((prev) => !prev)}
        aria-expanded={isExpanded}
      >
        <div className={styles.headerLeft}>
          <div
            className={cn(
              styles.statusIndicator,
              isRunning ? styles.running : styles.completed,
            )}
          >
            {isRunning ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          </div>
          <span className={styles.headerTitle}>{headerSummary}</span>
        </div>

        <div className={styles.headerBadges}>
          {sources.length > 0 && (
            <span className={styles.badgePill}>{sources.length} web sources</span>
          )}
          <ChevronDown
            size={14}
            className={cn(styles.chevronIcon, isExpanded && styles.rotated)}
          />
        </div>
      </button>

      {isExpanded && (
        <div className={styles.timelineBody}>
          {steps.map((step, idx) => (
            <div key={step.id || `step-${idx}`} className={styles.stepItem}>
              <div className={styles.stepHeader}>
                <div className={styles.stepIconAndTitle}>
                  {renderToolIcon(step.tool, step.type)}
                  <span>{step.title || `Action: ${step.tool || step.type}`}</span>
                </div>
                <span
                  className={cn(
                    styles.stepStatusTag,
                    step.status === 'running'
                      ? styles.running
                      : step.status === 'failed'
                        ? styles.failed
                        : styles.completed,
                  )}
                >
                  {step.status || 'completed'}
                </span>
              </div>

              {step.input && (
                <div className={styles.stepDetails}>
                  <strong>Input: </strong>
                  {typeof step.input === 'object'
                    ? JSON.stringify(step.input, null, 2)
                    : String(step.input)}
                </div>
              )}

              {step.output && (
                <div className={styles.stepDetails}>
                  <strong>Output: </strong>
                  {typeof step.output === 'object'
                    ? JSON.stringify(step.output, null, 2)
                    : String(step.output)}
                </div>
              )}
            </div>
          ))}

          {sources.length > 0 && (
            <div className={styles.citationsBlock}>
              <span className={styles.citationsLabel}>Web Citations & Sources</span>
              <div className={styles.citationsList}>
                {sources.map((src, idx) => (
                  <a
                    key={`${src.url || src.uri}-${idx}`}
                    href={src.url || src.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.citationLink}
                    title={src.title || src.url || src.uri}
                  >
                    <Globe size={11} />
                    <span>{src.title || (src.url || src.uri || '').replace(/^https?:\/\/(www\.)?/, '').slice(0, 30)}</span>
                    <ExternalLink size={10} />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

AgentStepTimeline.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.object),
  groundingMetadata: PropTypes.shape({
    webSearchQueries: PropTypes.arrayOf(PropTypes.string),
    sources: PropTypes.arrayOf(
      PropTypes.shape({
        title: PropTypes.string,
        url: PropTypes.string,
      }),
    ),
  }),
  isStreaming: PropTypes.bool,
};

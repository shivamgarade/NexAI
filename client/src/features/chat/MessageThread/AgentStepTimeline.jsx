import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import {
  Globe,
  Code2,
  FileText,
  ExternalLink,
  ChevronDown,
  Loader2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import styles from './AgentStepTimeline.module.scss';

function GoogleIcon({ size = 14, className }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </svg>
  );
}

GoogleIcon.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};

function MonitorIcon({ size = 14, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <line x1="8" x2="16" y1="21" y2="21" />
      <line x1="12" x2="12" y1="17" y2="21" />
    </svg>
  );
}

MonitorIcon.propTypes = {
  size: PropTypes.number,
  className: PropTypes.string,
};

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

  // Header summary matching clean Gemini-style title
  const headerSummary = isRunning
    ? 'Agent executing actions...'
    : `Agent completed ${steps.length} ${steps.length === 1 ? 'action' : 'actions'}${sources.length > 0 ? ` with ${sources.length} sources` : ''}`;

  const renderNodeIcon = (step) => {
    if (step.status === 'running') {
      return <Loader2 size={13} className={cn(styles.nodeIcon, styles.spin)} />;
    }
    const tool = step.tool;
    const type = step.type;
    if (tool === 'web_search' || tool === 'google_search') {
      return <GoogleIcon size={14} className={styles.googleIcon} />;
    }
    if (tool === 'fetch_url' || tool === 'browse' || type === 'browse') {
      return <MonitorIcon size={13} className={styles.nodeIcon} />;
    }
    if (type === 'code_execution' || tool === 'code_execution') {
      return <Code2 size={13} className={styles.nodeIcon} />;
    }
    if (tool === 'workspace_search' || type === 'file') {
      return <FileText size={13} className={styles.nodeIcon} />;
    }
    return <Clock size={13} className={styles.nodeIcon} />;
  };

  return (
    <div className={styles.timelineContainer}>
      <div className={styles.timelineHeaderRow}>
        <button
          type="button"
          className={styles.timelineToggleBtn}
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-label="Toggle agent execution actions"
        >
          <span className={styles.headerTitle}>{headerSummary}</span>
          <ChevronDown
            size={14}
            className={cn(styles.chevronIcon, isExpanded && styles.chevronRotated)}
          />
        </button>

        {sources.length > 0 && (
          <span className={styles.badgePill}>{sources.length} web sources</span>
        )}
      </div>

      {isExpanded && (
        <div className={styles.timelineBody} role="region" aria-label="Agent execution steps">
          <div className={styles.timelineList}>
            {steps.map((step, idx) => {
              const stepId = step.id || `step-${idx}`;
              const isLast = idx === steps.length - 1;
              return (
                <div key={stepId} className={styles.timelineItem}>
                  <div className={styles.iconColumn}>
                    <div className={styles.nodeIconWrapper}>
                      {renderNodeIcon(step)}
                    </div>
                    {!isLast && <div className={styles.connectingLine} />}
                  </div>

                  <div className={styles.itemContent}>
                    <div className={styles.itemTitle}>
                      {step.title || `Action: ${step.tool || step.type}`}
                    </div>
                    {typeof step.output === 'string' && step.output && (
                      <div className={styles.itemOutput}>{step.output}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {sources.length > 0 && (
            <div className={styles.citationsContainer}>
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
                    <Globe size={11} className={styles.citationIcon} />
                    <span className={styles.citationText}>
                      {src.title || (src.url || src.uri || '').replace(/^https?:\/\/(www\.)?/, '').slice(0, 32)}
                    </span>
                    <ExternalLink size={9} className={styles.citationExt} />
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
        uri: PropTypes.string,
      }),
    ),
  }),
  isStreaming: PropTypes.bool,
};

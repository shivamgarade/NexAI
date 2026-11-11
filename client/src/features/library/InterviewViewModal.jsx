import { useState } from 'react';
import {
  Mic,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Target,
  User,
  Bot,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useLibraryStore } from '@/store/libraryStore';
import { formatDate } from '@/lib/utils/formatDate';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/utils/cn';
import styles from './InterviewViewModal.module.scss';

export function InterviewViewModal() {
  const { isViewInterviewModalOpen, viewingInterview, closeViewInterviewModal } =
    useLibraryStore();

  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  if (!viewingInterview) return null;

  const scorecard = viewingInterview.scorecard || {};
  const {
    overallScore = 0,
    rating = 'Completed',
    categories = {},
    strengths = [],
    improvements = [],
    summary = viewingInterview.summary || '',
    recommendedTopics = [],
  } = scorecard;

  const transcript = viewingInterview.transcript || [];

  const handleCopyReport = async () => {
    const reportText = `MOCK INTERVIEW EVALUATION: ${viewingInterview.title}
Score: ${overallScore}/100 (${rating})
Role: ${viewingInterview.role || 'Candidate'}
Difficulty: ${viewingInterview.difficulty || 'N/A'}
Topic: ${viewingInterview.topic || 'N/A'}

SUMMARY:
${summary}

CATEGORIES:
- Technical Accuracy: ${categories.technicalAccuracy || 0}%
- Problem Solving: ${categories.problemSolving || 0}%
- Communication: ${categories.communication || 0}%
- System Design: ${categories.systemDesign || 0}%

STRENGTHS:
${strengths.map((s) => `• ${s}`).join('\n')}

AREAS FOR IMPROVEMENT:
${improvements.map((i) => `• ${i}`).join('\n')}`;

    try {
      await navigator.clipboard.writeText(reportText);
      setHasCopied(true);
      toast.success('Interview scorecard copied');
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      toast.error('Failed to copy report');
    }
  };

  const getScoreColorClass = (score) => {
    if (score >= 85) return styles.scoreSuccess;
    if (score >= 70) return styles.scoreAccent;
    if (score >= 50) return styles.scoreWarning;
    return styles.scoreDanger;
  };

  return (
    <Modal
      open={isViewInterviewModalOpen}
      onClose={closeViewInterviewModal}
      title=""
      size="lg"
    >
      <div className={styles.modalContent}>
        {/* Header Hero */}
        <div className={styles.modalHeader}>
          <div className={styles.headerLeft}>
            <div className={styles.metaRow}>
              <div className={styles.typeIcon}>
                <Mic size={16} />
              </div>
              <Badge variant="accent" size="sm">
                MOCK INTERVIEW
              </Badge>
              {viewingInterview.difficulty && (
                <Badge variant="secondary" size="sm">
                  {viewingInterview.difficulty}
                </Badge>
              )}
              <span className={styles.headerDate}>
                {formatDate(viewingInterview.createdAt)}
              </span>
            </div>
            <h2 className={styles.title}>{viewingInterview.title}</h2>
            {viewingInterview.topic && (
              <p className={styles.topicText}>{viewingInterview.topic}</p>
            )}
          </div>

          {overallScore !== undefined && (
            <div className={styles.scoreDial}>
              <div className={cn(styles.scoreCircle, getScoreColorClass(overallScore))}>
                <span className={styles.scoreNum}>{overallScore}</span>
                <span className={styles.scoreTotal}>/100</span>
              </div>
              <span className={styles.ratingText}>{rating}</span>
            </div>
          )}
        </div>

        {/* Competency Bars */}
        <div className={styles.competencySection}>
          <h3 className={styles.sectionHeading}>
            <Target size={15} />
            Evaluated Competencies
          </h3>

          <div className={styles.catGrid}>
            {[
              { label: 'Technical Accuracy', score: categories.technicalAccuracy ?? 0 },
              { label: 'Problem Solving', score: categories.problemSolving ?? 0 },
              { label: 'Communication', score: categories.communication ?? 0 },
              { label: 'System Design', score: categories.systemDesign ?? 0 },
            ].map((cat, i) => (
              <div key={i} className={styles.catItem}>
                <div className={styles.catMeta}>
                  <span className={styles.catLabel}>{cat.label}</span>
                  <span className={styles.catScore}>{cat.score}%</span>
                </div>
                <div className={styles.catBarBg}>
                  <div
                    className={cn(styles.catBarFill, getScoreColorClass(cat.score))}
                    style={{ width: `${Math.min(100, Math.max(0, cat.score))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <div className={styles.summarySection}>
            <h3 className={styles.sectionHeading}>
              <Lightbulb size={15} />
              Examiner Assessment Summary
            </h3>
            <p className={styles.summaryBody}>{summary}</p>

            {recommendedTopics && recommendedTopics.length > 0 && (
              <div style={{ marginTop: '12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {recommendedTopics.map((topic, i) => (
                  <Badge key={i} variant="secondary" size="sm">
                    {topic}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Strengths & Improvements */}
        <div className={styles.feedbackGrid}>
          {strengths.length > 0 && (
            <div className={styles.feedbackCard}>
              <div className={styles.feedbackTitle}>
                <CheckCircle2 size={16} className={styles.successIcon} />
                <span>Observed Strengths</span>
              </div>
              <ul className={styles.bulletList}>
                {strengths.map((item, idx) => (
                  <li key={idx} className={styles.bulletItem}>
                    <span className={styles.checkIcon}>✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {improvements.length > 0 && (
            <div className={styles.feedbackCard}>
              <div className={styles.feedbackTitle}>
                <AlertTriangle size={16} className={styles.warningIcon} />
                <span>Areas for Growth</span>
              </div>
              <ul className={styles.bulletList}>
                {improvements.map((item, idx) => (
                  <li key={idx} className={styles.bulletItem}>
                    <span className={styles.warnIcon}>!</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Collapsible Transcript */}
        {transcript.length > 0 && (
          <div className={styles.transcriptSection}>
            <button
              type="button"
              className={styles.transcriptToggle}
              onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
            >
              <span>Archived Transcript ({transcript.length} turns)</span>
              {isTranscriptOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {isTranscriptOpen && (
              <div className={styles.transcriptList}>
                {transcript.map((m, idx) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={idx}
                      className={cn(
                        styles.transcriptMessage,
                        isUser ? styles.userTurn : styles.assistantTurn,
                      )}
                    >
                      <div className={styles.msgHeader}>
                        <span className={styles.msgRole}>
                          {isUser ? <User size={12} /> : <Bot size={12} />}
                          {isUser ? 'Candidate' : 'Interviewer'}
                        </span>
                      </div>
                      <p className={styles.msgContent}>{m.content}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className={styles.modalFooter}>
          <Button
            variant="secondary"
            size="md"
            onClick={handleCopyReport}
            leftIcon={hasCopied ? <Check size={14} /> : <Copy size={14} />}
          >
            {hasCopied ? 'Copied' : 'Copy Scorecard'}
          </Button>

          <Button variant="primary" size="md" onClick={closeViewInterviewModal}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Bookmark,
  RotateCcw,
  Copy,
  Check,
  Target,
  ArrowLeft,
  Plus,
  Sparkles,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { ROUTES } from '@/constants/routes';
import { usePromptStore } from '@/store/promptStore';
import { cn } from '@/lib/utils/cn';
import styles from './Scorecard.module.scss';

export function Scorecard({
  session,
  scorecard,
  onReset,
}) {
  const navigate = useNavigate();
  const [hasCopied, setHasCopied] = useState(false);

  if (!scorecard) {
    return (
      <Card className={styles.loadingCard} padding="lg">
        <p>No evaluation scorecard available.</p>
        <Button variant="primary" onClick={onReset}>
          Return to Setup
        </Button>
      </Card>
    );
  }

  const {
    overallScore = 0,
    rating = 'Hire',
    categories = {},
    strengths = [],
    improvements = [],
    summary = '',
    recommendedTopics = [],
  } = scorecard;

  const getScoreVariant = (score) => {
    if (score >= 85) return 'success';
    if (score >= 70) return 'accent';
    if (score >= 50) return 'warning';
    return 'danger';
  };

  const getScoreColorClass = (score) => {
    if (score >= 85) return styles.scoreSuccess;
    if (score >= 70) return styles.scoreAccent;
    if (score >= 50) return styles.scoreWarning;
    return styles.scoreDanger;
  };

  const getScoreFillClass = (score) => {
    if (score >= 85) return styles.fillSuccess;
    if (score >= 70) return styles.fillAccent;
    if (score >= 50) return styles.fillWarning;
    return styles.fillDanger;
  };

  const getScoreTextClass = (score) => {
    if (score >= 85) return styles.textSuccess;
    if (score >= 70) return styles.textAccent;
    if (score >= 50) return styles.textWarning;
    return styles.textDanger;
  };

  const handleCopyReport = async () => {
    const report = `--- NEXAI TECHNICAL INTERVIEW SCORECARD ---
Role: ${session?.role || 'Technical Interview'}
Difficulty: ${session?.difficulty || 'Mid'}
Topic: ${session?.topic || ''}
Overall Score: ${overallScore}/100 (${rating})

CATEGORICAL BREAKDOWN:
- Technical Accuracy: ${categories.technicalAccuracy || 0}%
- Problem Solving: ${categories.problemSolving || 0}%
- Communication: ${categories.communication || 0}%
- System Design: ${categories.systemDesign || 0}%

KEY STRENGTHS:
${strengths.map((s) => `• ${s}`).join('\n')}

AREAS FOR IMPROVEMENT:
${improvements.map((i) => `• ${i}`).join('\n')}

RECOMMENDED STUDY TOPICS:
${recommendedTopics.map((t) => `• ${t}`).join('\n')}

EXECUTIVE SUMMARY:
${summary}`;

    try {
      await navigator.clipboard.writeText(report);
      setHasCopied(true);
      toast.success('Evaluation report copied to clipboard');
      setTimeout(() => setHasCopied(false), 2500);
    } catch {
      toast.error('Failed to copy evaluation report');
    }
  };

  const handleViewInLibrary = () => {
    navigate(`${ROUTES.LIBRARY}?tab=interviews`);
  };

  const handleGenerateStudyPrompts = async () => {
    if (!recommendedTopics || recommendedTopics.length === 0) return;
    try {
      const createPrompt = usePromptStore.getState().createPrompt;
      for (const topic of recommendedTopics.slice(0, 3)) {
        await createPrompt({
          title: `Study Focus: ${topic}`,
          description: `Generated from ${session?.role || 'Technical'} interview evaluation scorecard`,
          template: `You are an expert technical interviewer. I need to master {{${topic.toLowerCase().replace(/[^a-z0-9]/g, '_')}}}.\n\nExplain the core architectural concepts, common production failure modes, and top 3 senior-level interview questions with model answers.`,
          tags: ['interview-prep', 'study-guide', session?.role ? session.role.toLowerCase() : 'technical'],
        });
      }
      toast.success('Generated study templates saved to Prompt Vault!');
      navigate(ROUTES.PROMPTS);
    } catch {
      toast.error('Failed to generate study prompts');
    }
  };

  const isIncomplete = scorecard?.isIncomplete || scorecard?.rating === 'Incomplete' || session?.status === 'incomplete';

  return (
    <div className={styles.scorecardContainer}>
      {/* Header Banner */}
      <Card className={styles.heroCard} padding="lg">
        <div className={styles.heroTop}>
          <div className={styles.roleHeader}>
            <div className={styles.badgeRow}>
              <Badge variant={isIncomplete ? 'warning' : 'accent'} size="sm">
                {isIncomplete ? 'INCOMPLETE SESSION' : 'COMPLETED EVALUATION'}
              </Badge>
              <Badge variant="secondary" size="sm">
                {session?.difficulty}
              </Badge>
            </div>
            <h1 className={styles.sessionTitle}>{session?.role}</h1>
            <p className={styles.sessionTopic}>{session?.topic}</p>
          </div>

          {/* Overall Score Dial / Badge */}
          {!isIncomplete ? (
            <div className={styles.scoreBadgeBox}>
              <div className={cn(styles.scoreCircle, getScoreColorClass(overallScore))}>
                <span className={styles.scoreNum}>{overallScore}</span>
                <span className={styles.scoreTotal}>/100</span>
              </div>
              <Badge variant={getScoreVariant(overallScore)} size="md" className={styles.ratingBadge}>
                <Award size={14} />
                {rating}
              </Badge>
            </div>
          ) : (
            <div className={styles.scoreBadgeBox}>
              <Badge variant="warning" size="md" className={styles.ratingBadge}>
                <AlertTriangle size={14} />
                Session Incomplete
              </Badge>
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        <div className={styles.actionToolbar}>
          <div className={styles.leftActions}>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleViewInLibrary}
              leftIcon={<Bookmark size={15} />}
              className={styles.libraryBtn}
            >
              View in Library
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyReport}
              leftIcon={hasCopied ? <Check size={15} /> : <Copy size={15} />}
              className={styles.copyBtn}
            >
              {hasCopied ? 'Copied' : 'Copy Report'}
            </Button>
            {recommendedTopics && recommendedTopics.length > 0 && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerateStudyPrompts}
                leftIcon={<Sparkles size={15} />}
                className={styles.studyPromptsBtn}
                title="Convert recommended focus areas into Prompt Vault templates"
              >
                Generate Study Prompts
              </Button>
            )}
          </div>

          <div className={styles.rightActions}>
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              leftIcon={<ArrowLeft size={15} />}
              className={styles.backBtn}
            >
              Back to Setup
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={onReset}
              leftIcon={<Plus size={15} />}
              className={styles.practiceBtn}
            >
              Practice New Interview
            </Button>
          </div>
        </div>
      </Card>

      {/* Breakdown Grid */}
      <div className={styles.metricsGrid}>
        {/* Categorical Scores Progress */}
        <Card className={styles.sectionCard} padding="lg">
          <h3 className={styles.sectionTitle}>
            <Target size={16} />
            Competency Breakdown
          </h3>

          <div className={styles.categoriesList}>
            {[
              {
                id: 'technicalAccuracy',
                label: 'Technical Accuracy',
                score: categories.technicalAccuracy ?? 0,
              },
              {
                id: 'problemSolving',
                label: 'Problem Solving & Reasoning',
                score: categories.problemSolving ?? 0,
              },
              {
                id: 'communication',
                label: 'Communication & Articulation',
                score: categories.communication ?? 0,
              },
              {
                id: 'systemDesign',
                label: 'System Design & Trade-offs',
                score: categories.systemDesign ?? 0,
              },
            ].map((cat) => (
              <div key={cat.id} className={styles.catItem}>
                <div className={styles.catHeader}>
                  <span className={styles.catLabel}>{cat.label}</span>
                  <span className={cn(styles.catScore, getScoreTextClass(cat.score))}>
                    {cat.score}%
                  </span>
                </div>
                <div className={styles.progressBarBg}>
                  <div
                    className={cn(styles.progressBarFill, getScoreFillClass(cat.score))}
                    style={{ width: `${Math.min(100, Math.max(0, cat.score))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Executive Summary */}
        <Card className={styles.sectionCard} padding="lg">
          <h3 className={styles.sectionTitle}>
            <Lightbulb size={16} />
            Lead Examiner Summary
          </h3>
          <p className={styles.summaryText}>{summary}</p>

          {recommendedTopics.length > 0 && (
            <div className={styles.recommendedBox}>
              <span className={styles.recommendedTitle}>Recommended Study Focus:</span>
              <div className={styles.topicTags}>
                {recommendedTopics.map((topic, i) => (
                  <Badge key={i} variant="secondary" size="sm">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Strengths and Improvements Cards */}
      <div className={styles.feedbackGrid}>
        {/* Strengths */}
        <Card className={styles.feedbackCard} padding="lg">
          <div className={styles.feedbackHeader}>
            <CheckCircle2 size={18} className={styles.successIcon} />
            <h4 className={styles.feedbackTitle}>Key Demonstrated Strengths</h4>
          </div>
          <ul className={styles.feedbackList}>
            {strengths.map((item, idx) => (
              <li key={idx} className={styles.feedbackItem}>
                <span className={styles.bulletCheck}>✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Improvements */}
        <Card className={styles.feedbackCard} padding="lg">
          <div className={styles.feedbackHeader}>
            <AlertTriangle size={18} className={styles.warningIcon} />
            <h4 className={styles.feedbackTitle}>Targeted Areas for Improvement</h4>
          </div>
          <ul className={styles.feedbackList}>
            {improvements.map((item, idx) => (
              <li key={idx} className={styles.feedbackItem}>
                <span className={styles.bulletWarning}>!</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

Scorecard.propTypes = {
  session: PropTypes.object,
  scorecard: PropTypes.object,
  onReset: PropTypes.func.isRequired,
};

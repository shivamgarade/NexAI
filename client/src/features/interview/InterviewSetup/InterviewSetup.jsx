import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Sparkles,
  Layers,
  Zap,
  Cpu,
  GraduationCap,
  Play,
  Plus,
  Check,
  ChevronRight,
  Clock,
  Award,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils/formatDate';
import { cn } from '@/lib/utils/cn';
import styles from './InterviewSetup.module.scss';

const ROLE_PRESETS = [
  { id: 'Full-Stack Engineer', label: 'Full-Stack Engineer', icon: <Layers size={14} /> },
  { id: 'Frontend React', label: 'Frontend React', icon: <Zap size={14} /> },
  { id: 'Node.js Backend', label: 'Node.js Backend', icon: <Cpu size={14} /> },
  { id: 'System Design Architect', label: 'System Design', icon: <Sparkles size={14} /> },
  { id: 'MSBTE Capstone Viva', label: 'MSBTE Capstone Viva', icon: <GraduationCap size={14} /> },
];

const SENIORITY_LEVELS = [
  { id: 'junior', label: 'Junior / Student' },
  { id: 'mid', label: 'Mid-Level' },
  { id: 'senior', label: 'Senior / Lead' },
];

const QUICK_TOPICS = [
  { label: 'MERN APIs', value: 'MERN Stack Architecture & REST/WebSocket APIs' },
  { label: 'React 19 Hooks', value: 'React 19 Hooks & Performance' },
  { label: 'Microservices', value: 'Microservices & Distributed Systems' },
  { label: 'MSBTE Defense', value: 'MSBTE Capstone Viva Defense' },
];

export function InterviewSetup({
  role,
  difficulty,
  topic,
  selectedModel,
  onRoleChange,
  onDifficultyChange,
  onTopicChange,
  onModelChange,
  onStart,
  isStarting = false,
  sessions = [],
  onSelectSession,
  isSimulation = false,
  onToggleSimulation,
  voiceEngine = 'edge',
  onVoiceEngineChange,
}) {
  const isPresetRole = ROLE_PRESETS.some((p) => p.id === role);
  const [customRoleMode, setCustomRoleMode] = useState(!isPresetRole && Boolean(role));

  const completedSessions = sessions.filter(
    (s) => s.status === 'completed' && s.scorecard?.overallScore !== undefined
  );
  const totalCompleted = completedSessions.length;
  const avgScore =
    totalCompleted > 0
      ? Math.round(
          completedSessions.reduce((acc, s) => acc + (s.scorecard.overallScore || 0), 0) /
            totalCompleted
        )
      : null;

  const handleSelectPreset = (presetId) => {
    setCustomRoleMode(false);
    onRoleChange(presetId);
  };

  const handleCustomRoleClick = () => {
    setCustomRoleMode(true);
    if (isPresetRole) {
      onRoleChange('');
    }
  };

  return (
    <div className={styles.setupContainer}>
      <div className={styles.mainGrid}>
        {/* Left Column: Focused Setup Form */}
        <div className={styles.configColumn}>
          <Card className={styles.setupCard} padding="lg">
            <div className={styles.headerArea}>
              <h2 className={styles.title}>Start Technical Interview</h2>
              <p className={styles.subtitle}>
                Configure your target role, seniority level, and focus topic.
              </p>
            </div>

            {/* Target Role */}
            <div className={styles.formGroup}>
              <label className={styles.groupLabel}>Target Role</label>
              <div className={styles.rolesGrid}>
                {ROLE_PRESETS.map((preset) => {
                  const isSelected = !customRoleMode && role === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={cn(styles.rolePill, isSelected && styles.selected)}
                      onClick={() => handleSelectPreset(preset.id)}
                    >
                      <span className={styles.pillIcon}>{preset.icon}</span>
                      <span className={styles.pillLabel}>{preset.label}</span>
                      {isSelected && <Check size={13} className={styles.checkIcon} />}
                    </button>
                  );
                })}

                <button
                  type="button"
                  className={cn(styles.rolePill, customRoleMode && styles.selected)}
                  onClick={handleCustomRoleClick}
                >
                  <Plus size={14} className={styles.pillIcon} />
                  <span className={styles.pillLabel}>Custom Role</span>
                  {customRoleMode && <Check size={13} className={styles.checkIcon} />}
                </button>
              </div>

              {customRoleMode && (
                <div className={styles.customRoleInput}>
                  <Input
                    placeholder="Enter custom role title (e.g., DevOps Engineer, iOS Developer)"
                    value={role}
                    onChange={(e) => onRoleChange(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* Seniority Level */}
            <div className={styles.formGroup}>
              <label className={styles.groupLabel}>Seniority Level</label>
              <div className={styles.segmentedControl}>
                {SENIORITY_LEVELS.map((lvl) => {
                  const isSelected = difficulty === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      className={cn(styles.segmentBtn, isSelected && styles.segmentSelected)}
                      onClick={() => onDifficultyChange(lvl.id)}
                    >
                      <span>{lvl.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Topic & Focus Area */}
            <div className={styles.formGroup}>
              <label className={styles.groupLabel}>Topic or Tech Stack</label>
              <Input
                placeholder="e.g. MERN Stack Architecture, React 19 Fiber, PostgreSQL..."
                value={topic}
                onChange={(e) => onTopicChange(e.target.value)}
              />

              <div className={styles.quickTopicsRow}>
                <span className={styles.quickLabel}>Suggested:</span>
                <div className={styles.quickChips}>
                  {QUICK_TOPICS.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      className={cn(styles.chip, topic === t.value && styles.chipActive)}
                      onClick={() => onTopicChange(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Compact Voice & Engine Settings */}
            <div className={styles.optionsRow}>
              <div className={styles.voiceSection}>
                <span className={styles.optionLabel}>Voice:</span>
                <div className={styles.voiceToggleGroup} role="radiogroup" aria-label="Voice Engine">
                  <button
                    type="button"
                    className={cn(styles.optionPill, voiceEngine === 'edge' && styles.optionPillActive)}
                    onClick={() => onVoiceEngineChange && onVoiceEngineChange('edge')}
                    aria-pressed={voiceEngine === 'edge'}
                    title="Free, ultra-fast browser voice"
                  >
                    <Zap size={12} />
                    <span>Edge Neural (Free)</span>
                  </button>
                  <button
                    type="button"
                    className={cn(styles.optionPill, voiceEngine === 'gemini' && styles.optionPillActive)}
                    onClick={() => onVoiceEngineChange && onVoiceEngineChange('gemini')}
                    aria-pressed={voiceEngine === 'gemini'}
                    title="Google Gemini Cloud voice"
                  >
                    <Bot size={12} />
                    <span>Gemini 3.8 TTS</span>
                  </button>
                </div>
              </div>

              {onToggleSimulation && (
                <button
                  type="button"
                  className={cn(styles.simToggleBtn, isSimulation && styles.simActive)}
                  onClick={onToggleSimulation}
                  title="Toggle Zero-Token Simulation mode"
                >
                  <Zap size={12} />
                  <span>{isSimulation ? 'Simulation Mode' : 'Live AI'}</span>
                </button>
              )}
            </div>

            {/* CTA Button */}
            <div className={styles.actionRow}>
              <Button
                variant="primary"
                size="lg"
                className={styles.startBtn}
                onClick={onStart}
                disabled={!role.trim() || !topic.trim() || isStarting}
                loading={isStarting}
                leftIcon={<Play size={16} />}
                aria-label="Enter Simulation Arena"
              >
                {isSimulation ? 'Enter Simulation Arena' : 'Start Technical Interview'}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Recent Sessions Only (No Bloat) */}
        <div className={styles.historyColumn}>
          <Card className={styles.historyCard} padding="lg">
            <div className={styles.historyHeader}>
              <div className={styles.historyTitleWrap}>
                <Clock size={16} />
                <h3 className={styles.historyTitle}>Recent Interviews</h3>
              </div>
              <div className={styles.historyStats}>
                <span className={styles.statsBadge}>{sessions.length} sessions</span>
                {avgScore !== null && (
                  <span className={styles.statsBadge}>Avg: {avgScore}%</span>
                )}
              </div>
            </div>

            {sessions.length === 0 ? (
              <EmptyState
                icon={<Award size={32} />}
                title="No Interviews Yet"
                description="Start your first session to receive an automated competency scorecard."
              />
            ) : (
              <div className={styles.sessionsList}>
                {sessions.slice(0, 5).map((sess) => {
                  const isCompleted = sess.status === 'completed';
                  const score = sess.scorecard?.overallScore;
                  return (
                    <div
                      key={sess._id}
                      className={styles.sessionItem}
                      onClick={() => onSelectSession(sess._id)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.sessionMain}>
                        <div className={styles.sessionTop}>
                          <span className={styles.sessionRole}>{sess.role}</span>
                          {isCompleted && score !== undefined ? (
                            <Badge
                              variant={score >= 80 ? 'success' : score >= 60 ? 'warning' : 'danger'}
                              size="sm"
                            >
                              {score}/100
                            </Badge>
                          ) : (
                            <Badge variant="accent" size="sm">
                              In Progress
                            </Badge>
                          )}
                        </div>
                        <p className={styles.sessionTopic} title={sess.topic}>
                          {sess.topic}
                        </p>
                        <div className={styles.sessionMeta}>
                          <span className={styles.metaPill}>{sess.difficulty}</span>
                          <span className={styles.metaDate}>{formatDate(sess.createdAt)}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className={styles.sessionArrow} />
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

InterviewSetup.propTypes = {
  role: PropTypes.string.isRequired,
  difficulty: PropTypes.oneOf(['junior', 'mid', 'senior']).isRequired,
  topic: PropTypes.string.isRequired,
  selectedModel: PropTypes.oneOf(['flash', 'pro']).isRequired,
  onRoleChange: PropTypes.func.isRequired,
  onDifficultyChange: PropTypes.func.isRequired,
  onTopicChange: PropTypes.func.isRequired,
  onModelChange: PropTypes.func.isRequired,
  onStart: PropTypes.func.isRequired,
  isStarting: PropTypes.bool,
  sessions: PropTypes.array,
  onSelectSession: PropTypes.func.isRequired,
  isSimulation: PropTypes.bool,
  onToggleSimulation: PropTypes.func,
  voiceEngine: PropTypes.oneOf(['edge', 'gemini']),
  onVoiceEngineChange: PropTypes.func,
};

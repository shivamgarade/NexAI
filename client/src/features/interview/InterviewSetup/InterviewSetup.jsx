import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import {
  Sparkles,
  Award,
  ChevronRight,
  Clock,
  Zap,
  Play,
  Plus,
  X,
  Check,
  Edit3,
  Layers,
  Cpu,
  GraduationCap,
  Code2,
  Target,
  TrendingUp,
  BarChart2,
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
  { id: 'Full-Stack Engineer', label: 'Full-Stack Engineer', icon: <Layers size={16} /> },
  { id: 'Frontend React', label: 'Frontend React', icon: <Zap size={16} /> },
  { id: 'Node.js Backend', label: 'Node.js Backend', icon: <Cpu size={16} /> },
  { id: 'System Design Architect', label: 'System Design', icon: <Sparkles size={16} /> },
  { id: 'MSBTE Capstone Viva', label: 'MSBTE Capstone Viva', icon: <GraduationCap size={16} /> },
];

const SENIORITY_LEVELS = [
  {
    id: 'junior',
    label: 'Junior / Student',
    tag: 'Fundamentals',
    icon: <GraduationCap size={16} />,
    desc: 'Language syntax, core mechanics & basic mental models',
  },
  {
    id: 'mid',
    label: 'Mid-Level',
    tag: 'Architecture',
    icon: <Layers size={16} />,
    desc: 'System trade-offs, state synchronization & REST/WebSocket APIs',
  },
  {
    id: 'senior',
    label: 'Senior / Lead',
    tag: 'High Rigor',
    icon: <Cpu size={16} />,
    desc: 'Scalability, distributed systems, latency vs throughput & resilience',
  },
];

const CURATED_TECH_TAGS = [
  'React 19',
  'Next.js',
  'Node.js',
  'TypeScript',
  'Docker',
  'PostgreSQL',
  'System Design',
  'Microservices',
];

const QUICK_TEMPLATES = [
  { label: 'MERN APIs', full: 'MERN Stack Architecture & REST/WebSocket APIs' },
  { label: 'React 19 Hooks', full: 'React 19 Hooks, Fiber & Performance Optimization' },
  { label: 'Microservices', full: 'Microservices, Distributed Caching & Database Indexing' },
  { label: 'MSBTE Defense', full: 'MSBTE Capstone Viva Defense & System Justification' },
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
  // Calculate performance overview metrics
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
  const bestScore =
    totalCompleted > 0
      ? Math.max(...completedSessions.map((s) => s.scorecard.overallScore || 0))
      : null;

  // Custom role state
  const isPresetRole = ROLE_PRESETS.some((p) => p.id === role);
  const [customRoleMode, setCustomRoleMode] = useState(!isPresetRole && Boolean(role));

  // Custom persona state
  const [showCustomPersona, setShowCustomPersona] = useState(false);
  const [customPersonaText, setCustomPersonaText] = useState('');

  // Custom tech tags
  const [customTags, setCustomTags] = useState(() => {
    try {
      const saved = localStorage.getItem('nexai_custom_interview_tags');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');

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

  const handleToggleTag = (tag) => {
    if (!topic.trim()) {
      onTopicChange(tag);
      return;
    }
    const parts = topic.split(',').map((p) => p.trim()).filter(Boolean);
    const index = parts.findIndex((p) => p.toLowerCase() === tag.toLowerCase());
    if (index >= 0) {
      parts.splice(index, 1);
      onTopicChange(parts.join(', '));
    } else {
      parts.push(tag);
      onTopicChange(parts.join(', '));
    }
  };

  const handleAddCustomTag = (e) => {
    if (e) e.preventDefault();
    const trimmed = newTagInput.trim();
    if (!trimmed) return;

    if (
      !CURATED_TECH_TAGS.some((t) => t.toLowerCase() === trimmed.toLowerCase()) &&
      !customTags.some((t) => t.toLowerCase() === trimmed.toLowerCase())
    ) {
      const updated = [...customTags, trimmed];
      setCustomTags(updated);
      try {
        localStorage.setItem('nexai_custom_interview_tags', JSON.stringify(updated));
      } catch {
        // ignore storage errors
      }
    }

    handleToggleTag(trimmed);
    setNewTagInput('');
    setShowAddTag(false);
  };

  const handleRemoveCustomTag = (e, tagToRemove) => {
    e.stopPropagation();
    const updated = customTags.filter((t) => t !== tagToRemove);
    setCustomTags(updated);
    try {
      localStorage.setItem('nexai_custom_interview_tags', JSON.stringify(updated));
    } catch {
      // ignore storage errors
    }

    const parts = topic.split(',').map((p) => p.trim()).filter(Boolean);
    const remaining = parts.filter((p) => p.toLowerCase() !== tagToRemove.toLowerCase());
    onTopicChange(remaining.join(', '));
  };

  const isTagActive = (tag) => {
    if (!topic) return false;
    const lowerTopic = topic.toLowerCase();
    const lowerTag = tag.toLowerCase();
    return (
      lowerTopic.split(',').some((p) => p.trim() === lowerTag) || lowerTopic === lowerTag
    );
  };

  return (
    <div className={styles.setupContainer}>
      <div className={styles.mainGrid}>
        {/* Left Column: Setup Config Form */}
        <div className={styles.configColumn}>
          <Card className={styles.setupCard} padding="lg">
            {/* Header */}
            <div className={styles.headerArea}>
              <div className={styles.badgeWrapper}>
                <Badge variant="accent" size="sm">
                  <Sparkles size={12} />
                  AI Mock Simulation
                </Badge>
              </div>
              <h2 className={styles.title}>Configure Technical Screening</h2>
              <p className={styles.subtitle}>
                Follow the 4 steps below to set up your AI interviewer, target role, and technical depth.
              </p>
            </div>

            {/* STEP 1: Target Role & Persona */}
            <div className={styles.formSection}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNumberBadge}>1</div>
                <div className={styles.stepHeaderText}>
                  <label className={styles.stepTitle}>Target Role & Persona</label>
                  <span className={styles.stepSubtitle}>
                    Select a core track or create a custom role
                  </span>
                </div>
              </div>

              <div className={styles.cardGrid}>
                {ROLE_PRESETS.map((preset) => {
                  const isSelected = !customRoleMode && role === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={cn(styles.selectionCard, isSelected && styles.selected)}
                      onClick={() => handleSelectPreset(preset.id)}
                    >
                      <div className={styles.cardLeft}>
                        <div className={styles.cardIcon}>{preset.icon}</div>
                        <span className={styles.cardLabel}>{preset.label}</span>
                      </div>
                      {isSelected && (
                        <div className={styles.checkIndicator}>
                          <Check size={12} />
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* Custom Role Card */}
                <button
                  type="button"
                  className={cn(
                    styles.selectionCard,
                    styles.customRoleCard,
                    customRoleMode && styles.selected,
                  )}
                  onClick={handleCustomRoleClick}
                >
                  <div className={styles.cardLeft}>
                    <div className={styles.cardIcon}>
                      <Plus size={16} />
                    </div>
                    <span className={styles.cardLabel}>Custom Role</span>
                  </div>
                  {customRoleMode && (
                    <div className={styles.checkIndicator}>
                      <Check size={12} />
                    </div>
                  )}
                </button>
              </div>

              {/* Custom Role Input Field */}
              {customRoleMode && (
                <div className={styles.customInputSlideDown}>
                  <label className={styles.inputMiniLabel}>Custom Position Title:</label>
                  <Input
                    placeholder="e.g. Flutter Mobile Dev, DevOps Lead, AI Researcher..."
                    value={role}
                    onChange={(e) => onRoleChange(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>

            {/* STEP 2: Seniority Level */}
            <div className={styles.formSection}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNumberBadge}>2</div>
                <div className={styles.stepHeaderText}>
                  <div className={styles.stepHeaderRow}>
                    <label className={styles.stepTitle}>Seniority & Evaluator Rigor</label>
                    {!showCustomPersona && (
                      <button
                        type="button"
                        className={styles.subtleTextBtn}
                        onClick={() => setShowCustomPersona(true)}
                      >
                        <Edit3 size={11} />
                        Add Persona Note
                      </button>
                    )}
                  </div>
                  <span className={styles.stepSubtitle}>
                    Calibrates interviewer strictness, trade-off depth, and viva rigor
                  </span>
                </div>
              </div>

              {/* 3 Seniority Cards */}
              <div className={styles.seniorityGrid}>
                {SENIORITY_LEVELS.map((lvl) => {
                  const isSelected = difficulty === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      className={cn(styles.seniorityCard, isSelected && styles.selected)}
                      onClick={() => onDifficultyChange(lvl.id)}
                    >
                      <div className={styles.seniorityTop}>
                        <div className={styles.seniorityTitleGroup}>
                          <span className={styles.seniorityIcon}>{lvl.icon}</span>
                          <span className={styles.seniorityName}>{lvl.label}</span>
                        </div>
                        {isSelected ? (
                          <div className={styles.checkIndicator}>
                            <Check size={12} />
                          </div>
                        ) : (
                          <span className={styles.seniorityTag}>{lvl.tag}</span>
                        )}
                      </div>
                      <p className={styles.seniorityDescription}>{lvl.desc}</p>
                    </button>
                  );
                })}
              </div>

              {/* Optional Custom Persona / Title Input */}
              {showCustomPersona && (
                <div className={styles.customInputSlideDown}>
                  <div className={styles.customPersonaHeader}>
                    <label className={styles.inputMiniLabel}>Specialized Persona / YOE (Optional):</label>
                    <button
                      type="button"
                      className={styles.cancelTextBtn}
                      onClick={() => {
                        setCustomPersonaText('');
                        setShowCustomPersona(false);
                      }}
                    >
                      <X size={12} /> Remove
                    </button>
                  </div>
                  <Input
                    placeholder="e.g. Staff Architect with 8+ YOE, Engineering Intern, External Reviewer"
                    value={customPersonaText}
                    onChange={(e) => setCustomPersonaText(e.target.value)}
                  />
                </div>
              )}
            </div>

            {/* STEP 3: Focus Topic & Tech Stack */}
            <div className={styles.formSection}>
              <div className={styles.stepHeader}>
                <div className={styles.stepNumberBadge}>3</div>
                <div className={styles.stepHeaderText}>
                  <label className={styles.stepTitle}>Focus Topic & Tech Stack</label>
                  <span className={styles.stepSubtitle}>
                    Define the core frameworks, libraries, or architectural concepts
                  </span>
                </div>
              </div>

              {/* Main Topic Input */}
              <div className={styles.topicInputWrapper}>
                <Input
                  placeholder="e.g. Distributed Database Sharding, React 19 Fiber, Next.js App Router"
                  value={topic}
                  onChange={(e) => onTopicChange(e.target.value)}
                />
              </div>

              {/* Tech Stack Interactive Tags */}
              <div className={styles.tagGroupWrapper}>
                <div className={styles.groupHeader}>
                  <Code2 size={13} className={styles.groupHeaderIcon} />
                  <span>Click to add/remove technologies from your topic:</span>
                </div>
                <div className={styles.interactiveTags}>
                  {CURATED_TECH_TAGS.map((tech) => {
                    const active = isTagActive(tech);
                    return (
                      <button
                        key={tech}
                        type="button"
                        className={cn(styles.toggleTag, active && styles.activeTag)}
                        onClick={() => handleToggleTag(tech)}
                      >
                        {active ? <Check size={11} /> : <Plus size={11} />}
                        <span>{tech}</span>
                      </button>
                    );
                  })}

                  {/* Custom Added Tags */}
                  {customTags.map((cTag) => {
                    const active = isTagActive(cTag);
                    return (
                      <div
                        key={cTag}
                        className={cn(styles.toggleTag, styles.customToggleTag, active && styles.activeTag)}
                        onClick={() => handleToggleTag(cTag)}
                        role="button"
                        tabIndex={0}
                      >
                        {active ? <Check size={11} /> : <Plus size={11} />}
                        <span>{cTag}</span>
                        <button
                          type="button"
                          className={styles.deleteTagBtn}
                          onClick={(e) => handleRemoveCustomTag(e, cTag)}
                          title="Delete tag"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add Tag Form */}
                  {showAddTag ? (
                    <form onSubmit={handleAddCustomTag} className={styles.miniTagForm}>
                      <input
                        type="text"
                        placeholder="Tag name..."
                        className={styles.miniTagInput}
                        value={newTagInput}
                        onChange={(e) => setNewTagInput(e.target.value)}
                        autoFocus
                      />
                      <button type="submit" className={styles.miniConfirmBtn} title="Save tag">
                        <Check size={11} />
                      </button>
                      <button
                        type="button"
                        className={styles.miniCancelBtn}
                        onClick={() => setShowAddTag(false)}
                        title="Cancel"
                      >
                        <X size={11} />
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className={styles.addNewTagBtn}
                      onClick={() => setShowAddTag(true)}
                    >
                      <Plus size={11} />
                      <span>Custom Tech</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Pre-built scenario templates */}
              <div className={styles.templatesWrapper}>
                <span className={styles.templatesHeader}>Quick Scenarios:</span>
                <div className={styles.templatePills}>
                  {QUICK_TEMPLATES.map((tmpl) => {
                    const isSelected = topic === tmpl.full;
                    return (
                      <button
                        key={tmpl.label}
                        type="button"
                        className={cn(styles.templatePill, isSelected && styles.activeTemplate)}
                        onClick={() => onTopicChange(tmpl.full)}
                      >
                        {tmpl.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Compact Simulation Mode Toggle */}
            <div className={styles.compactSimRow}>
              <div className={styles.simStatusInfo}>
                <span className={styles.modeLabel}>Interviewer Engine:</span>
                <span className={cn(styles.modeIndicator, isSimulation ? styles.simMode : styles.liveMode)}>
                  {isSimulation ? 'Offline Simulation (0 Tokens)' : 'Live Gemini AI (Gemini Flash)'}
                </span>
              </div>

              <button
                type="button"
                className={cn(styles.compactSimBtn, isSimulation && styles.activeSimBtn)}
                onClick={onToggleSimulation}
                aria-label="Toggle simulation mode"
                title={isSimulation ? 'Switch to Live AI Interview' : 'Switch to Zero-Token Simulation'}
              >
                <Zap size={13} className={isSimulation ? styles.activeZap : undefined} />
                <span>{isSimulation ? 'Simulation: Active' : 'Simulation: Off'}</span>
              </button>
            </div>

            {/* Voice Audio Engine Selector */}
            <div className={styles.voiceEngineRow}>
              <div className={styles.voiceEngineInfo}>
                <span className={styles.modeLabel}>Voice Speech Engine:</span>
                <span className={styles.voiceEngineDesc}>
                  {voiceEngine === 'edge'
                    ? '⚡ Edge Neural (~400ms Studio Voice, Free)'
                    : '🎙️ Gemini 3.8 Flash-Lite TTS (Cloud Audio, Metered)'}
                </span>
              </div>

              <div className={styles.engineToggleGroup} role="radiogroup" aria-label="Voice Engine">
                <button
                  type="button"
                  className={cn(styles.enginePillBtn, voiceEngine === 'edge' && styles.enginePillActive)}
                  onClick={() => onVoiceEngineChange && onVoiceEngineChange('edge')}
                  title="⚡ Microsoft Edge Neural TTS: Free, ultra-fast, 0 credits"
                  aria-pressed={voiceEngine === 'edge'}
                >
                  <Zap size={12} />
                  <span>Edge Neural (Free)</span>
                </button>
                <button
                  type="button"
                  className={cn(styles.enginePillBtn, voiceEngine === 'gemini' && styles.enginePillActive)}
                  onClick={() => onVoiceEngineChange && onVoiceEngineChange('gemini')}
                  title="🎙️ Google Gemini 3.8 Flash-Lite TTS: Cloud voice, metered credits"
                  aria-pressed={voiceEngine === 'gemini'}
                >
                  <Bot size={12} />
                  <span>Gemini 3.8 TTS</span>
                </button>
              </div>
            </div>

            {/* Ready to Start Summary Bar & CTA */}
            <div className={styles.ctaRow}>
              <div className={styles.summaryBar}>
                <span className={styles.summaryPrefix}>Selected Configuration:</span>
                <span className={styles.summaryValue}>
                  {role || 'Select Role'} · {difficulty.toUpperCase()} ·{' '}
                  {isSimulation
                    ? 'Offline Simulation (0 Tokens)'
                    : voiceEngine === 'edge'
                      ? 'Live AI + Edge Neural Voice'
                      : 'Live AI + Gemini 3.8 TTS'}
                </span>
              </div>

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

              <span className={cn(styles.meteringNotice, isSimulation && styles.simNotice)}>
                {isSimulation
                  ? '⚡ Simulation Mode active: Zero tokens & zero wallet credits deducted.'
                  : '⚡ Real-time Gemini AI interviewer metered with credits (~1-2 credits/turn)'}
              </span>
            </div>
          </Card>
        </div>

        {/* Right Column: History, Metrics & Preparation Hub */}
        <div className={styles.historyColumn}>
          {/* Quick Metrics Overview Strip */}
          <div className={styles.statsStrip}>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Screenings</span>
              <span className={styles.statValue}>{sessions.length}</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Avg Score</span>
              <span className={cn(styles.statValue, avgScore !== null && styles.accentValue)}>
                {avgScore !== null ? `${avgScore}%` : '—'}
              </span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statLabel}>Top Score</span>
              <span className={cn(styles.statValue, bestScore !== null && styles.successValue)}>
                {bestScore !== null ? `${bestScore}/100` : '—'}
              </span>
            </div>
          </div>

          {/* Recent Simulations Card */}
          <Card className={styles.historyCard} padding="lg">
            <div className={styles.historyHeader}>
              <div className={styles.historyTitleWrap}>
                <Clock size={16} />
                <h3 className={styles.historyTitle}>Recent Simulations</h3>
              </div>
              <span className={styles.historyCount}>{sessions.length} sessions</span>
            </div>

            {sessions.length === 0 ? (
              <EmptyState
                icon={<Award size={36} />}
                title="No Interviews Yet"
                description="Configure your target role and seniority to begin your first interactive interview."
              />
            ) : (
              <div className={styles.sessionsList}>
                {sessions.map((sess) => {
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

                      <div className={styles.sessionArrow}>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Technical Evaluation Rubric & Prep Guide */}
          <Card className={styles.rubricCard} padding="lg">
            <div className={styles.rubricHeader}>
              <div className={styles.rubricTitleWrap}>
                <Target size={16} className={styles.rubricIcon} />
                <h4 className={styles.rubricTitle}>Evaluation Criteria & Viva Rigor</h4>
              </div>
              <span className={styles.rubricBadge}>4-Pillar Model</span>
            </div>

            <p className={styles.rubricDesc}>
              Simulates senior engineering panel rigor with continuous adaptive follow-ups and strict architectural defense.
            </p>

            <div className={styles.rubricGrid}>
              <div className={styles.rubricItem}>
                <span className={styles.rubricDot} />
                <div>
                  <strong className={styles.rubricLabel}>Technical Accuracy</strong>
                  <p className={styles.rubricSub}>Language primitives, API lifecycle & runtime internals</p>
                </div>
              </div>

              <div className={styles.rubricItem}>
                <span className={styles.rubricDot} />
                <div>
                  <strong className={styles.rubricLabel}>System Design</strong>
                  <p className={styles.rubricSub}>State boundaries, synchronization, caching & scalability</p>
                </div>
              </div>

              <div className={styles.rubricItem}>
                <span className={styles.rubricDot} />
                <div>
                  <strong className={styles.rubricLabel}>Problem Solving</strong>
                  <p className={styles.rubricSub}>Algorithmic reasoning, edge cases & latency trade-offs</p>
                </div>
              </div>

              <div className={styles.rubricItem}>
                <span className={styles.rubricDot} />
                <div>
                  <strong className={styles.rubricLabel}>Viva Communication</strong>
                  <p className={styles.rubricSub}>Articulate rationale, defensive depth & concise answers</p>
                </div>
              </div>
            </div>
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

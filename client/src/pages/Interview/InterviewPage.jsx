import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import {
  InterviewSetup,
  InterviewArena,
  Scorecard,
} from '@/features/interview';
import { useInterviewStore } from '@/store/interviewStore';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/constants/routes';
import styles from './InterviewPage.module.scss';

export default function InterviewPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const creditsRemaining = user?.wallet?.creditsRemaining ?? 0;

  const {
    currentSession,
    messages,
    scorecard,
    archivedLibraryItem,
    isStarting,
    isStreaming,
    isConcluding,
    role,
    difficulty,
    topic,
    selectedModel,
    isSimulation,
    toggleSimulation,
    sessions,
    isListening,
    setIsListening,
    isSpeaking,
    speakingSource,
    isTtsEnabled,
    isTtsLoading,
    voiceEngine,
    setVoiceEngine,
    setSetupField,
    startInterview,
    sendResponse,
    stopStreaming,
    concludeInterview,
    resetSession,
    fetchSessions,
    loadSession,
    toggleTts,
    speakInterviewerText,
  } = useInterviewStore();

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleStart = () => {
    startInterview({
      role,
      difficulty,
      topic,
      model: selectedModel,
      isSimulation,
    });
  };

  const handleRechargeClick = () => {
    navigate(ROUTES.WALLET);
  };

  return (
    <div className={styles.pageContainer}>
      <PageHeader
        title="AI Mock Interview Platform"
        subtitle="Simulate technical screenings and viva defense with real-time speech visualizer and automated competency scorecards."
        actions={
          <div className={styles.headerActions}>
            <div className={styles.creditPill} onClick={handleRechargeClick} role="button" tabIndex={0}>
              <CreditCard size={14} />
              <span>{creditsRemaining} credits</span>
            </div>
          </div>
        }
      />


      {/* Main Content View Switcher */}
      <div className={styles.contentArea}>
        {scorecard ? (
          <Scorecard
            session={currentSession}
            scorecard={scorecard}
            archivedLibraryItem={archivedLibraryItem}
            onReset={resetSession}
          />
        ) : currentSession ? (
          <InterviewArena
            session={currentSession}
            messages={messages}
            isStreaming={isStreaming}
            isConcluding={isConcluding}
            onSendResponse={sendResponse}
            onStopStreaming={stopStreaming}
            onConclude={concludeInterview}
            onReset={resetSession}
            isListening={isListening}
            setIsListening={setIsListening}
            isSpeaking={isSpeaking}
            speakingSource={speakingSource}
            isTtsEnabled={isTtsEnabled}
            isTtsLoading={isTtsLoading}
            voiceEngine={voiceEngine}
            onToggleVoiceEngine={setVoiceEngine}
            onToggleTts={toggleTts}
            onSpeakText={speakInterviewerText}
          />
        ) : (
          <InterviewSetup
            role={role}
            difficulty={difficulty}
            topic={topic}
            selectedModel={selectedModel}
            onRoleChange={(val) => setSetupField('role', val)}
            onDifficultyChange={(val) => setSetupField('difficulty', val)}
            onTopicChange={(val) => setSetupField('topic', val)}
            onModelChange={(val) => setSetupField('selectedModel', val)}
            onStart={handleStart}
            isStarting={isStarting}
            sessions={sessions}
            onSelectSession={loadSession}
            isSimulation={isSimulation}
            onToggleSimulation={toggleSimulation}
            voiceEngine={voiceEngine}
            onVoiceEngineChange={setVoiceEngine}
          />
        )}
      </div>
    </div>
  );
}

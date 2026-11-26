import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Bot,
  X,
  Send,
  Sparkles,
  ShieldAlert,
  Lightbulb,
  Boxes,
  AlertTriangle,
  HelpCircle,
  Loader2,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { MarkdownRenderer } from '@/features/chat/MarkdownRenderer/MarkdownRenderer';
import { useInterviewStore } from '@/store/interviewStore';
import { cn } from '@/lib/utils/cn';
import styles from './InterviewBuddyDrawer.module.scss';

const QUICK_HINT_PROMPTS = [
  {
    id: 'concept',
    label: 'Conceptual Invariant',
    icon: Lightbulb,
    hintLevel: 'concept',
    prompt: 'Can you give me a conceptual hint on which algorithmic paradigm fits this problem?',
  },
  {
    id: 'structure',
    label: 'Data Structure Nudge',
    icon: Boxes,
    hintLevel: 'structure',
    prompt: 'What data structure should I consider to optimize time and space complexity here?',
  },
  {
    id: 'edge_case',
    label: 'Edge Cases to Check',
    icon: AlertTriangle,
    hintLevel: 'edge_case',
    prompt: 'What critical boundary conditions and edge cases should I safeguard my implementation against?',
  },
  {
    id: 'clarify',
    label: 'Clarify Constraints',
    icon: HelpCircle,
    hintLevel: 'general',
    prompt: 'Can you clarify the input constraints, scale expectations, and memory limits?',
  },
];

export function InterviewBuddyDrawer({ isOpen, onClose, currentQuestion, draftCode }) {
  const { buddyMessages, isBuddyStreaming, askBuddy } = useInterviewStore();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, buddyMessages]);

  if (!isOpen) return null;

  const handleSend = (text, hintLevel = 'general') => {
    const q = (text || inputText).trim();
    if (!q || isBuddyStreaming) return;
    askBuddy({
      query: q,
      hintLevel,
      codeContext: draftCode,
    });
    setInputText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.drawerBackdrop} onClick={onClose} aria-hidden="true">
      <aside
        className={styles.drawerContainer}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="AI Interview Co-Pilot"
      >
        {/* Drawer Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.botIconWrap}>
              <Bot size={18} />
            </div>
            <div>
              <div className={styles.titleRow}>
                <h3 className={styles.title}>Interview Co-Pilot</h3>
                <Badge variant="primary" size="sm" className={styles.guardrailBadge}>
                  <ShieldAlert size={11} className={styles.shieldIcon} />
                  Socratic Mode
                </Badge>
              </div>
              <p className={styles.subtitle}>
                Ask doubts & progressive hints without advancing questions.
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            title="Close Co-Pilot (Esc)"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </header>

        {/* Quick Hint Action Chips */}
        <div className={styles.quickHintsBar}>
          <div className={styles.quickHintChips}>
            {QUICK_HINT_PROMPTS.map((h) => {
              const Icon = h.icon;
              return (
                <button
                  key={h.id}
                  type="button"
                  className={styles.hintChip}
                  onClick={() => handleSend(h.prompt, h.hintLevel)}
                  disabled={isBuddyStreaming}
                >
                  <Icon size={12} className={styles.chipIcon} />
                  <span>{h.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message Thread */}
        <div className={styles.messagesScrollArea}>
          {buddyMessages.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyGlowIcon}>
                <Sparkles size={28} />
              </div>
              <h4 className={styles.emptyHeading}>How can I help you think?</h4>
              <p className={styles.emptyText}>
                Stuck on a requirement or algorithmic approach? Ask any clarifying question or tap a
                hint above.
              </p>
              <div className={styles.ruleNotice}>
                <ShieldAlert size={14} className={styles.ruleIcon} />
                <span>
                  <strong>Strict Socratic Policy:</strong> Direct code solutions or copy-paste
                  answers are prohibited. I will guide you toward uncovering the solution yourself.
                </span>
              </div>
            </div>
          ) : (
            <div className={styles.messagesList}>
              {buddyMessages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={idx}
                    className={cn(styles.messageBubble, isUser ? styles.userMsg : styles.buddyMsg)}
                  >
                    <div className={styles.msgHeader}>
                      <span className={styles.msgSender}>
                        {isUser ? 'You' : 'Co-Pilot Mentor'}
                      </span>
                    </div>
                    <div className={styles.msgBody}>
                      {isUser ? (
                        <p className={styles.userText}>{msg.content}</p>
                      ) : (
                        <MarkdownRenderer content={msg.content} isStreaming={msg.isStreaming} />
                      )}
                    </div>
                  </div>
                );
              })}
              {isBuddyStreaming && (
                <div className={styles.streamingIndicator}>
                  <Loader2 size={14} className={styles.spin} />
                  <span>Formulating Socratic guidance...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <footer className={styles.footer}>
          <div className={styles.inputContainer}>
            <textarea
              className={styles.textarea}
              placeholder="Ask for clarification or guidance (e.g. 'What is the optimal complexity?')..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={isBuddyStreaming}
            />
            <Button
              variant="primary"
              size="sm"
              className={styles.sendBtn}
              onClick={() => handleSend()}
              disabled={!inputText.trim() || isBuddyStreaming}
              icon={isBuddyStreaming ? <Loader2 size={14} className={styles.spin} /> : <Send size={14} />}
            >
              Ask
            </Button>
          </div>
          <p className={styles.footerDisclaimer}>
            Co-Pilot discussions are not counted as formal answer submissions.
          </p>
        </footer>
      </aside>
    </div>
  );
}

InterviewBuddyDrawer.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  currentQuestion: PropTypes.string,
  draftCode: PropTypes.string,
};

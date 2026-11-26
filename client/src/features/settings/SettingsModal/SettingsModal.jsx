import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Sliders,
  Palette,
  Brain,
  Wallet as WalletIcon,
  Layers,
  Shield,
  Sparkles,
  Globe,
  Cpu,
  ArrowRight,
  User,
  CreditCard,
  Check,
  LogOut,
  Monitor,
  Sun,
  Moon,
  RotateCcw,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/hooks/useTheme';
import { useChatStore } from '@/store/chatStore';
import { useWalletStore } from '@/store/walletStore';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { toast } from '@/store/uiStore';
import { MemoryManager } from '@/features/memory';
import { RazorpayPaymentModal } from '@/features/wallet/RazorpayPaymentModal';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './SettingsModal.module.scss';

export function SettingsModal() {
  const isOpen = useUiStore((state) => state.isSettingsModalOpen);
  const activeTab = useUiStore((state) => state.settingsModalTab || 'general');
  const closeSettingsModal = useUiStore((state) => state.closeSettingsModal);
  const openSettingsModal = useUiStore((state) => state.openSettingsModal);

  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { user, updateSettings, logout } = useAuthStore();
  const { thinkingLevel, setThinkingLevel, isSimulation, toggleSimulation } = useChatStore();
  const { governance, wallet, fetchWallet } = useWalletStore();

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchWallet();
    }
  }, [isOpen, fetchWallet]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeSettingsModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeSettingsModal]);

  if (!isOpen) return null;

  const currentModel = user?.settings?.defaultModel || 'flash';
  const webSearchDefaultOn = user?.settings?.webSearchDefaultOn || false;

  const dailyLimit = governance?.dailyGeminiQuotaLimit || 1500;
  const requestsRemaining = governance?.dailyRequestsRemaining ?? dailyLimit;
  const totalTokens = wallet?.totalTokensConsumed ?? user?.wallet?.totalTokensConsumed ?? 0;
  const creditsRemaining = wallet?.creditsRemaining ?? user?.wallet?.creditsRemaining ?? 100;

  const handleModelChange = async (e) => {
    const newModel = e.target.value;
    const res = await updateSettings({ defaultModel: newModel });
    if (res.success) {
      toast.success('Default model preference updated');
    } else {
      toast.error('Failed to update preference');
    }
  };

  const handleThinkingChange = (e) => {
    const level = e.target.value;
    setThinkingLevel(level);
  };

  const handleWebSearchToggle = async () => {
    const res = await updateSettings({ webSearchDefaultOn: !webSearchDefaultOn });
    if (res.success) {
      toast.success('Web search grounding updated');
    }
  };

  const tabs = [
    { id: 'profile', label: 'Profile & Account', icon: User },
    { id: 'ai_engine', label: 'AI Engine & Tokens', icon: Cpu },
    { id: 'general', label: 'General', icon: Sliders },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'memory', label: 'AI Memory & Tuning', icon: Brain },
    { id: 'wallet', label: 'Wallet & Quota', icon: WalletIcon },
  ];

  if (import.meta.env.DEV) {
    tabs.push({ id: 'design', label: 'Design System', icon: Layers });
  }

  if (user?.role === 'admin') {
    tabs.push({ id: 'admin', label: 'Admin Console', icon: Shield });
  }

  return (
    <>
      <div className={styles.backdrop} onClick={closeSettingsModal} aria-hidden="true" />
      <div
        className={styles.modalDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
      >
        {/* Left Inner Sidebar */}
        <aside className={styles.innerSidebar}>
          <div className={styles.sidebarHeader}>
            <h2 id="settings-dialog-title" className={styles.sidebarTitle}>Settings</h2>
          </div>

          <nav className={styles.tabNav} aria-label="Settings categories">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => openSettingsModal(tab.id)}
                  className={cn(styles.navItem, isActive && styles.navItemActive)}
                  aria-selected={isActive}
                  role="tab"
                >
                  <Icon size={16} className={styles.navIcon} />
                  <span className={styles.navLabel}>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User Profile Card at Bottom of Inner Sidebar */}
          <div
            className={cn(styles.userProfileFooter, activeTab === 'profile' && styles.activeProfileFooter)}
            onClick={() => openSettingsModal('profile')}
            role="button"
            tabIndex={0}
            title="View Profile & Account"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                openSettingsModal('profile');
              }
            }}
          >
            <div className={styles.userAvatarWrap}>
              <Avatar name={user?.name || user?.email || 'User'} size="sm" />
            </div>
            <div className={styles.userInfoWrap}>
              <span className={styles.userName} title={user?.name || user?.email}>
                {user?.name || user?.email?.split('@')[0] || 'User'}
              </span>
              <span className={styles.userEmail} title={user?.email}>
                {user?.email || ''}
              </span>
            </div>
          </div>
        </aside>

        {/* Right Content Panel */}
        <main className={styles.contentPanel}>
          {/* Top Panel Header with Close Button */}
          <header className={styles.contentHeader}>
            <div>
              <h3 className={styles.sectionHeading}>
                {activeTab === 'profile' && 'Profile & Account'}
                {activeTab === 'ai_engine' && 'AI Engine & Token Optimization'}
                {activeTab === 'general' && 'General'}
                {activeTab === 'appearance' && 'Appearance'}
                {activeTab === 'memory' && 'AI Memory & Tuning'}
                {activeTab === 'wallet' && 'Wallet & API Quota'}
                {activeTab === 'design' && 'Design System & Primitives'}
                {activeTab === 'admin' && 'Admin Governance Console'}
              </h3>
              <p className={styles.sectionSubheading}>
                {activeTab === 'profile' && 'Manage your personal profile, credentials, and active session.'}
                {activeTab === 'ai_engine' && 'Configure reasoning depth, dynamic token conservation, and Socratic guardrails.'}
                {activeTab === 'general' && 'Configure foundation models, default preferences, and sandbox settings.'}
                {activeTab === 'appearance' && 'Customize theme mode, typography, contrast, and layout width.'}
                {activeTab === 'memory' && 'Manage long-term knowledge facts and automated memory extraction.'}
                {activeTab === 'wallet' && 'Check credit balance, Gemini quota telemetry, and recharge account.'}
                {activeTab === 'design' && 'Explore UI primitives, token variables, and component guidelines.'}
                {activeTab === 'admin' && 'System configuration, live Gemini telemetry, and governance rules.'}
              </p>
            </div>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={closeSettingsModal}
              title="Close settings (Esc)"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          </header>

          {/* Tab Body View */}
          <div className={styles.tabContentBody}>
            {/* 0. PROFILE & ACCOUNT TAB */}
            {activeTab === 'profile' && (
              <div className={styles.settingsSectionStack}>
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <User size={16} className={styles.accentIcon} />
                    <h4>User Profile & Account</h4>
                  </div>

                  <div className={styles.profileOverviewRow}>
                    <Avatar name={user?.name || user?.email || 'User'} size="lg" />
                    <div className={styles.profileOverviewDetails}>
                      <div className={styles.profileNameLine}>
                        <h5 className={styles.profileDisplayName}>
                          {user?.name || user?.email?.split('@')[0] || 'User'}
                        </h5>
                        <Badge variant={user?.role === 'admin' ? 'warning' : 'primary'} size="sm">
                          {user?.role === 'admin' ? 'Admin' : (user?.wallet?.tier === 'pro_monthly' ? 'Pro Tier' : 'Free Tier')}
                        </Badge>
                      </div>
                      <p className={styles.profileEmailText}>{user?.email || 'No email attached'}</p>
                    </div>
                  </div>

                  <div className={styles.accountMetricsGrid}>
                    <div className={styles.metricBox}>
                      <span className={styles.metricLabel}>Daily Gemini Calls Left</span>
                      <span className={styles.metricValue}>{requestsRemaining.toLocaleString()} / {dailyLimit.toLocaleString()}</span>
                    </div>
                    <div className={styles.metricBox}>
                      <span className={styles.metricLabel}>Available Credits</span>
                      <span className={styles.metricValue}>{creditsRemaining.toLocaleString()}</span>
                    </div>
                    <div className={styles.metricBox}>
                      <span className={styles.metricLabel}>Consumed Tokens</span>
                      <span className={styles.metricValue}>{totalTokens.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className={styles.profileActionRow}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openSettingsModal('wallet')}
                      icon={<WalletIcon size={14} />}
                    >
                      Manage Wallet & Billing
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={async () => {
                        closeSettingsModal();
                        await logout();
                        navigate(ROUTES.LOGIN);
                      }}
                      icon={<LogOut size={14} />}
                    >
                      Sign Out
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 0.5. AI ENGINE & TOKEN OPTIMIZATION TAB */}
            {activeTab === 'ai_engine' && (
              <div className={styles.settingsSectionStack}>
                {/* 1. Reasoning & Thinking Mode */}
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <Brain size={16} className={styles.accentIcon} />
                    <h4>Reasoning & Thinking Budget</h4>
                  </div>
                  <p className={styles.cardDesc}>
                    Controls how deeply Gemini models reason through internal chain-of-thought before outputting answers.
                  </p>

                  <div className={styles.segmentedRow}>
                    <span className={styles.fieldLabel}>Thinking Mode</span>
                    <div className={styles.segmentedControl}>
                      {[
                        { id: 'off', label: 'Off' },
                        { id: 'dynamic', label: 'Dynamic Auto' },
                        { id: 'low', label: 'Low (1k)' },
                        { id: 'medium', label: 'Medium (4k)' },
                        { id: 'high', label: 'High (8k)' },
                      ].map((lvl) => (
                        <button
                          key={lvl.id}
                          type="button"
                          className={cn(
                            styles.segmentedBtn,
                            (user?.settings?.thinkingLevel || thinkingLevel) === lvl.id && styles.segmentedBtnActive,
                          )}
                          onClick={() => {
                            setThinkingLevel(lvl.id);
                            updateSettings({ thinkingLevel: lvl.id });
                          }}
                        >
                          {lvl.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.tipNotice}>
                    <Sparkles size={13} className={styles.tipIcon} />
                    <span>
                      <strong>Dynamic Auto:</strong> Detects query complexity automatically. Simple greetings & lookup queries burn 0 thinking tokens, while complex coding/architecture prompts receive full reasoning budget.
                    </span>
                  </div>
                </div>

                {/* 2. Token Conservation & Context Shield */}
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <Shield size={16} className={styles.accentIcon} />
                    <h4>Token Conservation & Context Shield</h4>
                  </div>

                  <div className={styles.toggleRow}>
                    <div className={styles.toggleInfo}>
                      <span className={styles.toggleLabel}>Smart Token Optimization</span>
                      <span className={styles.toggleDesc}>
                        Prunes redundant historical base64 attachments on past turns and compresses previous turns to prevent exponential token consumption.
                      </span>
                    </div>
                    <Switch
                      checked={user?.settings?.smartTokenOptimization !== false}
                      onChange={(checked) => updateSettings({ smartTokenOptimization: checked })}
                      aria-label="Toggle smart token optimization"
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <Select
                      label="Conversation History Context Window"
                      value={String(user?.settings?.maxContextTurns || 20)}
                      onChange={(e) => updateSettings({ maxContextTurns: Number(e.target.value) })}
                      options={[
                        { value: '10', label: '10 Turns (Lowest token consumption, fast)' },
                        { value: '20', label: '20 Turns (Recommended • Balanced)' },
                        { value: '30', label: '30 Turns (Deep project multi-turn recall)' },
                      ]}
                      hint="Maximum conversation history turns passed to the foundation model."
                    />
                  </div>
                </div>

                {/* 3. Autonomous Search Grounding */}
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <Globe size={16} className={styles.accentIcon} />
                    <h4>Autonomous Web Search Grounding</h4>
                  </div>

                  <div className={styles.toggleRow}>
                    <div className={styles.toggleInfo}>
                      <span className={styles.toggleLabel}>Default Real-Time Web Search</span>
                      <span className={styles.toggleDesc}>
                        AI autonomously queries Google and live web sources whenever real-time facts, documentation, or news are queried.
                      </span>
                    </div>
                    <Switch
                      checked={user?.settings?.webSearchDefaultOn !== false}
                      onChange={(checked) => updateSettings({ webSearchDefaultOn: checked })}
                      aria-label="Toggle default web search"
                    />
                  </div>
                </div>

                {/* 4. Interview Socratic Guardrails */}
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <Cpu size={16} className={styles.accentIcon} />
                    <h4>Technical Interview Socratic Guardrails</h4>
                  </div>
                  <div className={styles.controlGroup}>
                    <Select
                      label="Interview Guidance Policy"
                      value={user?.settings?.interviewGuardrailLevel || 'strict_socratic'}
                      onChange={(e) => updateSettings({ interviewGuardrailLevel: e.target.value })}
                      options={[
                        {
                          value: 'strict_socratic',
                          label: 'Strict Socratic (Hints & guidance only • direct solutions blocked)',
                        },
                        {
                          value: 'guided',
                          label: 'Guided (Hints + architectural skeletons permitted)',
                        },
                        {
                          value: 'direct',
                          label: 'Unrestricted (Allows direct code solutions if requested)',
                        },
                      ]}
                      hint="Enforces anti-cheating guardrails during mock technical screenings."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 1. GENERAL TAB */}
            {activeTab === 'general' && (
              <div className={styles.settingsSectionStack}>
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <Sparkles size={16} className={styles.accentIcon} />
                    <h4>AI Intelligence & Models</h4>
                  </div>

                  <div className={styles.controlGroup}>
                    <Select
                      label="Default Foundation Model"
                      value={currentModel}
                      onChange={handleModelChange}
                      options={[
                        {
                          value: 'flash',
                          label: 'Gemini 2.5 Flash (Fast & Quota-Efficient • 1,500 RPD)',
                        },
                        {
                          value: 'pro',
                          label: 'Gemini 2.5 Pro (Deep Reasoning & Multimodal Depth)',
                        },
                      ]}
                      hint="Google Gemini foundation model used for chat conversations and skill executions."
                    />
                  </div>

                  <div className={styles.controlGroup}>
                    <Select
                      label="Default Reasoning Depth"
                      value={thinkingLevel}
                      onChange={handleThinkingChange}
                      options={[
                        { value: 'off', label: 'Off (Instant response, lowest latency)' },
                        { value: 'dynamic', label: 'Dynamic (Context-aware auto-tuning)' },
                        { value: 'low', label: 'Low (Quick structural outline & sanity checks)' },
                        { value: 'medium', label: 'Medium (Balanced chain-of-thought analysis)' },
                        { value: 'high', label: 'High (Deep mathematical & architectural reasoning)' },
                      ]}
                      hint="Thinking process is visualized step-by-step in the Thought Drawer."
                    />
                  </div>

                  <div className={styles.toggleRow}>
                    <div className={styles.toggleInfo}>
                      <span className={styles.toggleLabel}>
                        <Globe size={14} className={styles.miniIcon} />
                        Web Search Grounding
                      </span>
                      <span className={styles.toggleDesc}>
                        Ground answers with live web search results for current events and library lookups.
                      </span>
                    </div>
                    <Switch
                      checked={user?.settings?.webSearchDefaultOn !== false}
                      onChange={handleWebSearchToggle}
                      aria-label="Toggle web search default"
                    />
                  </div>

                  <div className={styles.toggleRow}>
                    <div className={styles.toggleInfo}>
                      <span className={styles.toggleLabel}>
                        <Cpu size={14} className={styles.miniIcon} />
                        Simulation Sandbox Mode
                      </span>
                      <span className={styles.toggleDesc}>
                        Run local zero-token responses for UI testing and demos without consuming quota.
                      </span>
                    </div>
                    <Switch
                      checked={isSimulation}
                      onChange={toggleSimulation}
                      aria-label="Toggle simulation mode"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. APPEARANCE TAB - CONSUMER-GRADE MODERN THEMES & TYPOGRAPHY */}
            {activeTab === 'appearance' && (
              <div className={styles.appearanceContainer}>
                {/* Header */}
                <div className={styles.appearanceHeader}>
                  <h3 className={styles.appearanceTitle}>Appearance & Display</h3>
                  <p className={styles.appearanceSubtitle}>
                    Configure theme mode, designer color palettes, typography, and reading width.
                  </p>
                </div>

                {/* Section 1: Interface Theme */}
                <div className={styles.appearanceSection}>
                  <h4 className={styles.sectionHeading}>Interface Theme</h4>
                  <div className={styles.themeGrid}>
                    <button
                      type="button"
                      className={cn(
                        styles.themeChoiceCard,
                        user?.settings?.theme === 'system' && styles.themeChoiceCardActive,
                      )}
                      onClick={() => updateSettings({ theme: 'system' })}
                    >
                      <div className={styles.themeIconWrap}>
                        <Monitor size={18} />
                      </div>
                      <div className={styles.themeTextWrap}>
                        <span className={styles.themeChoiceTitle}>System</span>
                        <span className={styles.themeChoiceDesc}>Match your OS preference</span>
                      </div>
                      {user?.settings?.theme === 'system' && <Check size={16} className={styles.themeCheckIcon} />}
                    </button>

                    <button
                      type="button"
                      className={cn(
                        styles.themeChoiceCard,
                        (!isDark && user?.settings?.theme !== 'system') && styles.themeChoiceCardActive,
                      )}
                      onClick={() => {
                        if (isDark) toggleTheme();
                        updateSettings({ theme: 'light' });
                      }}
                    >
                      <div className={styles.themeIconWrap}>
                        <Sun size={18} />
                      </div>
                      <div className={styles.themeTextWrap}>
                        <span className={styles.themeChoiceTitle}>Light Mode</span>
                        <span className={styles.themeChoiceDesc}>Crisp daylight contrast</span>
                      </div>
                      {(!isDark && user?.settings?.theme !== 'system') && <Check size={16} className={styles.themeCheckIcon} />}
                    </button>

                    <button
                      type="button"
                      className={cn(
                        styles.themeChoiceCard,
                        (isDark && user?.settings?.theme !== 'system') && styles.themeChoiceCardActive,
                      )}
                      onClick={() => {
                        if (!isDark) toggleTheme();
                        updateSettings({ theme: 'dark' });
                      }}
                    >
                      <div className={styles.themeIconWrap}>
                        <Moon size={18} />
                      </div>
                      <div className={styles.themeTextWrap}>
                        <span className={styles.themeChoiceTitle}>Dark Mode</span>
                        <span className={styles.themeChoiceDesc}>Deep OLED obsidian</span>
                      </div>
                      {(isDark && user?.settings?.theme !== 'system') && <Check size={16} className={styles.themeCheckIcon} />}
                    </button>
                  </div>
                </div>

                {/* Section 2: Curated Color Palettes */}
                <div className={styles.appearanceSection}>
                  <h4 className={styles.sectionHeading}>
                    {isDark ? 'Dark Theme Palette' : 'Light Theme Palette'}
                  </h4>
                  <div className={styles.paletteGrid}>
                    {isDark ? (
                      <>
                        <button
                          type="button"
                          className={cn(
                            styles.paletteCard,
                            (user?.settings?.themePresetDark === 'Obsidian Noir' ||
                              !user?.settings?.themePresetDark) &&
                              styles.paletteCardActive,
                          )}
                          onClick={() => {
                            updateSettings({
                              themePresetDark: 'Obsidian Noir',
                              customColors: {
                                darkBg: '#09090b',
                                darkAccent: '#10b981',
                              },
                            });
                          }}
                        >
                          <div className={styles.paletteSwatches}>
                            <span className={styles.swatchDot} style={{ background: '#09090b', border: '1px solid #27272a' }} />
                            <span className={styles.swatchDot} style={{ background: '#10b981' }} />
                          </div>
                          <div className={styles.paletteInfo}>
                            <span className={styles.paletteName}>Obsidian Noir</span>
                            <span className={styles.paletteDesc}>Minimalist deep black with emerald accents</span>
                          </div>
                          {(user?.settings?.themePresetDark === 'Obsidian Noir' ||
                            !user?.settings?.themePresetDark) && <Check size={14} className={styles.paletteCheck} />}
                        </button>

                        <button
                          type="button"
                          className={cn(
                            styles.paletteCard,
                            user?.settings?.themePresetDark === 'Cyberpunk Glow' &&
                              styles.paletteCardActive,
                          )}
                          onClick={() => {
                            updateSettings({
                              themePresetDark: 'Cyberpunk Glow',
                              customColors: {
                                darkBg: '#070708',
                                darkAccent: '#a2ff00',
                              },
                            });
                          }}
                        >
                          <div className={styles.paletteSwatches}>
                            <span className={styles.swatchDot} style={{ background: '#070708', border: '1px solid #27272a' }} />
                            <span className={styles.swatchDot} style={{ background: '#a2ff00' }} />
                          </div>
                          <div className={styles.paletteInfo}>
                            <span className={styles.paletteName}>Cyberpunk Glow</span>
                            <span className={styles.paletteDesc}>High-contrast carbon with electric lime</span>
                          </div>
                          {user?.settings?.themePresetDark === 'Cyberpunk Glow' && <Check size={14} className={styles.paletteCheck} />}
                        </button>

                        <button
                          type="button"
                          className={cn(
                            styles.paletteCard,
                            user?.settings?.themePresetDark === 'Nordic Slate' &&
                              styles.paletteCardActive,
                          )}
                          onClick={() => {
                            updateSettings({
                              themePresetDark: 'Nordic Slate',
                              customColors: {
                                darkBg: '#0f172a',
                                darkAccent: '#6366f1',
                              },
                            });
                          }}
                        >
                          <div className={styles.paletteSwatches}>
                            <span className={styles.swatchDot} style={{ background: '#0f172a', border: '1px solid #334155' }} />
                            <span className={styles.swatchDot} style={{ background: '#6366f1' }} />
                          </div>
                          <div className={styles.paletteInfo}>
                            <span className={styles.paletteName}>Nordic Slate</span>
                            <span className={styles.paletteDesc}>Slate navy base with electric indigo</span>
                          </div>
                          {user?.settings?.themePresetDark === 'Nordic Slate' && <Check size={14} className={styles.paletteCheck} />}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={cn(
                            styles.paletteCard,
                            (user?.settings?.themePresetLight === 'Clean Daylight' ||
                              !user?.settings?.themePresetLight) &&
                              styles.paletteCardActive,
                          )}
                          onClick={() => {
                            updateSettings({
                              themePresetLight: 'Clean Daylight',
                              customColors: {
                                lightBg: '#f8fafc',
                                lightAccent: '#4f46e5',
                              },
                            });
                          }}
                        >
                          <div className={styles.paletteSwatches}>
                            <span className={styles.swatchDot} style={{ background: '#ffffff', border: '1px solid #cbd5e1' }} />
                            <span className={styles.swatchDot} style={{ background: '#4f46e5' }} />
                          </div>
                          <div className={styles.paletteInfo}>
                            <span className={styles.paletteName}>Clean Daylight</span>
                            <span className={styles.paletteDesc}>Pure crisp white with royal indigo</span>
                          </div>
                          {(user?.settings?.themePresetLight === 'Clean Daylight' ||
                            !user?.settings?.themePresetLight) && <Check size={14} className={styles.paletteCheck} />}
                        </button>

                        <button
                          type="button"
                          className={cn(
                            styles.paletteCard,
                            user?.settings?.themePresetLight === 'Warm Minimal' &&
                              styles.paletteCardActive,
                          )}
                          onClick={() => {
                            updateSettings({
                              themePresetLight: 'Warm Minimal',
                              customColors: {
                                lightBg: '#fbfbfb',
                                lightAccent: '#059669',
                              },
                            });
                          }}
                        >
                          <div className={styles.paletteSwatches}>
                            <span className={styles.swatchDot} style={{ background: '#fbfbfb', border: '1px solid #cbd5e1' }} />
                            <span className={styles.swatchDot} style={{ background: '#059669' }} />
                          </div>
                          <div className={styles.paletteInfo}>
                            <span className={styles.paletteName}>Warm Minimal</span>
                            <span className={styles.paletteDesc}>Warm cream paper with emerald green</span>
                          </div>
                          {user?.settings?.themePresetLight === 'Warm Minimal' && <Check size={14} className={styles.paletteCheck} />}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Section 3: Typography & Fonts */}
                <div className={styles.appearanceSection}>
                  <h4 className={styles.sectionHeading}>Typography</h4>
                  <div className={styles.groupCard}>
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Font Family</span>
                        <span className={styles.rowSubtitle}>
                          Primary typeface across the entire workspace and UI.
                        </span>
                      </div>
                      <select
                        className={styles.nativeDropdown}
                        value={user?.settings?.font || 'Plus Jakarta Sans'}
                        onChange={(e) => updateSettings({ font: e.target.value })}
                        aria-label="Font family"
                      >
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans (Recommended • Modern AI)</option>
                        <option value="Inter">Inter (Clean Neutral)</option>
                        <option value="JetBrains Mono">JetBrains Mono (Developer Mono)</option>
                        <option value="System Default">System Default</option>
                      </select>
                    </div>

                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Font Size</span>
                        <span className={styles.rowSubtitle}>
                          Base font size for reading messages and editor text.
                        </span>
                      </div>
                      <div className={styles.segmentedPill}>
                        {[
                          { id: '13px', label: '13px' },
                          { id: '14px', label: '14px' },
                          { id: '15px', label: '15px' },
                          { id: '16px', label: '16px' },
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className={cn(
                              styles.segmentedPillBtn,
                              (user?.settings?.fontSize || '14px') === s.id &&
                                styles.segmentedPillBtnActive,
                            )}
                            onClick={() => updateSettings({ fontSize: s.id })}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 4: Chat & Reading Layout */}
                <div className={styles.appearanceSection}>
                  <h4 className={styles.sectionHeading}>Chat & Reading Layout</h4>
                  <div className={styles.groupCard}>
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Conversation Width</span>
                        <span className={styles.rowSubtitle}>
                          Maximum width of chat messages and markdown blocks.
                        </span>
                      </div>
                      <div className={styles.segmentedPill}>
                        {[
                          { id: 'narrow', label: 'Narrow' },
                          { id: 'default', label: 'Default' },
                          { id: 'wide', label: 'Wide' },
                          { id: 'fill', label: 'Full Width' },
                        ].map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            className={cn(
                              styles.segmentedPillBtn,
                              (user?.settings?.conversationWidth || 'wide') === w.id &&
                                styles.segmentedPillBtnActive,
                            )}
                            onClick={() => updateSettings({ conversationWidth: w.id })}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Conversation steps</span>
                        <span className={styles.rowSubtitle}>
                          Choose how much detail is shown during a conversation.
                        </span>
                      </div>
                      <div className={styles.segmentedPill}>
                        {['default', 'verbose'].map((step) => (
                          <button
                            key={step}
                            type="button"
                            className={cn(
                              styles.segmentedPillBtn,
                              (user?.settings?.conversationSteps || 'default') === step &&
                                styles.segmentedPillBtnActive,
                            )}
                            onClick={() => updateSettings({ conversationSteps: step })}
                          >
                            {step.charAt(0).toUpperCase() + step.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 5: Accessibility */}
                <div className={styles.appearanceSection}>
                  <h4 className={styles.sectionHeading}>Accessibility</h4>
                  <div className={styles.groupCard}>
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Screen reader mode</span>
                        <span className={styles.rowSubtitle}>
                          Optimize the interface and terminal output for screen readers.
                        </span>
                      </div>
                      <Switch
                        checked={Boolean(user?.settings?.screenReaderMode)}
                        onChange={(checked) => updateSettings({ screenReaderMode: checked })}
                        aria-label="Toggle screen reader mode"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. AI MEMORY & TUNING TAB */}
            {activeTab === 'memory' && (
              <div className={styles.memoryContainer}>
                <MemoryManager />
              </div>
            )}

            {/* 4. WALLET & QUOTA TAB */}
            {activeTab === 'wallet' && (
              <div className={styles.settingsSectionStack}>
                <div className={styles.walletStatsRow}>
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>Available Credits</span>
                    <span className={styles.statValue}>{creditsRemaining.toLocaleString()}</span>
                    <span className={styles.statSub}>Balance for AI operations</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>Gemini Free Calls Today</span>
                    <span className={styles.statValueAccent}>{requestsRemaining.toLocaleString()}</span>
                    <span className={styles.statSub}>Limit: {dailyLimit.toLocaleString()} RPD</span>
                  </div>
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>Total Tokens Consumed</span>
                    <span className={styles.statValue}>{totalTokens.toLocaleString()}</span>
                    <span className={styles.statSub}>Real-time usage tracked</span>
                  </div>
                </div>

                <div className={styles.settingCard}>
                  <div className={styles.cardHeaderFlex}>
                    <div>
                      <h4 style={{ margin: 0 }}>Add Credits to Workspace</h4>
                      <p className={styles.cardSubtitle}>
                        Credits are deducted atomically based on real Gemini tokens (ceil(tokens / 100)).
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<CreditCard size={14} />}
                      onClick={() => setIsPaymentModalOpen(true)}
                    >
                      Recharge Credits
                    </Button>
                  </div>
                </div>

                <div className={styles.settingCard}>
                  <div className={styles.cardHeaderFlex}>
                    <div>
                      <h4 style={{ margin: 0 }}>Full Transaction Ledger</h4>
                      <p className={styles.cardSubtitle}>
                        Inspect itemized usage logs, token deductions, and Razorpay receipts.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      rightIcon={<ArrowRight size={14} />}
                      onClick={() => {
                        closeSettingsModal();
                        navigate(ROUTES.WALLET);
                      }}
                    >
                      Open Full Wallet Page
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 5. DESIGN SYSTEM TAB */}
            {activeTab === 'design' && (
              <div className={styles.settingsSectionStack}>
                <div className={styles.settingCard}>
                  <div className={styles.cardHeaderFlex}>
                    <div>
                      <h4 style={{ margin: 0 }}>Design System Explorer</h4>
                      <p className={styles.cardSubtitle}>
                        Living catalog of UI primitives, typography tokens, colors, and layout primitives.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      rightIcon={<ArrowRight size={14} />}
                      onClick={() => {
                        closeSettingsModal();
                        navigate(ROUTES.DESIGN_SYSTEM);
                      }}
                    >
                      Open Design System
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 6. ADMIN TAB */}
            {activeTab === 'admin' && (
              <div className={styles.settingsSectionStack}>
                <div className={styles.settingCard}>
                  <div className={styles.cardHeaderFlex}>
                    <div>
                      <h4 style={{ margin: 0 }}>Platform Administration</h4>
                      <p className={styles.cardSubtitle}>
                        System config, live Gemini quota telemetry, and system error audit logs.
                      </p>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      rightIcon={<ArrowRight size={14} />}
                      onClick={() => {
                        closeSettingsModal();
                        navigate(ROUTES.ADMIN);
                      }}
                    >
                      Open Admin Portal
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Embedded Razorpay Payment Modal */}
      {isPaymentModalOpen && (
        <RazorpayPaymentModal
          open={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
        />
      )}
    </>
  );
}

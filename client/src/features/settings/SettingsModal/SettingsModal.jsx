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

const LIGHT_PRESETS = {
  'Legacy Light': { bg: '#F9F9F9', fg: '#101010', accent: '#007ACC' },
  'Pure White': { bg: '#FFFFFF', fg: '#0F172A', accent: '#4F46E5' },
  'Soft Cream': { bg: '#FBFBFB', fg: '#1C1917', accent: '#059669' },
  'GitHub Light': { bg: '#F6F8FA', fg: '#1F2328', accent: '#0969DA' },
  'Solarized Light': { bg: '#FDF6E3', fg: '#002B36', accent: '#268BD2' },
};

const DARK_PRESETS = {
  'Default Dark': { bg: '#070708', fg: '#FFFFFF', accent: '#A2FF00' },
  'Obsidian OLED': { bg: '#000000', fg: '#EDEDED', accent: '#8B5CF6' },
  'Tokyo Night': { bg: '#1A1B26', fg: '#C0CAF5', accent: '#7AA2F7' },
  'Monokai Pro': { bg: '#2D2A2E', fg: '#FCFCFA', accent: '#FFD866' },
  'Nord Midnight': { bg: '#2E3440', fg: '#ECEFF4', accent: '#88C0D0' },
};

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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(true);
  const [isLightCodePreviewOpen, setIsLightCodePreviewOpen] = useState(false);
  const [isDarkCodePreviewOpen, setIsDarkCodePreviewOpen] = useState(false);

  const customColors = user?.settings?.customColors || {};
  const lightBg = customColors.lightBg || '#F9F9F9';
  const lightFg = customColors.lightFg || '#101010';
  const lightAccent = customColors.lightAccent || '#007ACC';

  const darkBg = customColors.darkBg || '#070708';
  const darkFg = customColors.darkFg || '#FFFFFF';
  const darkAccent = customColors.darkAccent || '#A2FF00';

  const handleLightPresetChange = (presetName) => {
    const preset = LIGHT_PRESETS[presetName] || LIGHT_PRESETS['Legacy Light'];
    updateSettings({
      themePresetLight: presetName,
      customColors: {
        ...customColors,
        lightBg: preset.bg,
        lightFg: preset.fg,
        lightAccent: preset.accent,
      },
    });
  };

  const handleDarkPresetChange = (presetName) => {
    const preset = DARK_PRESETS[presetName] || DARK_PRESETS['Default Dark'];
    updateSettings({
      themePresetDark: presetName,
      customColors: {
        ...customColors,
        darkBg: preset.bg,
        darkFg: preset.fg,
        darkAccent: preset.accent,
      },
    });
  };

  const handleResetDarkTheme = () => {
    handleDarkPresetChange('Default Dark');
    toast.success('Dark theme reset to Default Dark');
  };

  const handleColorChange = (key, val) => {
    updateSettings({
      customColors: {
        ...customColors,
        [key]: val,
      },
    });
  };

  const renderColorPickerRow = (key, currentVal) => (
    <div className={styles.colorInputGroup}>
      <label className={styles.colorSwatchWrap}>
        <input
          type="color"
          value={currentVal}
          onChange={(e) => handleColorChange(key, e.target.value.toUpperCase())}
          className={styles.hiddenColorInput}
        />
        <span
          className={styles.colorSwatch}
          style={{ backgroundColor: currentVal }}
        />
      </label>
      <div className={styles.hexInputWrap}>
        <span className={styles.hexHash}>#</span>
        <input
          type="text"
          value={currentVal.replace(/^#/, '')}
          maxLength={6}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '');
            if (val.length === 6) {
              handleColorChange(key, `#${val.toUpperCase()}`);
            }
          }}
          className={styles.hexInput}
        />
      </div>
    </div>
  );

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
  const webSearchDefaultOn = user?.settings?.webSearchDefaultOn !== false;

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

  const handleThinkingChange = async (e) => {
    const level = e.target.value;
    setThinkingLevel(level);
    const res = await updateSettings({ thinkingLevel: level });
    if (res.success) {
      toast.success(`Thinking depth set to ${level.toUpperCase()}`);
    }
  };

  const handleWebSearchToggle = async () => {
    const nextVal = !webSearchDefaultOn;
    const res = await updateSettings({ webSearchDefaultOn: nextVal });
    if (res.success) {
      toast.success(nextVal ? 'Web search grounding enabled' : 'Web search grounding disabled');
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
                  <h3 className={styles.appearanceTitle}>Appearance</h3>
                  <p className={styles.appearanceSubtitle}>
                    Configure the agent&apos;s visual theme and display preferences.
                  </p>
                </div>

                {/* Section 1: Chat */}
                <div className={styles.appearanceSection}>
                  <h4 className={styles.sectionHeading}>Chat</h4>
                  <div className={styles.groupCard}>
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

                {/* Section 2: Appearance Controls (Theme, Contrast, Font, Font size) */}
                <div className={styles.appearanceSection}>
                  <h4 className={styles.sectionHeading}>Appearance</h4>
                  <div className={styles.groupCard}>
                    {/* Theme */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Theme</span>
                      </div>
                      <div className={styles.segmentedIcons}>
                        <button
                          type="button"
                          className={cn(
                            styles.segmentedIconBtn,
                            user?.settings?.theme === 'system' && styles.segmentedIconBtnActive,
                          )}
                          onClick={() => {
                            updateSettings({ theme: 'system' });
                            useUiStore.getState().setTheme('system');
                          }}
                          title="System Theme (Match OS)"
                          aria-label="System Theme"
                        >
                          <Monitor size={15} />
                        </button>
                        <button
                          type="button"
                          className={cn(
                            styles.segmentedIconBtn,
                            (user?.settings?.theme === 'light' || (!isDark && user?.settings?.theme !== 'system')) &&
                              styles.segmentedIconBtnActive,
                          )}
                          onClick={() => {
                            if (isDark) toggleTheme();
                            updateSettings({ theme: 'light' });
                            useUiStore.getState().setTheme('light');
                          }}
                          title="Light Mode"
                          aria-label="Light Mode"
                        >
                          <Sun size={15} />
                        </button>
                        <button
                          type="button"
                          className={cn(
                            styles.segmentedIconBtn,
                            (user?.settings?.theme === 'dark' || (isDark && user?.settings?.theme !== 'system')) &&
                              styles.segmentedIconBtnActive,
                          )}
                          onClick={() => {
                            if (!isDark) toggleTheme();
                            updateSettings({ theme: 'dark' });
                            useUiStore.getState().setTheme('dark');
                          }}
                          title="Dark Mode"
                          aria-label="Dark Mode"
                        >
                          <Moon size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Contrast */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Contrast</span>
                      </div>
                      <div className={styles.segmentedPill}>
                        {['default', 'strong'].map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={cn(
                              styles.segmentedPillBtn,
                              (user?.settings?.contrast || 'default') === c &&
                                styles.segmentedPillBtnActive,
                            )}
                            onClick={() => updateSettings({ contrast: c })}
                          >
                            {c.charAt(0).toUpperCase() + c.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Font */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Font</span>
                      </div>
                      <select
                        className={styles.nativeDropdown}
                        value={user?.settings?.font || 'Google Sans'}
                        onChange={(e) => updateSettings({ font: e.target.value })}
                        aria-label="Font family"
                      >
                        <option value="Google Sans">Google Sans</option>
                        <option value="Inter">Inter</option>
                        <option value="Geist">Geist</option>
                        <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
                        <option value="JetBrains Mono">JetBrains Mono</option>
                        <option value="Fira Code">Fira Code</option>
                        <option value="System Default">System Default</option>
                      </select>
                    </div>

                    {/* Font size */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Font size</span>
                      </div>
                      <select
                        className={styles.nativeDropdown}
                        value={user?.settings?.fontSize || '14px'}
                        onChange={(e) => updateSettings({ fontSize: e.target.value })}
                        aria-label="Font size"
                      >
                        <option value="12px">12px</option>
                        <option value="13px">13px</option>
                        <option value="14px">14px</option>
                        <option value="15px">15px</option>
                        <option value="16px">16px</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Light Theme */}
                <div className={styles.appearanceSection}>
                  <h4 className={styles.sectionHeading}>Light Theme</h4>
                  <div className={styles.groupCard}>
                    {/* Preset */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Preset</span>
                      </div>
                      <select
                        className={styles.nativeDropdown}
                        value={user?.settings?.themePresetLight || 'Legacy Light'}
                        onChange={(e) => handleLightPresetChange(e.target.value)}
                        aria-label="Light theme preset"
                      >
                        <option value="Legacy Light">Legacy Light</option>
                        <option value="Pure White">Pure White</option>
                        <option value="Soft Cream">Soft Cream</option>
                        <option value="GitHub Light">GitHub Light</option>
                        <option value="Solarized Light">Solarized Light</option>
                      </select>
                    </div>

                    {/* Background */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Background</span>
                      </div>
                      {renderColorPickerRow('lightBg', lightBg)}
                    </div>

                    {/* Foreground */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Foreground</span>
                      </div>
                      {renderColorPickerRow('lightFg', lightFg)}
                    </div>

                    {/* Accent */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Accent</span>
                      </div>
                      {renderColorPickerRow('lightAccent', lightAccent)}
                    </div>

                    {/* Code Preview Accordion */}
                    <div className={styles.codePreviewWrapper}>
                      <button
                        type="button"
                        className={styles.codePreviewTrigger}
                        onClick={() => setIsLightCodePreviewOpen((prev) => !prev)}
                        aria-expanded={isLightCodePreviewOpen}
                      >
                        <span>Code Preview</span>
                        {isLightCodePreviewOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {isLightCodePreviewOpen && (
                        <div
                          className={styles.codePreviewBox}
                          style={{
                            backgroundColor: lightBg,
                            color: lightFg,
                            borderColor: 'rgba(128, 128, 128, 0.2)',
                          }}
                        >
                          <div className={styles.codePreviewLine}>
                            <span style={{ color: lightAccent, fontWeight: 600 }}>function</span>{' '}
                            <span style={{ color: lightFg, fontWeight: 600 }}>calculateTotal</span>
                            <span>(tokens, rate) &#123;</span>
                          </div>
                          <div className={styles.codePreviewLine} style={{ paddingLeft: 16 }}>
                            <span style={{ opacity: 0.6 }}>{'// Real-time utility billing computation'}</span>
                          </div>
                          <div className={styles.codePreviewLine} style={{ paddingLeft: 16 }}>
                            <span style={{ color: lightAccent, fontWeight: 600 }}>const</span> credits = Math.ceil(tokens / rate);
                          </div>
                          <div className={styles.codePreviewLine} style={{ paddingLeft: 16 }}>
                            <span style={{ color: lightAccent, fontWeight: 600 }}>return</span> credits;
                          </div>
                          <div className={styles.codePreviewLine}>
                            <span>&#125;</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 4: Dark Theme */}
                <div className={styles.appearanceSection}>
                  <h4 className={styles.sectionHeading}>Dark Theme</h4>
                  <div className={styles.groupCard}>
                    {/* Preset with Reset Icon */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Preset</span>
                      </div>
                      <div className={styles.presetSelectGroup}>
                        <button
                          type="button"
                          className={styles.resetBtn}
                          onClick={handleResetDarkTheme}
                          title="Reset to Default Dark"
                          aria-label="Reset dark theme"
                        >
                          <RotateCcw size={13} />
                        </button>
                        <select
                          className={styles.nativeDropdown}
                          value={user?.settings?.themePresetDark || 'Default Dark'}
                          onChange={(e) => handleDarkPresetChange(e.target.value)}
                          aria-label="Dark theme preset"
                        >
                          <option value="Default Dark">Default Dark</option>
                          <option value="Obsidian OLED">Obsidian OLED</option>
                          <option value="Tokyo Night">Tokyo Night</option>
                          <option value="Monokai Pro">Monokai Pro</option>
                          <option value="Nord Midnight">Nord Midnight</option>
                        </select>
                      </div>
                    </div>

                    {/* Background */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Background</span>
                      </div>
                      {renderColorPickerRow('darkBg', darkBg)}
                    </div>

                    {/* Foreground */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Foreground</span>
                      </div>
                      {renderColorPickerRow('darkFg', darkFg)}
                    </div>

                    {/* Accent */}
                    <div className={styles.rowItem}>
                      <div className={styles.rowText}>
                        <span className={styles.rowTitle}>Accent</span>
                      </div>
                      {renderColorPickerRow('darkAccent', darkAccent)}
                    </div>

                    {/* Code Preview Accordion */}
                    <div className={styles.codePreviewWrapper}>
                      <button
                        type="button"
                        className={styles.codePreviewTrigger}
                        onClick={() => setIsDarkCodePreviewOpen((prev) => !prev)}
                        aria-expanded={isDarkCodePreviewOpen}
                      >
                        <span>Code Preview</span>
                        {isDarkCodePreviewOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                      {isDarkCodePreviewOpen && (
                        <div
                          className={styles.codePreviewBox}
                          style={{
                            backgroundColor: darkBg,
                            color: darkFg,
                            borderColor: 'rgba(128, 128, 128, 0.2)',
                          }}
                        >
                          <div className={styles.codePreviewLine}>
                            <span style={{ color: darkAccent, fontWeight: 600 }}>function</span>{' '}
                            <span style={{ color: darkFg, fontWeight: 600 }}>calculateTotal</span>
                            <span>(tokens, rate) &#123;</span>
                          </div>
                          <div className={styles.codePreviewLine} style={{ paddingLeft: 16 }}>
                            <span style={{ opacity: 0.6 }}>{'// Real-time utility billing computation'}</span>
                          </div>
                          <div className={styles.codePreviewLine} style={{ paddingLeft: 16 }}>
                            <span style={{ color: darkAccent, fontWeight: 600 }}>const</span> credits = Math.ceil(tokens / rate);
                          </div>
                          <div className={styles.codePreviewLine} style={{ paddingLeft: 16 }}>
                            <span style={{ color: darkAccent, fontWeight: 600 }}>return</span> credits;
                          </div>
                          <div className={styles.codePreviewLine}>
                            <span>&#125;</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 5: Advanced Settings (Expandable Accordion) */}
                <div className={styles.appearanceSection}>
                  <button
                    type="button"
                    className={styles.advancedAccordionHeader}
                    onClick={() => setIsAdvancedOpen((prev) => !prev)}
                    aria-expanded={isAdvancedOpen}
                  >
                    <span>Advanced Settings</span>
                    {isAdvancedOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>

                  {isAdvancedOpen && (
                    <div className={styles.advancedAccordionContent}>
                      {/* Chat Layout */}
                      <div className={styles.advancedSubSection}>
                        <h5 className={styles.subHeading}>Chat Layout</h5>
                        <div className={styles.groupCard}>
                          <div className={styles.rowItem}>
                            <div className={styles.rowText}>
                              <span className={styles.rowTitle}>Conversation width</span>
                              <span className={styles.rowSubtitle}>
                                Configure the maximum width of the conversation panel.
                              </span>
                            </div>
                            <div className={styles.segmentedPill}>
                              {[
                                { id: 'narrow', label: 'Narrow' },
                                { id: 'default', label: 'Default' },
                                { id: 'wide', label: 'Wide' },
                                { id: 'fill', label: 'Fill' },
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
                        </div>
                      </div>

                      {/* Accessibility */}
                      <div className={styles.advancedSubSection}>
                        <h5 className={styles.subHeading}>Accessibility</h5>
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

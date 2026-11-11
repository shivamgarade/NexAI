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
                {activeTab === 'general' && 'General'}
                {activeTab === 'appearance' && 'Appearance'}
                {activeTab === 'memory' && 'AI Memory & Tuning'}
                {activeTab === 'wallet' && 'Wallet & API Quota'}
                {activeTab === 'design' && 'Design System & Primitives'}
                {activeTab === 'admin' && 'Admin Governance Console'}
              </h3>
              <p className={styles.sectionSubheading}>
                {activeTab === 'profile' && 'Manage your personal profile, credentials, and active session.'}
                {activeTab === 'general' && 'Configure foundation models, reasoning depth, and grounding preferences.'}
                {activeTab === 'appearance' && 'Customize theme mode and interface display settings.'}
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
                      checked={webSearchDefaultOn}
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

            {/* 2. APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <div className={styles.settingsSectionStack}>
                <div className={styles.settingCard}>
                  <div className={styles.settingCardHeader}>
                    <Palette size={16} className={styles.accentIcon} />
                    <h4>Theme & Display</h4>
                  </div>

                  <div className={styles.toggleRow}>
                    <div className={styles.toggleInfo}>
                      <span className={styles.toggleLabel}>Dark Mode</span>
                      <span className={styles.toggleDesc}>
                        Switch between sleek dark and light appearance modes across the entire workspace.
                      </span>
                    </div>
                    <Switch
                      checked={isDark}
                      onChange={() => {
                        toggleTheme();
                        if (user) {
                          updateSettings({ theme: isDark ? 'light' : 'dark' });
                        }
                      }}
                      aria-label="Toggle dark mode"
                    />
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

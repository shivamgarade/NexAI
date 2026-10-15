import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Palette,
  Sparkles,
  Globe,
  User,
  ArrowRight,
  Cpu,
  Brain,
  ShieldCheck,
  Check,
  Sun,
  Moon,
  Download,
  Smartphone,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { useTheme } from '@/hooks/useTheme';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useWalletStore } from '@/store/walletStore';
import { MemoryManager } from '@/features/memory';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './SettingsPage.module.scss';

const SETTINGS_TABS = [
  {
    id: 'general',
    label: 'General',
    description: 'Appearance & workspace profile',
    icon: Palette,
  },
  {
    id: 'intelligence',
    label: 'AI & Intelligence',
    description: 'Models, reasoning & autonomous tools',
    icon: Sparkles,
  },
  {
    id: 'memory',
    label: 'Personalization & Memory',
    description: 'Cross-chat memory bank & custom directives',
    icon: Brain,
  },
  {
    id: 'quota',
    label: 'Account & Quota',
    description: 'Gemini free-tier allowance & token usage',
    icon: ShieldCheck,
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'general';

  const { isDark, toggleTheme } = useTheme();
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();
  const { user, updateSettings } = useAuthStore();
  const { thinkingLevel, setThinkingLevel, isSimulation, toggleSimulation } = useChatStore();
  const { governance, wallet, fetchWallet } = useWalletStore();

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const currentModel = user?.settings?.defaultModel || 'flash';
  const webSearchDefaultOn = user?.settings?.webSearchDefaultOn || false;
  const toolExecutionMode = user?.settings?.toolExecutionMode || 'auto';

  const dailyLimit = governance?.dailyGeminiQuotaLimit || 1500;
  const requestsRemaining = governance?.dailyRequestsRemaining ?? dailyLimit;
  const totalTokens = wallet?.totalTokensConsumed ?? user?.wallet?.totalTokensConsumed ?? 0;

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  const handleThemeChange = async () => {
    toggleTheme();
    const nextTheme = isDark ? 'light' : 'dark';
    if (user) {
      await updateSettings({ theme: nextTheme });
    }
  };

  const handleSelectThemeMode = async (mode) => {
    if ((mode === 'dark' && !isDark) || (mode === 'light' && isDark)) {
      toggleTheme();
      if (user) {
        await updateSettings({ theme: mode });
      }
    }
  };

  const handleModelChange = async (e) => {
    const newModel = e.target.value;
    const res = await updateSettings({ defaultModel: newModel });
    if (res.success) {
      toast.success('Default model preference updated');
    } else {
      toast.error('Failed to update preference');
    }
  };

  const handleToolExecutionModeChange = async (e) => {
    const newMode = e.target.value;
    const res = await updateSettings({ toolExecutionMode: newMode });
    if (res.success) {
      toast.success('Tool execution policy updated');
    } else {
      toast.error('Failed to update tool policy');
    }
  };

  const handleThinkingChange = (e) => {
    const level = e.target.value;
    setThinkingLevel(level);
    toast.success(`Thinking depth set to ${level.toUpperCase()}`);
  };

  const handleWebSearchToggle = async () => {
    const res = await updateSettings({ webSearchDefaultOn: !webSearchDefaultOn });
    if (res.success) {
      toast.success('Web search default updated');
    }
  };

  return (
    <div className={styles.container}>
      <PageHeader
        title="Settings & Preferences"
        description="Configure your appearance, default AI engine, thinking levels, memory directives, and API quota."
      />

      <div className={styles.settingsLayout}>
        {/* Responsive Tab Navigation */}
        <nav className={styles.tabNav} aria-label="Settings navigation">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={cn(styles.tabBtn, isActive && styles.activeTab)}
                onClick={() => handleTabChange(tab.id)}
                role="tab"
                aria-selected={isActive}
              >
                <div className={styles.tabIcon}>
                  <Icon size={18} />
                </div>
                <div className={styles.tabMeta}>
                  <span className={styles.tabLabel}>{tab.label}</span>
                  <span className={styles.tabDesc}>{tab.description}</span>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Tab Content Display */}
        <main className={styles.tabContent} role="tabpanel">
          {/* TAB 1: GENERAL & APPEARANCE */}
          {activeTab === 'general' && (
            <div className={styles.tabSectionStack}>
              <Card padding="md" className={styles.sectionCard}>
                <Card.Header>
                  <div className={styles.cardHeaderContent}>
                    <div className={styles.headerIcon}>
                      <Palette size={18} />
                    </div>
                    <div className={styles.headerText}>
                      <h3 className={styles.cardTitle}>Appearance & Theme</h3>
                      <p className={styles.cardSubtitle}>
                        Customize the visual styling, theme mode, and workspace presentation
                      </p>
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className={styles.cardBody}>
                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingLabel}>Dark Theme Mode</span>
                      <span className={styles.settingDesc}>
                        Quickly toggle between dark and light appearance modes across all workspace views
                      </span>
                    </div>
                    <Switch
                      checked={isDark}
                      onChange={handleThemeChange}
                      aria-label="Toggle dark theme"
                    />
                  </div>

                  <div className={styles.themeCardsGrid}>
                    <div
                      className={cn(styles.themePreviewCard, isDark && styles.themeCardActive)}
                      onClick={() => handleSelectThemeMode('dark')}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.themePreviewDark}>
                        <div className={styles.previewSidebar} />
                        <div className={styles.previewContent}>
                          <div className={styles.previewLine} />
                          <div className={styles.previewBox} />
                        </div>
                      </div>
                      <div className={styles.themeCardFooter}>
                        <div className={styles.themeNameRow}>
                          <Moon size={14} />
                          <span>Dark Mode (Default)</span>
                        </div>
                        {isDark && <Check size={14} className={styles.activeCheck} />}
                      </div>
                    </div>

                    <div
                      className={cn(styles.themePreviewCard, !isDark && styles.themeCardActive)}
                      onClick={() => handleSelectThemeMode('light')}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.themePreviewLight}>
                        <div className={styles.previewSidebar} />
                        <div className={styles.previewContent}>
                          <div className={styles.previewLine} />
                          <div className={styles.previewBox} />
                        </div>
                      </div>
                      <div className={styles.themeCardFooter}>
                        <div className={styles.themeNameRow}>
                          <Sun size={14} />
                          <span>Light Mode</span>
                        </div>
                        {!isDark && <Check size={14} className={styles.activeCheck} />}
                      </div>
                    </div>
                  </div>
                </Card.Body>
              </Card>

              <Card padding="md" className={styles.sectionCard}>
                <Card.Header>
                  <div className={styles.cardHeaderContent}>
                    <div className={styles.headerIcon}>
                      <Smartphone size={18} />
                    </div>
                    <div className={styles.headerText}>
                      <h3 className={styles.cardTitle}>Progressive Web App (PWA)</h3>
                      <p className={styles.cardSubtitle}>
                        Install NexAI as a native-like standalone app on mobile or desktop with instant loading
                      </p>
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className={styles.cardBody}>
                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingLabel}>Installation State</span>
                      <span className={styles.settingDesc}>
                        {isInstalled
                          ? 'NexAI is currently active as an installed standalone web application.'
                          : 'Install to your device home screen or dock for quick access and full-screen experience.'}
                      </span>
                    </div>
                    {isInstalled ? (
                      <Badge tone="accent">Installed</Badge>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        leftIcon={<Download size={14} />}
                        onClick={promptInstall}
                        disabled={!isInstallable}
                      >
                        Install App
                      </Button>
                    )}
                  </div>
                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingLabel}>Service Worker & Offline Cache</span>
                      <span className={styles.settingDesc}>
                        Workbox caches critical app shells, fonts, and assets for rapid responsiveness
                      </span>
                    </div>
                    <Badge tone="accent">Workbox Active</Badge>
                  </div>
                </Card.Body>
              </Card>

              <Card padding="md" className={styles.sectionCard}>
                <Card.Header>
                  <div className={styles.cardHeaderContent}>
                    <div className={styles.headerIcon}>
                      <User size={18} />
                    </div>
                    <div className={styles.headerText}>
                      <h3 className={styles.cardTitle}>Workspace Identity Overview</h3>
                      <p className={styles.cardSubtitle}>
                        Your account credentials and current workspace permissions
                      </p>
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className={styles.cardBody}>
                  <div className={styles.accountDetailRow}>
                    <span className={styles.accountLabel}>Email:</span>
                    <span className={styles.accountValue}>{user?.email || 'N/A'}</span>
                  </div>
                  <div className={styles.accountDetailRow}>
                    <span className={styles.accountLabel}>Workspace Role:</span>
                    <span className={styles.accountValue}>
                      <Badge tone={user?.role === 'admin' ? 'accent' : 'neutral'}>
                        {user?.role === 'admin' ? 'Administrator' : 'Standard User'}
                      </Badge>
                    </span>
                  </div>
                  <div className={styles.accountDetailRow}>
                    <span className={styles.accountLabel}>Registered Since:</span>
                    <span className={styles.accountValue}>
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                </Card.Body>
              </Card>
            </div>
          )}

          {/* TAB 2: AI & INTELLIGENCE */}
          {activeTab === 'intelligence' && (
            <div className={styles.tabSectionStack}>
              <Card padding="md" className={styles.sectionCard}>
                <Card.Header>
                  <div className={styles.cardHeaderContent}>
                    <div className={styles.headerIcon}>
                      <Sparkles size={18} />
                    </div>
                    <div className={styles.headerText}>
                      <h3 className={styles.cardTitle}>Foundation Models &amp; Thinking</h3>
                      <p className={styles.cardSubtitle}>
                        Configure default Google Gemini engine, thinking depth, and grounding
                      </p>
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className={styles.cardBody}>
                  <div className={styles.selectWrapper}>
                    <Select
                      label="Default Foundation Model"
                      value={currentModel}
                      onChange={handleModelChange}
                      options={[
                        {
                          value: 'flash',
                          label: 'Gemini 3.5 Flash Lite (Fast & Quota-Efficient • 1,500 RPD)',
                        },
                        {
                          value: 'pro',
                          label: 'Gemini 3.1 Pro (Deep Reasoning & Multimodal Depth)',
                        },
                      ]}
                      hint="Powered directly by Google Gemini API with token-level usage tracking."
                    />
                  </div>

                  <div className={styles.selectWrapper}>
                    <Select
                      label="Default Reasoning / Thinking Level"
                      value={thinkingLevel}
                      onChange={handleThinkingChange}
                      options={[
                        { value: 'off', label: 'Off (Instant response, lowest latency)' },
                        { value: 'low', label: 'Low (Quick structural outline & sanity checks)' },
                        { value: 'medium', label: 'Medium (Balanced chain-of-thought analysis)' },
                        { value: 'high', label: 'High (Deep mathematical & architectural reasoning)' },
                      ]}
                      hint="Extended thinking reveals step-by-step reasoning in the Thought Drawer."
                    />
                  </div>

                  <div className={styles.selectWrapper}>
                    <Select
                      label="Autonomous Tool & Skill Execution Policy"
                      value={toolExecutionMode}
                      onChange={handleToolExecutionModeChange}
                      options={[
                        {
                          value: 'auto',
                          label: 'Autonomous (Auto-detect & execute tools/search seamlessly)',
                        },
                        {
                          value: 'confirm',
                          label: 'Ask for Permission (Prompt in chat before calling external tools)',
                        },
                        {
                          value: 'manual',
                          label: 'Manual Only (Only run tools when explicitly attached or chosen via /)',
                        },
                      ]}
                      hint="Controls whether NexAI autonomously queries the web, reads links, and queries project docs."
                    />
                  </div>

                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingLabel}>
                        <Globe size={15} style={{ color: 'var(--color-accent)' }} />
                        Default Web Search Grounding
                      </span>
                      <span className={styles.settingDesc}>
                        Automatically ground answers with live Google Search results when answering current events and technical documentation queries
                      </span>
                    </div>
                    <Switch
                      checked={webSearchDefaultOn}
                      onChange={handleWebSearchToggle}
                      aria-label="Toggle web search default"
                    />
                  </div>

                  <div className={styles.settingRow}>
                    <div className={styles.settingInfo}>
                      <span className={styles.settingLabel}>
                        <Cpu size={15} style={{ color: 'var(--color-accent)' }} />
                        Simulation Mode (Offline / Sandbox)
                      </span>
                      <span className={styles.settingDesc}>
                        Generate synthetic responses locally for testing and UI review without calling Google Gemini API or consuming daily quota
                      </span>
                    </div>
                    <Switch
                      checked={isSimulation}
                      onChange={toggleSimulation}
                      aria-label="Toggle simulation mode"
                    />
                  </div>
                </Card.Body>
              </Card>
            </div>
          )}

          {/* TAB 3: PERSONALIZATION & MEMORY (THE MEMORY HUB) */}
          {activeTab === 'memory' && (
            <div className={styles.tabSectionStack}>
              <MemoryManager />
            </div>
          )}

          {/* TAB 4: ACCOUNT & API QUOTA */}
          {activeTab === 'quota' && (
            <div className={styles.tabSectionStack}>
              <Card padding="md" className={styles.sectionCard}>
                <Card.Header>
                  <div className={styles.cardHeaderContent}>
                    <div className={styles.headerIcon}>
                      <ShieldCheck size={18} />
                    </div>
                    <div className={styles.headerText}>
                      <h3 className={styles.cardTitle}>Account &amp; API Quota Telemetry</h3>
                      <p className={styles.cardSubtitle}>
                        Live Google Gemini free-tier allowance, rate limits, and token metrics
                      </p>
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className={styles.cardBody}>
                  <div className={styles.accountDetailRow}>
                    <span className={styles.accountLabel}>Email:</span>
                    <span className={styles.accountValue}>{user?.email || 'N/A'}</span>
                  </div>
                  <div className={styles.accountDetailRow}>
                    <span className={styles.accountLabel}>Workspace Role:</span>
                    <span className={styles.accountValue}>
                      <Badge tone={user?.role === 'admin' ? 'accent' : 'neutral'}>
                        {user?.role === 'admin' ? 'Administrator' : 'Standard User'}
                      </Badge>
                    </span>
                  </div>
                  <div className={styles.accountDetailRow}>
                    <span className={styles.accountLabel}>Active Plan:</span>
                    <span className={styles.accountValue}>
                      Academic Free Tier (Google Gemini 1,500 RPD)
                    </span>
                  </div>

                  {/* Quota Telemetry Mini Grid */}
                  <div className={styles.quotaTelemetryGrid}>
                    <div className={styles.quotaMetricBox}>
                      <span className={styles.metricLabel}>Daily Quota Limit</span>
                      <span className={styles.metricValue}>
                        {dailyLimit.toLocaleString()} <span style={{ fontSize: 13, fontWeight: 500 }}>RPD</span>
                      </span>
                      <span className={styles.metricSub}>Google AI Studio Free Tier</span>
                    </div>
                    <div className={styles.quotaMetricBox}>
                      <span className={styles.metricLabel}>Calls Left Today</span>
                      <span className={styles.metricValue + ' ' + styles.accent}>
                        {requestsRemaining.toLocaleString()}
                      </span>
                      <span className={styles.metricSub}>Resets at 00:00 UTC</span>
                    </div>
                    <div className={styles.quotaMetricBox}>
                      <span className={styles.metricLabel}>Total Tokens Consumed</span>
                      <span className={styles.metricValue}>
                        {totalTokens.toLocaleString()}
                      </span>
                      <span className={styles.metricSub}>Cumulative Gemini token usage</span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className={styles.viewWalletBtn}
                    rightIcon={<ArrowRight size={14} />}
                    onClick={() => navigate(ROUTES.WALLET)}
                  >
                    View Detailed Wallet &amp; Ledger
                  </Button>
                </Card.Body>
              </Card>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

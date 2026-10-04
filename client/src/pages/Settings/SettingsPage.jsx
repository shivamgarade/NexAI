import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Palette,
  Sparkles,
  Globe,
  User,
  ArrowRight,
  Cpu,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/components/ui/Toast';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useWalletStore } from '@/store/walletStore';
import { MemoryManager } from '@/features/memory';
import { ROUTES } from '@/constants/routes';
import styles from './SettingsPage.module.scss';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { user, updateSettings } = useAuthStore();
  const { thinkingLevel, setThinkingLevel, isSimulation, toggleSimulation } = useChatStore();
  const { governance, wallet, fetchWallet } = useWalletStore();

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const currentModel = user?.settings?.defaultModel || 'flash';
  const webSearchDefaultOn = user?.settings?.webSearchDefaultOn || false;

  const dailyLimit = governance?.dailyGeminiQuotaLimit || 1500;
  const requestsRemaining = governance?.dailyRequestsRemaining ?? dailyLimit;
  const totalTokens = wallet?.totalTokensConsumed ?? user?.wallet?.totalTokensConsumed ?? 0;

  const handleThemeChange = async () => {
    toggleTheme();
    const nextTheme = isDark ? 'light' : 'dark';
    if (user) {
      await updateSettings({ theme: nextTheme });
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

      <div className={styles.sectionsStack}>
        {/* Appearance Configuration */}
        <Card padding="md" className={styles.sectionCard}>
          <Card.Header>
            <div className={styles.cardHeaderContent}>
              <div className={styles.headerIcon}>
                <Palette size={18} />
              </div>
              <div className={styles.headerText}>
                <h3 className={styles.cardTitle}>Appearance</h3>
                <p className={styles.cardSubtitle}>Visual presentation and theme mode</p>
              </div>
            </div>
          </Card.Header>
          <Card.Body className={styles.cardBody}>
            <div className={styles.settingRow}>
              <div className={styles.settingInfo}>
                <span className={styles.settingLabel}>Dark Theme</span>
                <span className={styles.settingDesc}>
                  Switch between dark and light appearance modes across all workspace views
                </span>
              </div>
              <Switch
                checked={isDark}
                onChange={handleThemeChange}
                aria-label="Toggle dark theme"
              />
            </div>
          </Card.Body>
        </Card>

        {/* AI Engine & Intelligence Preferences */}
        <Card padding="md" className={styles.sectionCard}>
          <Card.Header>
            <div className={styles.cardHeaderContent}>
              <div className={styles.headerIcon}>
                <Sparkles size={18} />
              </div>
              <div className={styles.headerText}>
                <h3 className={styles.cardTitle}>AI Preferences & Intelligence</h3>
                <p className={styles.cardSubtitle}>
                  Google Gemini model selection, reasoning depth, and grounding
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

        {/* Long-Term Memory & Cross-Chat Personalization Manager */}
        <MemoryManager />

        {/* Account Details & Live Quota Telemetry */}
        <Card padding="md" className={styles.sectionCard}>
          <Card.Header>
            <div className={styles.cardHeaderContent}>
              <div className={styles.headerIcon}>
                <User size={18} />
              </div>
              <div className={styles.headerText}>
                <h3 className={styles.cardTitle}>Account & API Quota Telemetry</h3>
                <p className={styles.cardSubtitle}>
                  User identity, active Google Gemini free-tier allowance, and cumulative token metrics
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
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  Globe,
  Terminal,
  Folder,
  BookOpen,
  PenTool,
  Settings2,
  Layers,
  KeyRound,
  X,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Skeleton } from '@/components/ui/Skeleton';
import { Modal } from '@/components/ui/Modal';
import { useConnectedAppStore } from '@/store/connectedAppStore';
import { cn } from '@/lib/utils/cn';
import styles from './ConnectedAppsTab.module.scss';

const ICON_MAP = {
  Globe: <Globe size={20} />,
  Terminal: <Terminal size={20} />,
  Folder: <Folder size={20} />,
  BookOpen: <BookOpen size={20} />,
  PenTool: <PenTool size={20} />,
};

export function ConnectedAppsTab() {
  const { apps, isLoading, fetchConnectedApps, updateApp, toggleConnection, isSaving } =
    useConnectedAppStore();

  const [configuringApp, setConfiguringApp] = useState(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [webhookInput, setWebhookInput] = useState('');
  const [accountInput, setAccountInput] = useState('');

  useEffect(() => {
    fetchConnectedApps();
  }, [fetchConnectedApps]);

  const handleOpenConfig = (app) => {
    setConfiguringApp(app);
    setApiKeyInput('');
    setWebhookInput(app.credentials?.webhookUrl || '');
    setAccountInput(app.credentials?.accountName || '');
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!configuringApp) return;

    try {
      await updateApp(configuringApp.appSlug, {
        apiKey: apiKeyInput ? apiKeyInput.trim() : undefined,
        webhookUrl: webhookInput.trim(),
        accountName: accountInput.trim(),
        isConnected: true,
      });
      setConfiguringApp(null);
    } catch {
      // Handled in store
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Connected Apps</h1>
          <p className={styles.subtitle}>
            Empower NexAI agents with external tools, workspace storage, repositories, and real-time grounding sources.
          </p>
        </div>
      </div>

      {isLoading && apps.length === 0 ? (
        <div className={styles.grid}>
          <Skeleton height={200} />
          <Skeleton height={200} />
          <Skeleton height={200} />
        </div>
      ) : (
        <div className={styles.grid}>
          {apps.map((app) => {
            const iconElement = ICON_MAP[app.icon] || <Layers size={20} />;
            return (
              <Card
                key={app.appSlug}
                className={cn(styles.card, app.isConnected && styles.cardConnected)}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.leftInfo}>
                    <div className={styles.appIconWrapper}>{iconElement}</div>
                    <div className={styles.nameGroup}>
                      <h3 className={styles.appName}>{app.name}</h3>
                      <span className={styles.appCategory}>{app.category}</span>
                    </div>
                  </div>

                  <div className={styles.statusCol}>
                    <span
                      className={cn(
                        styles.statusPill,
                        app.isConnected ? styles.statusPillConnected : styles.statusPillAvailable,
                      )}
                    >
                      {app.isConnected ? 'Connected' : 'Available'}
                    </span>
                    <Switch
                      checked={app.isConnected}
                      onChange={() => toggleConnection(app.appSlug, !app.isConnected)}
                      title={app.isConnected ? 'Connected (Click to disconnect)' : 'Disconnected (Click to connect)'}
                    />
                  </div>
                </div>

                <p className={styles.appDescription}>{app.description}</p>

                {app.scopes && app.scopes.length > 0 && (
                  <div className={styles.scopesRow}>
                    <span className={styles.scopesLabel}>Permissions</span>
                    <div className={styles.scopeTags}>
                      {app.scopes.map((scope) => (
                        <span key={scope} className={styles.scopeTag}>
                          {scope}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.cardFooter}>
                  {app.credentials?.accountName ? (
                    <span className={styles.accountNameText}>
                      Account: {app.credentials.accountName}
                    </span>
                  ) : <span />}

                  <button
                    type="button"
                    className={styles.configBtn}
                    onClick={() => handleOpenConfig(app)}
                  >
                    <Settings2 size={13} />
                    <span>Configure</span>
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* App Configuration Modal */}
      {configuringApp && (
        <Modal open={Boolean(configuringApp)} onClose={() => setConfiguringApp(null)} size="md">
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <div className={styles.headerInfo}>
                <div className={styles.iconWrapper}>
                  {ICON_MAP[configuringApp.icon] || <KeyRound size={20} />}
                </div>
                <div>
                  <h3 className={styles.modalTitle}>Configure {configuringApp.name}</h3>
                  <p className={styles.modalSubtitle}>
                    Manage authentication credentials and connection scopes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfiguringApp(null)}
                className={styles.closeBtn}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className={styles.form}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>Account Identifier / Workspace Name</label>
                <input
                  type="text"
                  className={styles.modalInput}
                  placeholder="e.g. personal-workspace or github-username"
                  value={accountInput}
                  onChange={(e) => setAccountInput(e.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>API Token / Secret Key</label>
                <input
                  type="password"
                  className={styles.modalInput}
                  placeholder="Enter API token or leave blank if unchanged..."
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                />
                <span className={styles.hintText}>
                  Credentials are encrypted and safely used for autonomous agent tool executions.
                </span>
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label}>Webhook / Notification URL (Optional)</label>
                <input
                  type="url"
                  className={styles.modalInput}
                  placeholder="https://..."
                  value={webhookInput}
                  onChange={(e) => setWebhookInput(e.target.value)}
                />
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setConfiguringApp(null)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={isSaving}>
                  {isSaving ? 'Connecting...' : 'Save & Connect'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}

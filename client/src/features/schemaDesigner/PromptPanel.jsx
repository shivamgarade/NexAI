import { useRef } from 'react';
import { Sparkles, Database, RefreshCw, Cpu } from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import { Button } from '@/components/ui';
import styles from './PromptPanel.module.scss';

const DOMAIN_TEMPLATES = [
  {
    label: '🛒 E-Commerce & Inventory',
    prompt:
      'Design a production-grade relational database for an e-commerce platform with Users, Products, Categories, Inventory Reservations, Shopping Carts, Orders with state-machine statuses, OrderItems, and Stripe Payment Transactions.',
  },
  {
    label: '🏢 Multi-Tenant B2B SaaS',
    prompt:
      'Design a multi-tenant B2B SaaS database with Organizations, Workspaces, User Roles & Permissions (RBAC), API Keys, Subscription Plans, Invoices, and Audit Trail logs with org-level isolation.',
  },
  {
    label: '💬 Social Network & Feed',
    prompt:
      'Design a social network schema with Users, Profiles, Follower/Following graph, Posts with rich attachments, Comments with threaded replies, Likes/Reactions, and Direct Messaging channels.',
  },
  {
    label: '💳 Fintech Ledger & Accounts',
    prompt:
      'Design a fintech double-entry ledger database with Accounts, Balances, Journal Entries, Transaction Postings (debit & credit balancing), Currencies, and immutable reconciliation logs.',
  },
  {
    label: '🏥 Healthcare EHR & Appointments',
    prompt:
      'Design an electronic health records (EHR) schema with Patients, Doctors, Clinics, Medical Encounters, Appointment Bookings, Prescriptions, and Diagnostic Lab Reports.',
  },
];

export function PromptPanel() {
  const {
    prompt,
    setPrompt,
    generateSchema,
    isLoading,
    selectedModel,
    setSelectedModel,
    isSimulation,
    setIsSimulation,
  } = useSchemaStore();

  const textareaRef = useRef(null);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading && prompt.trim()) {
        generateSchema();
      }
    }
  };

  const handleApplyTemplate = (templatePrompt) => {
    setPrompt(templatePrompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <Database size={18} className="text-accent" />
          <h3>System Architecture & Domain Description</h3>
        </div>

        <div className={styles.modelBadge}>
          <Cpu size={14} />
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className={styles.modelSelect}
            aria-label="Select Gemini model"
          >
            <option value="flash">Gemini Flash (Fast & Light)</option>
            <option value="pro">Gemini Pro (Deep Reasoning)</option>
          </select>

          <button
            type="button"
            className={`${styles.simToggle} ${isSimulation ? styles.active : ''}`}
            onClick={() => setIsSimulation(!isSimulation)}
            title="Toggle offline simulated mode (no Gemini API tokens consumed)"
          >
            Sim {isSimulation ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      <div className={styles.textareaWrapper}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Describe your data entities, domain relationships, or constraints in natural language (e.g., 'A hotel booking platform with rooms, guests, bookings, payment receipts, and review ratings with foreign key constraints...')"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          rows={4}
        />
      </div>

      <div className={styles.templatesSection}>
        <span className={styles.templateLabel}>Starter Domain Templates:</span>
        <div className={styles.chips}>
          {DOMAIN_TEMPLATES.map((tmpl) => (
            <button
              key={tmpl.label}
              type="button"
              className={styles.chip}
              onClick={() => handleApplyTemplate(tmpl.prompt)}
              disabled={isLoading}
            >
              {tmpl.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.hint}>
          Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to generate
        </div>

        <div className={styles.actions}>
          <Button
            variant="primary"
            onClick={() => generateSchema()}
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                Synthesizing Data Model...
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Generate Schema & ERD
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

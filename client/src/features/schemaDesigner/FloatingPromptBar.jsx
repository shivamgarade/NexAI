import { useState, useRef, useEffect } from 'react';
import { Sparkles, RefreshCw, Layers, Cpu, ChevronUp, ChevronDown, X } from 'lucide-react';
import { useSchemaStore } from '@/store/schemaStore';
import styles from './FloatingPromptBar.module.scss';

const STARTER_TEMPLATES = [
  {
    label: '🛒 E-Commerce & Inventory',
    prompt:
      'Design an e-commerce platform with Users, Products, Categories, Orders, Order Items, and Inventory Stock Movements.',
  },
  {
    label: '🏢 Multi-Tenant B2B SaaS',
    prompt:
      'Design a multi-tenant B2B SaaS database with Organizations, Workspaces, User Roles & Permissions (RBAC), API Keys, and Subscriptions.',
  },
  {
    label: '💬 Social Network & Feed',
    prompt:
      'Design a social network schema with Users, Profiles, Follower graph, Posts, Comments with replies, Likes, and Direct Messages.',
  },
  {
    label: '💳 Fintech Ledger & Accounts',
    prompt:
      'Design a double-entry fintech ledger with Accounts, Balances, Journal Entries, Transaction Postings, and Currencies.',
  },
  {
    label: '🏥 Healthcare EHR & Appointments',
    prompt:
      'Design an electronic health records (EHR) schema with Patients, Doctors, Clinics, Encounters, Appointments, and Prescriptions.',
  },
];

export function FloatingPromptBar() {
  const {
    prompt,
    setPrompt,
    generateSchema,
    isLoading,
    selectedModel,
    setSelectedModel,
    isSimulation,
    setIsSimulation,
    currentSchema,
  } = useSchemaStore();

  const [showTemplates, setShowTemplates] = useState(false);
  const textareaRef = useRef(null);

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 130)}px`;
    }
  }, [prompt]);

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading && prompt.trim()) {
        generateSchema(prompt);
      }
    }
  };

  const handleSelectTemplate = (templatePrompt) => {
    setPrompt(templatePrompt);
    setShowTemplates(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={styles.floatingBarContainer}>
      {/* Popover Templates Drawer */}
      {showTemplates && (
        <div className={styles.templatesPopover} role="region" aria-label="Starter templates">
          <div className={styles.popoverHeader}>
            <div className="flex items-center gap-1">
              <Layers size={13} className="text-accent" />
              <span>Domain Architecture Starters</span>
            </div>
            <button
              type="button"
              className="text-text-muted hover:text-text-primary p-1"
              onClick={() => setShowTemplates(false)}
            >
              <X size={14} />
            </button>
          </div>
          <div className={styles.chipsList}>
            {STARTER_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.label}
                type="button"
                className={styles.chip}
                onClick={() => handleSelectTemplate(tmpl.prompt)}
              >
                {tmpl.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Floating Bar */}
      <div className={styles.mainBar}>
        <div className={styles.inputRow}>
          <div className={styles.aiIconBadge} title="NexAI Database Architect">
            <Sparkles size={16} />
          </div>

          <textarea
            ref={textareaRef}
            className={styles.textarea}
            placeholder={
              currentSchema
                ? 'Describe modifications to refine this schema (e.g. "Add a discounts table and coupon codes applied to orders")...'
                : 'Describe your data model requirements or architecture entities in plain English...'
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
          />

          <button
            type="button"
            className={styles.sendBtn}
            onClick={() => generateSchema(prompt)}
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>{currentSchema ? 'Refine Model' : 'Generate'}</span>
              </>
            )}
          </button>
        </div>

        <div className={styles.bottomRow}>
          <div className={styles.leftControls}>
            <button
              type="button"
              className={`${styles.templateToggleBtn} ${showTemplates ? styles.active : ''}`}
              onClick={() => setShowTemplates(!showTemplates)}
            >
              <Layers size={11} />
              <span>Templates</span>
              {showTemplates ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
            </button>

            <div className="flex items-center gap-1">
              <Cpu size={11} />
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={styles.modelSelect}
                aria-label="Select AI model"
              >
                <option value="flash">Gemini Flash</option>
                <option value="pro">Gemini Pro</option>
              </select>
            </div>

            <button
              type="button"
              className={`${styles.simToggle} ${isSimulation ? styles.active : ''}`}
              onClick={() => setIsSimulation(!isSimulation)}
              title="Toggle simulated testing (zero token cost)"
            >
              Sim {isSimulation ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className={styles.shortcutHint}>
            <span>Generate:</span>
            <kbd>Ctrl</kbd> + <kbd>Enter</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

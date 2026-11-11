import { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  ArrowUp,
  Square,
  ShoppingCart,
  Building2,
  FileText,
  Home,
  Database,
  Cpu,
} from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { useSchemaStore } from '@/store/schemaStore';
import styles from './SchemaHero.module.scss';

const STARTER_TEMPLATES = [
  {
    icon: <ShoppingCart size={15} />,
    title: 'E-Commerce Platform',
    prompt:
      'Design a production-ready normalized e-commerce database with User, Product, Category, Order, OrderItem, and Payment entities with foreign key constraints.',
  },
  {
    icon: <Building2 size={15} />,
    title: 'SaaS Multi-Tenant',
    prompt:
      'Design a multi-tenant B2B SaaS architecture with Organization, User, Team, Role, Subscription, and AuditLog entities with compound indexes.',
  },
  {
    icon: <FileText size={15} />,
    title: 'Content & Publishing',
    prompt:
      'Design a modern publishing platform with Author, Article, Category, Tag, ArticleTag junction, and Comment entities.',
  },
  {
    icon: <Home size={15} />,
    title: 'Rental Marketplace',
    prompt:
      'Design a vacation rental marketplace with Host, Guest, PropertyListing, Booking, Review, and Payout entities.',
  },
];

export function SchemaHero() {
  const {
    prompt,
    setPrompt,
    generateSchema,
    isLoading,
    selectedModel,
    setSelectedModel,
    addEntity,
  } = useSchemaStore();

  const [input, setInput] = useState(prompt || '');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (prompt) {
      setInput(prompt);
    }
  }, [prompt]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    setPrompt(input.trim());
    generateSchema(input.trim());
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePickTemplate = (tpl) => {
    setInput(tpl.prompt);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={styles.heroContainer}>
      <div className={styles.heroInner}>
        {/* Header Section */}
        <div className={styles.headerArea}>
          <div className={styles.badgePill}>
            <Sparkles size={13} className={styles.badgeIcon} />
            <span>AI Architecture Studio</span>
          </div>

          <h1 className={styles.heroTitle}>What are we modeling?</h1>
          <p className={styles.heroSubtitle}>
            Describe your application domain to generate a production-ready database schema with
            normalized entity relationships, multi-dialect code, and visual architecture.
          </p>
        </div>

        {/* Chat-style Input Composer */}
        <form className={styles.composerBox} onSubmit={handleSubmit}>
          <div className={styles.textareaWrapper}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Design a ride-sharing app with Drivers, Riders, Rides, LiveLocations, and Payments…"
              rows={2}
              className={styles.textarea}
              disabled={isLoading}
            />
          </div>

          <div className={styles.actionRow}>
            <div className={styles.leftActions}>
              {/* Model Selector Pill */}
              <button
                type="button"
                className={styles.modelPill}
                onClick={() => setSelectedModel(selectedModel === 'flash' ? 'pro' : 'flash')}
                title="Toggle between Gemini Flash and Gemini Pro"
              >
                <Cpu size={12} className={styles.modelIcon} />
                <span>{selectedModel === 'pro' ? 'Gemini Pro' : 'Gemini Flash'}</span>
              </button>
            </div>

            <div className={styles.rightActions}>
              <IconButton
                type="submit"
                variant="primary"
                size="sm"
                aria-label="Generate schema"
                disabled={!input.trim() || isLoading}
                className={styles.sendButton}
                icon={isLoading ? <Square size={14} className={styles.spin} /> : <ArrowUp size={16} />}
              />
            </div>
          </div>
        </form>

        {/* Starter Template Chips */}
        <div className={styles.templatesSection}>
          <span className={styles.templatesLabel}>Quick starter templates:</span>
          <div className={styles.chipsGrid}>
            {STARTER_TEMPLATES.map((tpl) => (
              <button
                key={tpl.title}
                type="button"
                className={styles.chipButton}
                onClick={() => handlePickTemplate(tpl)}
              >
                <span className={styles.chipIcon}>{tpl.icon}</span>
                <span className={styles.chipTitle}>{tpl.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Alternative Link */}
        <div className={styles.blankCanvasRow}>
          <button
            type="button"
            className={styles.blankLink}
            onClick={() => addEntity('User')}
          >
            <Database size={13} />
            <span>or start with a blank visual canvas</span>
          </button>
        </div>
      </div>
    </div>
  );
}

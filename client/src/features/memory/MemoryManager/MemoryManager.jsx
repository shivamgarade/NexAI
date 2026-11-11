import React, { useState, useEffect } from 'react';
import {
  Brain,
  Plus,
  Trash2,
  Pin,
  Sparkles,
  X,
  Search,
  Sliders,
  Edit2,
  Check,
  RefreshCw,
  Copy,
  MessageSquare,
} from 'lucide-react';
import { useMemoryStore } from '@/store/memoryStore';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { Card } from '@/components/ui/Card';
import { toast } from '@/components/ui/Toast';
import styles from './MemoryManager.module.scss';

const CATEGORY_OPTIONS = [
  { value: 'identity', label: 'Identity (Name, Role, Location)' },
  { value: 'preference', label: 'Preference (Stack, Styling, Tone)' },
  { value: 'project', label: 'Project (Active apps, Repos)' },
  { value: 'instruction', label: 'Instruction (System directives)' },
  { value: 'fact', label: 'General Fact' },
];

const TONE_OPTIONS = [
  { value: 'default', label: 'Default / Balanced (Standard helpful pair programmer)' },
  { value: 'concise', label: 'Concise & Direct (Minimal prose, immediate code)' },
  { value: 'detailed', label: 'Thorough & Analytical (In-depth explanations & architecture)' },
  { value: 'technical', label: 'Senior Staff Engineer (High technical rigor, edge cases)' },
  { value: 'casual', label: 'Casual & Collaborative (Friendly peer developer tone)' },
];

const FILTER_PILLS = [
  { value: 'all', label: 'All' },
  { value: 'identity', label: 'Identity' },
  { value: 'preference', label: 'Preference' },
  { value: 'project', label: 'Project' },
  { value: 'instruction', label: 'Instruction' },
  { value: 'fact', label: 'Fact' },
];

export function MemoryManager() {
  const { user, updateSettings } = useAuthStore();
  const {
    memories,
    isLoading,
    isSaving,
    isConsolidating,
    fetchMemories,
    addMemory,
    updateMemory,
    deleteMemory,
    clearAll,
    togglePin,
    consolidateMemories,
  } = useMemoryStore();

  // Personalization settings local state
  const [customInstructions, setCustomInstructions] = useState('');
  const [responseTone, setResponseTone] = useState('default');
  const [aiMemoryEnabled, setAiMemoryEnabled] = useState(true);
  const [isSavingPersonalization, setIsSavingPersonalization] = useState(false);

  // Sync user settings into local state
  useEffect(() => {
    if (user?.settings?.personalization) {
      setCustomInstructions(user.settings.personalization.customInstructions || '');
      setResponseTone(user.settings.personalization.responseTone || 'default');
      setAiMemoryEnabled(user.settings.personalization.aiMemoryEnabled !== false);
    }
  }, [user]);

  // Memory bank local state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState('fact');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Inline edit state
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [copiedMemoryId, setCopiedMemoryId] = useState(null);

  const handleCopyFact = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMemoryId(id);
      setTimeout(() => setCopiedMemoryId(null), 2000);
      toast.success('Fact copied to clipboard');
    } catch {
      toast.error('Failed to copy fact');
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Handle saving user personalization directives
  const handleSavePersonalization = async () => {
    setIsSavingPersonalization(true);
    const res = await updateSettings({
      personalization: {
        customInstructions: customInstructions.trim(),
        responseTone,
        aiMemoryEnabled,
      },
    });
    setIsSavingPersonalization(false);

    if (res.success) {
      toast.success('Personalization preferences updated');
    } else {
      toast.error('Failed to update personalization');
    }
  };

  // Immediate toggle for autonomous AI memory learning
  const handleToggleLearning = async () => {
    const nextVal = !aiMemoryEnabled;
    setAiMemoryEnabled(nextVal);
    await updateSettings({
      personalization: {
        customInstructions: customInstructions.trim(),
        responseTone,
        aiMemoryEnabled: nextVal,
      },
    });
    toast.success(
      nextVal
        ? 'Autonomous AI memory learning activated'
        : 'Autonomous AI memory learning paused (incognito mode)',
    );
  };

  // Add memory submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!newFact.trim()) return;

    const res = await addMemory({
      fact: newFact.trim(),
      category: newCategory,
    });

    if (res) {
      setNewFact('');
      setShowAddForm(false);
    }
  };

  // Inline edit memory
  const handleStartEdit = (mem) => {
    setEditingId(mem._id);
    setEditingText(mem.fact);
  };

  const handleSaveInlineEdit = async (id) => {
    if (!editingText.trim()) return;
    await updateMemory(id, { fact: editingText.trim() });
    setEditingId(null);
    setEditingText('');
  };

  const handleCancelInlineEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  // Clear all
  const handleClearAll = () => {
    if (
      window.confirm(
        'Are you sure you want to clear all persistent memories? This cannot be undone.',
      )
    ) {
      clearAll();
    }
  };

  // Filter memories based on search query and category pill
  const filteredMemories = memories.filter((mem) => {
    const matchesCategory = selectedCategory === 'all' || mem.category === selectedCategory;
    const matchesSearch =
      !searchQuery.trim() || mem.fact.toLowerCase().includes(searchQuery.toLowerCase().trim());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className={styles.container}>
      {/* 1. PERSONALIZATION & DIRECTIVES CARD (USER CUSTOMIZATION) */}
      <Card padding="md">
        <Card.Header>
          <div className={styles.titleArea}>
            <div className={styles.title}>
              <Sliders size={18} style={{ color: 'var(--color-primary-base)' }} />
              <span>Personalization Directives</span>
            </div>
            <div className={styles.subtitle}>
              Customize your persistent persona, preferred AI tone, and global instructions across
              all conversations.
            </div>
          </div>
        </Card.Header>

        <Card.Body>
          <div className={styles.personalizationSection}>
            {/* Autonomous Learning Switch */}
            <div className={styles.switchRow}>
              <div>
                <div className={styles.switchLabel}>Autonomous AI Memory Learning</div>
                <div className={styles.switchDescription}>
                  Allow NexAI to continuously identify and remember your name, tools, and
                  preferences as you chat.
                </div>
              </div>
              <Switch
                checked={aiMemoryEnabled}
                onChange={handleToggleLearning}
                aria-label="Toggle autonomous memory learning"
              />
            </div>

            {/* Preferred Response Tone */}
            <Select
              label="Preferred Response Tone & Style"
              value={responseTone}
              onChange={(e) => setResponseTone(e.target.value)}
              options={TONE_OPTIONS}
              hint="Tailors the default communication style of NexAI across all chats."
            />

            {/* Global Custom Instructions */}
            <Textarea
              label="Global Custom Instructions"
              placeholder="e.g. Always respond in TypeScript. Avoid verbose intros and boilerplate. Focus on production best practices and edge cases."
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              rows={3}
              hint="Direct instructions applied to every session alongside retrieved memories."
            />

            <div className={styles.personalizationActions}>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSavePersonalization}
                disabled={isSavingPersonalization}
              >
                <Check size={14} style={{ marginRight: 4 }} />
                {isSavingPersonalization ? 'Saving...' : 'Save Personalization'}
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* 2. DYNAMIC AI MEMORY BANK CARD (AI-MANAGED KNOWLEDGE) */}
      <Card padding="md">
        <Card.Header>
          <div className={styles.header}>
            <div className={styles.titleArea}>
              <div className={styles.title}>
                <Brain size={18} style={{ color: 'var(--color-primary-base)' }} />
                <span>AI Memory Bank</span>
                <span className={styles.countBadge}>{memories.length} / 200</span>
              </div>
              <div className={styles.subtitle}>
                Dynamic knowledge discovered by NexAI or manually entered. Automatically retrieved
                based on context.
              </div>
            </div>

            <div className={styles.actions}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => consolidateMemories()}
                disabled={isConsolidating || memories.length < 2}
                title={
                  memories.length < 2
                    ? 'At least 2 memories are required to consolidate'
                    : 'De-duplicate and resolve contradictions with AI'
                }
              >
                {isConsolidating ? (
                  <RefreshCw size={14} className="animate-spin" style={{ marginRight: 4 }} />
                ) : (
                  <Sparkles size={14} style={{ marginRight: 4, color: 'var(--color-accent)' }} />
                )}
                {isConsolidating ? 'Consolidating...' : 'Consolidate with AI'}
              </Button>

              {!showAddForm && (
                <Button variant="secondary" size="sm" onClick={() => setShowAddForm(true)}>
                  <Plus size={14} style={{ marginRight: 4 }} />
                  Add Memory
                </Button>
              )}

              {memories.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  style={{ color: 'var(--color-error)' }}
                >
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </Card.Header>

        <Card.Body>
          {showAddForm && (
            <form onSubmit={handleAddSubmit} className={styles.addForm}>
              <div className={styles.formRow}>
                <div className={styles.factInput}>
                  <Input
                    label="Memory Fact"
                    placeholder="e.g. User's name is Rewan, or Prefers Tailwind CSS"
                    value={newFact}
                    onChange={(e) => setNewFact(e.target.value)}
                    autoFocus
                    required
                  />
                </div>
                <div className={styles.categorySelect}>
                  <Select
                    label="Category"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    options={CATEGORY_OPTIONS}
                  />
                </div>
              </div>

              <div className={styles.formButtons}>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                >
                  <X size={14} style={{ marginRight: 4 }} />
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={!newFact.trim() || isSaving}
                >
                  <Sparkles size={14} style={{ marginRight: 4 }} />
                  {isSaving ? 'Saving...' : 'Save Memory'}
                </Button>
              </div>
            </form>
          )}

          {/* Search & Category Filter Toolbar */}
          {memories.length > 0 && (
            <div className={styles.toolbar}>
              <div className={styles.searchRow}>
                <Input
                  placeholder="Search memories by keyword..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  icon={<Search size={14} />}
                />
              </div>

              <div className={styles.categoryPills}>
                {FILTER_PILLS.map((pill) => (
                  <button
                    key={pill.value}
                    type="button"
                    className={`${styles.pillBtn} ${selectedCategory === pill.value ? styles.activePill : ''}`}
                    onClick={() => setSelectedCategory(pill.value)}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isLoading ? (
            <div className={styles.emptyState}>Loading persistent memories...</div>
          ) : memories.length === 0 ? (
            <div className={styles.emptyState}>
              <div>No persistent memories recorded yet.</div>
              <div className={styles.emptyHint}>
                NexAI automatically learns facts about you as you chat. You can also click{' '}
                <strong>Add Memory</strong> to record facts manually.
              </div>
            </div>
          ) : filteredMemories.length === 0 ? (
            <div className={styles.emptyState}>
              <div>No memories match your search or filter.</div>
              <div className={styles.emptyHint}>
                Try selecting a different category or clearing the search query.
              </div>
            </div>
          ) : (
            <div className={styles.list}>
              {filteredMemories.map((mem) => (
                <div
                  key={mem._id}
                  className={`${styles.item} ${mem.pinned ? styles.pinned : ''}`}
                >
                  <div className={styles.itemContent}>
                    <span
                      className={`${styles.categoryPill} ${styles[mem.category] || styles.fact}`}
                    >
                      {mem.category || 'fact'}
                    </span>

                    {editingId === mem._id ? (
                      <div className={styles.inlineEditRow}>
                        <input
                          type="text"
                          className={styles.inlineEditInput}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveInlineEdit(mem._id);
                            if (e.key === 'Escape') handleCancelInlineEdit();
                          }}
                          autoFocus
                        />
                        <button
                          type="button"
                          className={`${styles.iconBtn} ${styles.confirmBtn}`}
                          title="Save change"
                          onClick={() => handleSaveInlineEdit(mem._id)}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          className={styles.iconBtn}
                          title="Cancel"
                          onClick={handleCancelInlineEdit}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className={styles.factWrapper}>
                        <span
                          className={styles.factText}
                          onClick={() => handleStartEdit(mem)}
                          title="Click to edit memory"
                        >
                          {mem.fact}
                        </span>
                        {mem.sourceMessage && (
                          <div className={styles.sourceChatSnippet}>
                            <MessageSquare size={11} className={styles.sourceChatIcon} />
                            <span>From: &ldquo;{mem.sourceMessage.slice(0, 70)}{mem.sourceMessage.length > 70 ? '...' : ''}&rdquo;</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {editingId !== mem._id && (
                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title={copiedMemoryId === mem._id ? 'Copied!' : 'Copy fact'}
                        onClick={() => handleCopyFact(mem.fact, mem._id)}
                      >
                        {copiedMemoryId === mem._id ? (
                          <Check size={13} style={{ color: 'var(--color-success)' }} />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        title="Edit memory"
                        onClick={() => handleStartEdit(mem)}
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${mem.pinned ? styles.pinnedActive : ''}`}
                        title={mem.pinned ? 'Unpin memory' : 'Pin to priority'}
                        onClick={() => togglePin(mem._id)}
                      >
                        <Pin size={14} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.deleteBtn}`}
                        title="Delete memory"
                        onClick={() => deleteMemory(mem._id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}

export default MemoryManager;

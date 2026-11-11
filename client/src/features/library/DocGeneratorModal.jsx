import { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Download,
  RotateCcw,
  Check,
  FileText,
  Sliders,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Badge } from '@/components/ui/Badge';
import { TagInput } from '@/components/ui/TagInput';
import { MarkdownRenderer } from '@/features/chat/MarkdownRenderer';
import { useLibraryStore } from '@/store/libraryStore';
import { useAuthStore } from '@/store/authStore';
import { useWalletStore } from '@/store/walletStore';
import { cn } from '@/lib/utils/cn';
import styles from './DocGeneratorModal.module.scss';

const CATEGORIES = [
  { id: 'resume', label: 'Resume / CV', desc: 'Summary, Experience, Skills & Projects' },
  { id: 'spec', label: 'Technical Spec', desc: 'Architecture, APIs, Schemas & Security' },
  { id: 'report', label: 'Analysis Report', desc: 'Executive Summary, Findings & Recommendations' },
  { id: 'notes', label: 'Study Notes', desc: 'Core Concepts, Key Takeaways & Cheat-Sheets' },
  { id: 'other', label: 'General Document', desc: 'Custom structured document with sections' },
];

const STARTER_PROMPTS = {
  resume: 'Senior Full-Stack Engineer resume highlighting React 18, Node.js microservices, and system architecture',
  spec: 'System Architecture Specification for a real-time collaborative document editor with WebSockets',
  report: 'Evaluation Report comparing vector databases: Pinecone, Milvus, and pgvector for AI SaaS applications',
  notes: 'Comprehensive revision guide for Database Indexing: B-Trees, Hash Indexes, and Query Optimization',
  other: 'Product requirements document (PRD) for a developer productivity command palette',
};

export function DocGeneratorModal() {
  const {
    isDocGenModalOpen,
    closeDocGenModal,
    isGeneratingDoc,
    docDraft,
    generateDocDraft,
    saveItem,
    isSaving,
    exportPdf,
  } = useLibraryStore();

  const user = useAuthStore((state) => state.user);
  const walletCredits = useWalletStore((state) => state.wallet?.creditsRemaining);
  const creditsRemaining = walletCredits ?? user?.wallet?.creditsRemaining ?? 100;

  // Step 1: Prompt & Category setup
  const [category, setCategory] = useState('spec');
  const [prompt, setPrompt] = useState('');

  // Step 2: Edit & Review state
  const [draftTitle, setDraftTitle] = useState('');
  const [draftCategory, setDraftCategory] = useState('spec');
  const [draftSummary, setDraftSummary] = useState('');
  const [draftSections, setDraftSections] = useState([]);
  const [tags, setTags] = useState([]);
  const [mobileTab, setMobileTab] = useState('editor'); // 'editor' | 'preview'

  // Sync draft to local editable state when generated
  useEffect(() => {
    if (docDraft) {
      setDraftTitle(docDraft.title || '');
      setDraftCategory(docDraft.category || category);
      setDraftSummary(docDraft.summary || '');
      setDraftSections(docDraft.sections ? JSON.parse(JSON.stringify(docDraft.sections)) : []);
      setTags([docDraft.category || category, 'ai-generated']);
    }
  }, [docDraft, category]);

  const handleSelectStarter = (starterText) => {
    setPrompt(starterText);
  };

  const handleGenerate = async (e) => {
    e?.preventDefault();
    if (!prompt.trim() || isGeneratingDoc) return;
    await generateDocDraft({ prompt: prompt.trim(), category });
  };

  const handleAddSection = () => {
    setDraftSections((prev) => [
      ...prev,
      {
        heading: `Section ${prev.length + 1}`,
        body: 'Enter section content here...',
      },
    ]);
  };

  const handleDeleteSection = (index) => {
    setDraftSections((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveSection = (index, direction) => {
    setDraftSections((prev) => {
      const copy = [...prev];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= copy.length) return copy;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleSectionChange = (index, field, value) => {
    setDraftSections((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveToLibrary = async () => {
    if (!draftTitle.trim()) return;
    await saveItem({
      type: 'document',
      title: draftTitle.trim(),
      category: draftCategory,
      summary: draftSummary.trim(),
      sections: draftSections,
      tags,
    });
  };

  const handleSaveAndExportPdf = async () => {
    if (!draftTitle.trim()) return;
    const saved = await saveItem({
      type: 'document',
      title: draftTitle.trim(),
      category: draftCategory,
      summary: draftSummary.trim(),
      sections: draftSections,
      tags,
    });
    if (saved) {
      await exportPdf(saved);
    }
  };

  const handleResetToPrompt = () => {
    useLibraryStore.setState({ docDraft: null });
  };

  if (!isDocGenModalOpen) return null;

  const isEditing = Boolean(docDraft);

  return (
    <Modal
      open={isDocGenModalOpen}
      onClose={closeDocGenModal}
      title={
        <div className={styles.modalTitle}>
          <BookOpen size={18} className={styles.titleIcon} />
          <span>{isEditing ? 'Review & Edit AI Document Draft' : 'AI Document Generator'}</span>
        </div>
      }
      className={cn(styles.modalContainer, isEditing && styles.wideContainer)}
    >
      {!isEditing ? (
        /* STEP 1: Prompt & Category Setup */
        <form onSubmit={handleGenerate} className={styles.setupForm}>
          <div className={styles.sectionHeader}>
            <span className={styles.label}>1. Select Document Category</span>
          </div>

          <div className={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={cn(styles.categoryCard, category === cat.id && styles.activeCategory)}
                onClick={() => {
                  setCategory(cat.id);
                  if (STARTER_PROMPTS[cat.id]) {
                    setPrompt(STARTER_PROMPTS[cat.id]);
                  }
                }}
              >
                <div className={styles.cardTop}>
                  <span className={styles.catLabel}>{cat.label}</span>
                  {category === cat.id && <Check size={14} className={styles.checkIcon} />}
                </div>
                <span className={styles.catDesc}>{cat.desc}</span>
              </button>
            ))}
          </div>

          <div className={styles.promptSection}>
            <div className={styles.promptHeader}>
              <span className={styles.label}>2. Describe what to include</span>
              <span className={styles.creditsNote}>
                Estimated cost: <strong>~2-4 credits</strong> ({creditsRemaining} available)
              </span>
            </div>

            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., Write a comprehensive specification for a modern payment checkout with Razorpay..."
              rows={4}
              required
              className={styles.promptTextarea}
            />

            <div className={styles.starterChips}>
              <span className={styles.startersLabel}>Suggested prompt:</span>
              <button
                type="button"
                className={styles.starterChip}
                onClick={() => handleSelectStarter(STARTER_PROMPTS[category] || '')}
              >
                Use &ldquo;{STARTER_PROMPTS[category]}&rdquo;
              </button>
            </div>
          </div>

          <div className={styles.footerActions}>
            <Button variant="ghost" type="button" onClick={closeDocGenModal}>
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={!prompt.trim() || isGeneratingDoc}
              loading={isGeneratingDoc}
              leftIcon={<Sparkles size={16} />}
            >
              {isGeneratingDoc ? 'Generating Draft...' : 'Generate Document Draft'}
            </Button>
          </div>
        </form>
      ) : (
        /* STEP 2: Split-pane Live Preview & Section Editor */
        <div className={styles.reviewLayout}>
          {/* Mobile switcher */}
          <div className={styles.mobileTabs}>
            <button
              type="button"
              className={cn(styles.mobileTabBtn, mobileTab === 'editor' && styles.active)}
              onClick={() => setMobileTab('editor')}
            >
              <Sliders size={14} />
              <span>Section Editor</span>
            </button>
            <button
              type="button"
              className={cn(styles.mobileTabBtn, mobileTab === 'preview' && styles.active)}
              onClick={() => setMobileTab('preview')}
            >
              <FileText size={14} />
              <span>Live Preview</span>
            </button>
          </div>

          <div className={styles.panesWrapper}>
            {/* Left Pane: Editor */}
            <div className={cn(styles.editorPane, mobileTab !== 'editor' && styles.hiddenOnMobile)}>
              <div className={styles.docMetaHeader}>
                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Document Title</label>
                  <Input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder="Document Title"
                    required
                  />
                </div>

                <div className={styles.metaRow}>
                  <div className={styles.inputGroup}>
                    <label className={styles.inputLabel}>Category</label>
                    <select
                      value={draftCategory}
                      onChange={(e) => setDraftCategory(e.target.value)}
                      className={styles.categorySelect}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.inputGroup} style={{ flex: 1 }}>
                    <label className={styles.inputLabel}>Tags</label>
                    <TagInput tags={tags} onChange={setTags} placeholder="Add tags..." />
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Executive Summary</label>
                  <Textarea
                    value={draftSummary}
                    onChange={(e) => setDraftSummary(e.target.value)}
                    placeholder="Short 1-2 sentence overview..."
                    rows={2}
                  />
                </div>
              </div>

              <div className={styles.sectionsList}>
                <div className={styles.sectionsHeader}>
                  <span className={styles.sectionsTitle}>
                    Sections ({draftSections.length})
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleAddSection}
                    leftIcon={<Plus size={14} />}
                  >
                    Add Section
                  </Button>
                </div>

                {draftSections.map((section, idx) => (
                  <div key={idx} className={styles.sectionItem}>
                    <div className={styles.sectionTop}>
                      <span className={styles.sectionIndex}>{idx + 1}</span>
                      <Input
                        value={section.heading}
                        onChange={(e) => handleSectionChange(idx, 'heading', e.target.value)}
                        placeholder="Section Heading"
                        className={styles.headingInput}
                      />
                      <div className={styles.sectionControls}>
                        <IconButton
                          icon={<ChevronUp size={14} />}
                          label="Move section up"
                          variant="ghost"
                          size="sm"
                          disabled={idx === 0}
                          onClick={() => handleMoveSection(idx, -1)}
                        />
                        <IconButton
                          icon={<ChevronDown size={14} />}
                          label="Move section down"
                          variant="ghost"
                          size="sm"
                          disabled={idx === draftSections.length - 1}
                          onClick={() => handleMoveSection(idx, 1)}
                        />
                        <IconButton
                          icon={<Trash2 size={14} />}
                          label="Delete section"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSection(idx)}
                          className={styles.deleteSecBtn}
                        />
                      </div>
                    </div>

                    <Textarea
                      value={section.body}
                      onChange={(e) => handleSectionChange(idx, 'body', e.target.value)}
                      placeholder="Section content in markdown..."
                      rows={5}
                      className={styles.bodyTextarea}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Right Pane: Live Document Preview */}
            <div
              className={cn(styles.previewPane, mobileTab !== 'preview' && styles.hiddenOnMobile)}
            >
              <div className={styles.previewHeader}>
                <span className={styles.previewLabel}>LIVE PREVIEW</span>
                <span className={styles.previewHint}>Simulating PDF export styling</span>
              </div>

              <div className={styles.documentSheet}>
                <div className={styles.sheetTop}>
                  <Badge variant="accent" size="sm">
                    {draftCategory.toUpperCase()}
                  </Badge>
                  <span className={styles.sheetDate}>
                    {new Date().toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>

                <h1 className={styles.sheetTitle}>{draftTitle || 'Untitled Document'}</h1>

                {draftSummary && (
                  <div className={styles.sheetSummary}>
                    <p>{draftSummary}</p>
                  </div>
                )}

                <div className={styles.sheetSections}>
                  {draftSections.map((sec, i) => (
                    <div key={i} className={styles.sheetSection}>
                      <h3 className={styles.sheetHeading}>{sec.heading || `Section ${i + 1}`}</h3>
                      <div className={styles.sheetBody}>
                        <MarkdownRenderer content={sec.body || '_No content entered yet._'} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.sheetFooter}>
                  <span>NexAI Knowledge Hub</span>
                  <span>Page 1 of 1</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className={styles.bottomBar}>
            <Button
              variant="ghost"
              onClick={handleResetToPrompt}
              leftIcon={<RotateCcw size={14} />}
            >
              Back to Prompt
            </Button>

            <div className={styles.primaryActions}>
              <Button
                variant="secondary"
                onClick={handleSaveAndExportPdf}
                disabled={isSaving}
                loading={isSaving}
                leftIcon={<Download size={15} />}
              >
                Save & Download PDF
              </Button>

              <Button
                variant="primary"
                onClick={handleSaveToLibrary}
                disabled={isSaving}
                loading={isSaving}
                leftIcon={<Check size={16} />}
              >
                Save to Library
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

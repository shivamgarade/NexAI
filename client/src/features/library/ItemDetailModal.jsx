import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Globe,
  BookOpen,
  Paperclip,
  Mic,
  Copy,
  Check,
  ExternalLink,
  Download,
  Trash2,
  Edit3,
  Eye,
  Sparkles,
  Calendar,
  Plus,
  X,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Target,
  ChevronDown,
  ChevronUp,
  User,
  Bot,
  Pin,
  MessageSquare,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { TagInput } from '@/components/ui/TagInput';
import { NoteEditor } from './NoteEditor';
import { MarkdownRenderer } from '@/features/chat/MarkdownRenderer';
import { useLibraryStore } from '@/store/libraryStore';
import { formatDate } from '@/lib/utils/formatDate';
import { formatFileSize } from '@/lib/utils/formatFileSize';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import styles from './ItemDetailModal.module.scss';

export function ItemDetailModal() {
  const navigate = useNavigate();
  const {
    isViewItemModalOpen,
    viewingItem,
    closeViewItemModal,
    updateItem,
    togglePinItem,
    isUpdating,
    openDeleteDialog,
    exportPdf,
    isExportingPdf,
    setActiveTag,
  } = useLibraryStore();

  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
  const [hasCopiedReport, setHasCopiedReport] = useState(false);

  // Form states for editing
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState([]);
  const [editSections, setEditSections] = useState([]);
  const [editError, setEditError] = useState('');

  // Sync state whenever viewingItem changes or edit mode opened
  useEffect(() => {
    if (viewingItem) {
      setEditTitle(viewingItem.title || '');
      setEditSummary(viewingItem.summary || '');
      setEditContent(viewingItem.content || '');
      setEditTags(viewingItem.tags || []);
      setEditSections(
        viewingItem.sections ? JSON.parse(JSON.stringify(viewingItem.sections)) : [],
      );
      setEditError('');
      setIsEditing(false);
      setCopied(false);
      setIsTranscriptOpen(false);
      setHasCopiedReport(false);
    }
  }, [viewingItem]);

  if (!isViewItemModalOpen || !viewingItem) return null;

  const isNote = viewingItem.type === 'note';
  const isLink = viewingItem.type === 'link';
  const isDoc = viewingItem.type === 'document';
  const isFile = viewingItem.type === 'file';
  const isInterview = viewingItem.type === 'interview';

  const getTypeMeta = () => {
    switch (viewingItem.type) {
      case 'note':
        return { label: 'Personal Note', icon: <FileText size={14} />, class: styles.note };
      case 'link':
        return { label: 'Web Link', icon: <Globe size={14} />, class: styles.link };
      case 'document':
        return {
          label: `Document (${viewingItem.category || 'General'})`,
          icon: <BookOpen size={14} />,
          class: styles.document,
        };
      case 'file':
        return { label: 'File Asset', icon: <Paperclip size={14} />, class: styles.file };
      case 'interview':
        return { label: 'Mock Interview', icon: <Mic size={14} />, class: styles.interview };
      default:
        return { label: 'Library Item', icon: <FileText size={14} />, class: styles.note };
    }
  };

  const typeMeta = getTypeMeta();

  const handleCopy = async () => {
    try {
      const textToCopy =
        viewingItem.content ||
        viewingItem.url ||
        (Array.isArray(viewingItem.sections)
          ? viewingItem.sections.map((s) => `## ${s.heading}\n\n${s.body}`).join('\n\n')
          : viewingItem.summary || viewingItem.title);

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const scorecard = viewingItem?.scorecard || {};
  const {
    overallScore = 0,
    rating = 'Completed',
    categories = {},
    strengths = [],
    improvements = [],
    summary: scoreSummary = viewingItem?.summary || '',
    recommendedTopics = [],
  } = scorecard;
  const transcript = viewingItem?.transcript || [];

  const handleCopyReport = async () => {
    if (!viewingItem) return;
    const reportText = `MOCK INTERVIEW EVALUATION: ${viewingItem.title}
Score: ${overallScore}/100 (${rating})
Role: ${viewingItem.role || 'Candidate'}
Difficulty: ${viewingItem.difficulty || 'N/A'}
Topic: ${viewingItem.topic || 'N/A'}

SUMMARY:
${scoreSummary}

CATEGORIES:
- Technical Accuracy: ${categories.technicalAccuracy || 0}%
- Problem Solving: ${categories.problemSolving || 0}%
- Communication: ${categories.communication || 0}%
- System Design: ${categories.systemDesign || 0}%

STRENGTHS:
${strengths.map((s) => `• ${s}`).join('\n')}

AREAS FOR IMPROVEMENT:
${improvements.map((i) => `• ${i}`).join('\n')}`;

    try {
      await navigator.clipboard.writeText(reportText);
      setHasCopiedReport(true);
      toast.success('Interview scorecard copied');
      setTimeout(() => setHasCopiedReport(false), 2500);
    } catch {
      toast.error('Failed to copy report');
    }
  };

  const getScoreColorClass = (score) => {
    if (score >= 85) return styles.scoreSuccess;
    if (score >= 70) return styles.scoreAccent;
    if (score >= 50) return styles.scoreWarning;
    return styles.scoreDanger;
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!editTitle.trim()) {
      setEditError('Title is required');
      return;
    }
    setEditError('');

    try {
      await updateItem(viewingItem._id, {
        title: editTitle.trim(),
        summary: editSummary.trim(),
        content: editContent,
        tags: editTags,
        sections: isDoc ? editSections : undefined,
      });
      setIsEditing(false);
    } catch {
      // Store already shows toast error
    }
  };

  const handleAddSection = () => {
    setEditSections((prev) => [
      ...prev,
      { heading: `Section ${prev.length + 1}`, body: '' },
    ]);
  };

  const handleRemoveSection = (idx) => {
    setEditSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSectionChange = (idx, field, val) => {
    setEditSections((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleDelete = () => {
    closeViewItemModal();
    openDeleteDialog(viewingItem);
  };

  const handleTogglePin = () => {
    if (viewingItem) togglePinItem(viewingItem);
  };

  const handleSendToChat = () => {
    if (!viewingItem) return;
    let prefill = '';
    if (isNote) {
      prefill = viewingItem.content || viewingItem.summary || viewingItem.title;
    } else if (isLink) {
      prefill = viewingItem.url
        ? `Review this link: ${viewingItem.url}\n\nSummary: ${viewingItem.summary || ''}`
        : viewingItem.summary || viewingItem.title;
    } else if (isDoc) {
      const sectionText = Array.isArray(viewingItem.sections)
        ? viewingItem.sections.map((s) => `## ${s.heading}\n\n${s.body}`).join('\n\n')
        : '';
      prefill = `# ${viewingItem.title}\n\n${sectionText || viewingItem.summary || ''}`;
    } else if (isInterview) {
      prefill = `MOCK INTERVIEW: ${viewingItem.title}\nOverall Score: ${overallScore}/100 (${rating})\nRole: ${viewingItem.role || 'Candidate'}\nDifficulty: ${viewingItem.difficulty || 'Standard'}\n\nSummary:\n${scoreSummary || viewingItem.summary || ''}`;
    } else {
      prefill = `File Asset: ${viewingItem.fileName || viewingItem.title}\n${viewingItem.summary || ''}`;
    }

    closeViewItemModal();
    navigate(ROUTES.CHAT, { state: { prefill } });
    toast.info('Item transferred to AI Chat');
  };

  const handleTagClick = (tag) => {
    closeViewItemModal();
    setActiveTag(tag);
  };

  return (
    <Modal
      open={isViewItemModalOpen}
      onClose={closeViewItemModal}
      className={styles.modalWrapper}
      title={
        <div className={styles.modalHeader}>
          <span className={cn(styles.typeBadge, typeMeta.class)}>
            {typeMeta.icon}
            <span>{typeMeta.label}</span>
          </span>
        </div>
      }
    >
      {/* Top Action Toolbar */}
      <div className={styles.actionToolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.modeToggle} role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={!isEditing}
              className={cn(styles.modeBtn, !isEditing && styles.active)}
              onClick={() => setIsEditing(false)}
            >
              <Eye size={13} />
              <span>Details</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isEditing}
              className={cn(styles.modeBtn, isEditing && styles.active)}
              onClick={() => setIsEditing(true)}
            >
              <Edit3 size={13} />
              <span>Edit</span>
            </button>
          </div>
        </div>

        <div className={styles.toolbarRight}>
          <button
            type="button"
            className={cn(styles.toolActionBtn, viewingItem.pinned && styles.pinnedActive)}
            onClick={handleTogglePin}
            title={viewingItem.pinned ? 'Unpin item' : 'Pin to top'}
          >
            <Pin size={13} className={viewingItem.pinned ? styles.pinnedIconFill : undefined} />
            <span>{viewingItem.pinned ? 'Pinned' : 'Pin'}</span>
          </button>

          <button
            type="button"
            className={styles.toolActionBtn}
            onClick={handleSendToChat}
            title="Use item in AI Chat"
          >
            <MessageSquare size={13} />
            <span>Use in Chat</span>
          </button>

          <button
            type="button"
            className={styles.toolActionBtn}
            onClick={handleCopy}
            title="Copy content"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          {isDoc && (
            <button
              type="button"
              className={styles.toolActionBtn}
              onClick={() => exportPdf(viewingItem)}
              disabled={isExportingPdf}
              title="Download PDF document"
            >
              <Download size={13} />
              <span>{isExportingPdf ? 'Exporting...' : 'PDF'}</span>
            </button>
          )}

          {isLink && viewingItem.url && (
            <a
              href={viewingItem.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.toolActionBtn}
              title="Open link in new tab"
            >
              <ExternalLink size={13} />
              <span>Visit Link</span>
            </a>
          )}

          {isFile && viewingItem.fileData && (
            <a
              href={viewingItem.fileData}
              download={viewingItem.fileName || viewingItem.title || 'download'}
              className={styles.toolActionBtn}
              title="Download file"
            >
              <Download size={13} />
              <span>Download</span>
            </a>
          )}

          <button
            type="button"
            className={cn(styles.toolActionBtn, styles.danger)}
            onClick={handleDelete}
            title="Delete this item"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {!isEditing ? (
        /* ======================== VIEW MODE ======================== */
        <div className={styles.viewContainer}>
          <div className={styles.headerSection}>
            <div className={styles.titleRow}>
              <h1 className={styles.itemTitle}>{viewingItem.title}</h1>
            </div>

            <div className={styles.metaRow}>
              <span className={styles.metaDate}>
                <Calendar size={13} />
                {formatDate(viewingItem.createdAt)}
              </span>

              {isDoc && viewingItem.category && (
                <Badge variant="accent" size="sm">
                  {viewingItem.category.toUpperCase()}
                </Badge>
              )}

              {isFile && viewingItem.size > 0 && (
                <Badge variant="secondary" size="sm">
                  {formatFileSize(viewingItem.size)}
                </Badge>
              )}

              {isInterview && viewingItem.scorecard?.overallScore !== undefined && (
                <Badge variant="success" size="sm">
                  Score: {viewingItem.scorecard.overallScore}/100
                </Badge>
              )}
            </div>

            {/* AI Summary Banner */}
            {viewingItem.summary && (
              <div className={styles.summaryBox}>
                <div className={styles.summaryHeader}>
                  <Sparkles size={13} />
                  <span>Key Summary</span>
                </div>
                <p>{viewingItem.summary}</p>
              </div>
            )}

            {/* Tags */}
            {Array.isArray(viewingItem.tags) && viewingItem.tags.length > 0 && (
              <div className={styles.tagsContainer}>
                {viewingItem.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={styles.tagChip}
                    onClick={() => handleTagClick(tag)}
                    title={`Filter by #${tag}`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type-Specific Content Displays */}
          {isNote && (
            <div className={styles.contentBlock}>
              <div className={styles.contentHeader}>
                <span>Note Content</span>
                <span>
                  {viewingItem.content ? `${viewingItem.content.length} chars` : 'Empty note'}
                </span>
              </div>
              {viewingItem.content ? (
                <MarkdownRenderer content={viewingItem.content} />
              ) : (
                <p className={styles.emptyContentNotice}>
                  This note does not have detailed body content yet. Click &ldquo;Edit&rdquo; above to
                  write with the interactive markdown editor.
                </p>
              )}
            </div>
          )}

          {isDoc && (
            <div className={styles.contentBlock}>
              {Array.isArray(viewingItem.sections) && viewingItem.sections.length > 0 ? (
                viewingItem.sections.map((sec, idx) => (
                  <div key={idx} className={styles.sectionBlock}>
                    <h2 className={styles.sectionHeading}>{sec.heading}</h2>
                    <MarkdownRenderer content={sec.body || ''} allowSaveSnippet={false} />
                  </div>
                ))
              ) : viewingItem.content ? (
                <MarkdownRenderer content={viewingItem.content} allowSaveSnippet={false} />
              ) : (
                <p className={styles.emptyContentNotice}>
                  No sections generated for this document.
                </p>
              )}
            </div>
          )}

          {isLink && (
            <div className={styles.linkPreviewBox}>
              <div className={styles.linkInfo}>
                <span className={styles.linkTitle}>
                  Web Link Destination
                </span>
                <span className={styles.linkUrl}>{viewingItem.url}</span>
              </div>
              <a
                href={viewingItem.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.toolActionBtn}
              >
                <ExternalLink size={13} />
                <span>Visit Page</span>
              </a>
            </div>
          )}

          {isFile && (
            <div className={styles.contentBlock}>
              <div className={styles.contentHeader}>
                <span>File Metadata</span>
                <span>{formatFileSize(viewingItem.size)}</span>
              </div>

              {viewingItem.fileData &&
                (viewingItem.mimeType?.startsWith('image/') ||
                  viewingItem.fileData.startsWith('data:image')) && (
                  <div className={styles.detailImageContainer}>
                    <img
                      src={viewingItem.fileData}
                      alt={viewingItem.fileName || viewingItem.title}
                    />
                  </div>
                )}

              <div className={styles.fileMetaList}>
                <div><strong>File Name:</strong> {viewingItem.fileName || 'Unnamed File'}</div>
                {viewingItem.mimeType && <div><strong>MIME Type:</strong> {viewingItem.mimeType}</div>}
              </div>

              {viewingItem.fileData && (
                <div className={styles.fileActionRow}>
                  <a
                    href={viewingItem.fileData}
                    download={viewingItem.fileName || viewingItem.title || 'download'}
                    className={styles.toolActionBtn}
                  >
                    <Download size={13} />
                    <span>Download Original File</span>
                  </a>
                </div>
              )}

              {viewingItem.content && (
                <div className={styles.fileContentRow}>
                  <MarkdownRenderer content={viewingItem.content} />
                </div>
              )}
            </div>
          )}

          {isInterview && viewingItem.scorecard && (
            <div className={styles.scorecardBox}>
              {/* Score Overview Dial & Actions */}
              <div className={styles.scoreOverview}>
                <div>
                  <h3 className={styles.scoreSectionHeading}>
                    <Mic size={16} />
                    Interview Performance Scorecard
                  </h3>
                  <div className={styles.interviewMetaSubtitle}>
                    {viewingItem.role ? `${viewingItem.role} • ` : ''}
                    {viewingItem.difficulty || 'Standard'} difficulty
                    {viewingItem.topic ? ` • ${viewingItem.topic}` : ''}
                  </div>
                </div>

                <div className={styles.interviewScoreActions}>
                  {overallScore !== undefined && (
                    <div className={styles.scoreDial}>
                      <div className={cn(styles.scoreCircle, getScoreColorClass(overallScore))}>
                        <span className={styles.scoreNum}>{overallScore}</span>
                        <span className={styles.scoreTotal}>/100</span>
                      </div>
                      <span className={styles.ratingText}>{rating}</span>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleCopyReport}
                    title="Copy evaluation report"
                  >
                    {hasCopiedReport ? <Check size={14} /> : <Copy size={14} />}
                    <span>{hasCopiedReport ? 'Copied' : 'Copy Report'}</span>
                  </Button>
                </div>
              </div>

              {/* Evaluated Competencies */}
              <div className={styles.competencySection}>
                <h4 className={styles.scoreSectionHeading}>
                  <Target size={15} />
                  Evaluated Competencies
                </h4>
                <div className={styles.catGrid}>
                  {[
                    { label: 'Technical Accuracy', score: categories.technicalAccuracy ?? 0 },
                    { label: 'Problem Solving', score: categories.problemSolving ?? 0 },
                    { label: 'Communication', score: categories.communication ?? 0 },
                    { label: 'System Design', score: categories.systemDesign ?? 0 },
                  ].map((cat, i) => (
                    <div key={i} className={styles.catItem}>
                      <div className={styles.catMeta}>
                        <span className={styles.catLabel}>{cat.label}</span>
                        <span className={styles.catScore}>{cat.score}%</span>
                      </div>
                      <div className={styles.catBarBg}>
                        <div
                          className={cn(styles.catBarFill, getScoreColorClass(cat.score))}
                          style={{ width: `${Math.min(100, Math.max(0, cat.score))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Summary / Feedback */}
              {(scoreSummary || viewingItem.scorecard.feedback) && (
                <div className={styles.assessmentSummary}>
                  <h4 className={styles.scoreSectionHeading}>
                    <Lightbulb size={15} />
                    Assessment Summary
                  </h4>
                  <p className={styles.assessmentBody}>
                    {scoreSummary || viewingItem.scorecard.feedback}
                  </p>

                  {Array.isArray(recommendedTopics) && recommendedTopics.length > 0 && (
                    <div className={styles.recommendedTopics}>
                      {recommendedTopics.map((topic, i) => (
                        <Badge key={i} variant="secondary" size="sm">
                          {topic}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Observed Strengths & Areas for Growth */}
              {(strengths.length > 0 || improvements.length > 0) && (
                <div className={styles.feedbackGrid}>
                  {strengths.length > 0 && (
                    <div className={styles.feedbackCard}>
                      <div className={styles.feedbackTitle}>
                        <CheckCircle2 size={16} className={styles.successIcon} />
                        <span>Observed Strengths</span>
                      </div>
                      <ul className={styles.bulletList}>
                        {strengths.map((item, idx) => (
                          <li key={idx} className={styles.bulletItem}>
                            <span className={styles.checkIcon}>✓</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {improvements.length > 0 && (
                    <div className={styles.feedbackCard}>
                      <div className={styles.feedbackTitle}>
                        <AlertTriangle size={16} className={styles.warningIcon} />
                        <span>Areas for Growth</span>
                      </div>
                      <ul className={styles.bulletList}>
                        {improvements.map((item, idx) => (
                          <li key={idx} className={styles.bulletItem}>
                            <span className={styles.warnIcon}>!</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Collapsible Transcript */}
              {Array.isArray(transcript) && transcript.length > 0 && (
                <div className={styles.transcriptSection}>
                  <button
                    type="button"
                    className={styles.transcriptToggle}
                    onClick={() => setIsTranscriptOpen(!isTranscriptOpen)}
                  >
                    <span>Archived Transcript ({transcript.length} turns)</span>
                    {isTranscriptOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {isTranscriptOpen && (
                    <div className={styles.transcriptList}>
                      {transcript.map((m, idx) => {
                        const isUser = m.role === 'user';
                        return (
                          <div
                            key={idx}
                            className={cn(
                              styles.transcriptMessage,
                              isUser ? styles.userTurn : styles.assistantTurn,
                            )}
                          >
                            <div className={styles.msgHeader}>
                              <span className={styles.msgRole}>
                                {isUser ? <User size={12} /> : <Bot size={12} />}
                                {isUser ? 'Candidate' : 'Interviewer'}
                              </span>
                            </div>
                            <p className={styles.msgContent}>{m.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ======================== EDIT MODE ======================== */
        <form onSubmit={handleSave} className={styles.editContainer}>
          {editError && (
            <div className={styles.formErrorBanner}>
              {editError}
            </div>
          )}

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>Title</label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Item title..."
              autoFocus
            />
          </div>

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>Summary</label>
            <Textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              placeholder="Concise summary or description..."
              rows={3}
            />
          </div>

          {/* Interactive Note Editor for notes */}
          {isNote && (
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Note Content (Interactive Markdown)</label>
              <NoteEditor
                value={editContent}
                onChange={setEditContent}
                placeholder="Write your note in rich markdown..."
                minHeight={260}
              />
            </div>
          )}

          {/* Document Section Editor */}
          {isDoc && (
            <div className={styles.formField}>
              <div className={styles.sectionHeaderRow}>
                <label className={styles.fieldLabel}>Document Sections</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddSection}
                  leftIcon={<Plus size={13} />}
                >
                  Add Section
                </Button>
              </div>

              <div className={styles.sectionsList}>
                {editSections.map((sec, idx) => (
                  <div key={idx} className={styles.sectionEditCard}>
                    <div className={styles.sectionEditHeader}>
                      <span className={styles.sectionIndexBadge}>Section {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSection(idx)}
                        className={styles.removeSectionBtn}
                        title="Remove section"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <Input
                      value={sec.heading}
                      onChange={(e) => handleSectionChange(idx, 'heading', e.target.value)}
                      placeholder="Section heading..."
                    />
                    <Textarea
                      value={sec.body}
                      onChange={(e) => handleSectionChange(idx, 'body', e.target.value)}
                      placeholder="Section markdown content..."
                      rows={4}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* For other types with raw content */}
          {(isFile || isLink) && (
            <div className={styles.formField}>
              <label className={styles.fieldLabel}>Additional Content</label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Content details or notes..."
                rows={4}
              />
            </div>
          )}

          <div className={styles.formField}>
            <label className={styles.fieldLabel}>Tags</label>
            <TagInput
              tags={editTags}
              onChange={setEditTags}
              placeholder="Type tag and press Enter..."
            />
          </div>

          <div className={styles.editActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsEditing(false)}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={isUpdating}>
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

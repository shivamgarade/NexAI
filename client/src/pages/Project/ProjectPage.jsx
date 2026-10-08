import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Folder,
  Sparkles,
  Plus,
  MessageSquare,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  FolderMinus,
  ExternalLink,
  ChevronRight,
  ArrowLeft,
  ArrowUp,
  Cpu,
  Mic,
  MicOff,
  Paperclip,
  FileText,
  Lock,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Dropdown } from '@/components/ui/Dropdown';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  ProjectSettingsModal,
  AddSourceModal,
  SourceViewerModal,
} from '@/features/projects';
import { useProjectStore } from '@/store/projectStore';
import { useChatStore } from '@/store/chatStore';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { ROUTES } from '@/constants/routes';
import styles from './ProjectPage.module.scss';

// Max project context capacity (2 MB text/content)
const MAX_PROJECT_CAPACITY_BYTES = 2 * 1024 * 1024;

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileExtension(filename) {
  if (!filename) return 'DOC';
  const parts = filename.split('.');
  if (parts.length > 1) {
    return parts.pop().toUpperCase().slice(0, 4);
  }
  return 'TXT';
}

export default function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const {
    currentProject,
    isLoading,
    fetchProject,
    deleteProject,
    deleteSource,
  } = useProjectStore();

  const { createChat, selectChat, deleteChat, moveChatToProject, sendMessage } = useChatStore();

  // Local state
  const [chatSearch, setChatSearch] = useState('');
  const [promptText, setPromptText] = useState('');
  const [selectedModel, setSelectedModel] = useState('flash');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [selectedSourceForView, setSelectedSourceForView] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  const textareaRef = useRef(null);
  const basePromptTextRef = useRef('');

  // Web Speech dictation hook with real-time streaming
  const { isSupported: isVoiceSupported, isListening, stopListening, toggleListening } = useSpeechRecognition({
    continuous: true,
    onInterim: (interim) => {
      const base = basePromptTextRef.current;
      if (interim) {
        setPromptText(base ? `${base} ${interim}` : interim);
      } else {
        setPromptText(base);
      }
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    onResult: (transcription) => {
      const base = basePromptTextRef.current;
      const updated = base ? `${base} ${transcription}` : transcription;
      basePromptTextRef.current = updated;
      setPromptText(updated);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
  });

  const handleToggleListening = () => {
    if (!isListening) {
      basePromptTextRef.current = promptText;
    }
    toggleListening();
  };

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
    }
  }, [projectId, fetchProject]);

  // Adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [promptText]);

  // Calculate project sources capacity
  const { totalSourceBytes, capacityPercent } = useMemo(() => {
    const sources = currentProject?.sources || [];
    const total = sources.reduce((acc, s) => acc + (s.size || 0), 0);
    const percent = Math.min(Math.round((total / MAX_PROJECT_CAPACITY_BYTES) * 100), 100);
    return { totalSourceBytes: total, capacityPercent: Math.max(percent, sources.length > 0 ? 1 : 0) };
  }, [currentProject?.sources]);

  // Filtered chats in project
  const filteredChats = useMemo(() => {
    const list = currentProject?.chats || [];
    if (!chatSearch.trim()) return list;
    const query = chatSearch.toLowerCase();
    return list.filter((chat) => (chat.title || '').toLowerCase().includes(query));
  }, [currentProject?.chats, chatSearch]);

  // Handle start chat from prompt bar
  const handleStartChatFromPrompt = async (e) => {
    e?.preventDefault();
    if (isListening) {
      stopListening();
    }
    if (isCreatingChat || !projectId) return;

    const trimmed = promptText.trim();
    setIsCreatingChat(true);

    try {
      const initialTitle = trimmed ? trimmed.slice(0, 40) : 'New Chat';
      const newChat = await createChat({ title: initialTitle, projectId });
      if (newChat) {
        await selectChat(newChat._id);
        navigate(`${ROUTES.CHAT}/${newChat._id}`);

        if (trimmed) {
          // Send initial prompt into newly created chat with selected model
          if (selectedModel) {
            useChatStore.getState().setSelectedModel(selectedModel);
          }
          setTimeout(() => {
            sendMessage(trimmed);
          }, 150);
        }
      }
    } finally {
      setIsCreatingChat(false);
      setPromptText('');
      basePromptTextRef.current = '';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleStartChatFromPrompt();
    }
  };

  const handleOpenChat = async (chatId) => {
    await selectChat(chatId);
    navigate(`${ROUTES.CHAT}/${chatId}`);
  };

  const handleRemoveFromProject = async (chatId, e) => {
    e?.stopPropagation();
    await moveChatToProject(chatId, null);
    if (projectId) {
      fetchProject(projectId);
    }
  };

  const handleDeleteChat = async (chatId, e) => {
    e?.stopPropagation();
    await deleteChat(chatId);
    if (projectId) {
      fetchProject(projectId);
    }
  };

  const handleDeleteSource = async (sourceId, e) => {
    e?.stopPropagation();
    if (!projectId) return;
    await deleteSource(projectId, sourceId);
  };

  const handleConfirmDeleteProject = async () => {
    if (!projectId) return;
    setIsDeleting(true);
    try {
      const ok = await deleteProject(projectId);
      if (ok) {
        navigate(ROUTES.CHAT);
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteModalOpen(false);
    }
  };

  if (isLoading && !currentProject) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSkeleton}>
          <Skeleton height={32} width="30%" />
          <Skeleton height={20} width="50%" />
          <Skeleton height={140} width="100%" />
          <Skeleton height={240} width="100%" />
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className={styles.container}>
        <EmptyState
          icon={<Folder size={32} />}
          title="Project not found"
          description="The requested project workspace could not be found or has been removed."
          action={
            <Button variant="primary" onClick={() => navigate(ROUTES.CHAT)}>
              Return to Chats
            </Button>
          }
        />
      </div>
    );
  }

  const projectColor = currentProject.color || '#8b5cf6';
  const sources = currentProject.sources || [];

  return (
    <div className={styles.container}>
      {/* Top Breadcrumb Navigation */}
      <div className={styles.breadcrumbBar}>
        <button
          type="button"
          className={styles.backLink}
          onClick={() => navigate(ROUTES.CHAT)}
        >
          <ArrowLeft size={13} /> Projects
        </button>
        <ChevronRight size={13} className={styles.crumbSep} />
        <span className={styles.crumbActive}>{currentProject.name}</span>
      </div>

      {/* Project Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <div
              className={styles.projectIconBadge}
              style={{
                backgroundColor: `${projectColor}20`,
                color: projectColor,
                borderColor: `${projectColor}40`,
              }}
            >
              <Folder size={20} />
            </div>
            <h1 className={styles.title}>{currentProject.name}</h1>
          </div>
          {currentProject.description ? (
            <p className={styles.description}>{currentProject.description}</p>
          ) : (
            <p className={styles.description}>No description added for this project</p>
          )}
        </div>

        <div className={styles.headerActions}>
          <Dropdown
            trigger={
              <IconButton
                icon={<MoreVertical size={17} />}
                label="Project options"
                variant="ghost"
              />
            }
            items={[
              {
                label: 'Project settings',
                icon: <Edit2 size={14} />,
                onClick: () => setIsSettingsModalOpen(true),
              },
              {
                label: 'Add sources',
                icon: <Plus size={14} />,
                onClick: () => setIsAddSourceModalOpen(true),
              },
              {
                label: 'Delete project',
                icon: <Trash2 size={14} />,
                danger: true,
                onClick: () => setIsDeleteModalOpen(true),
              },
            ]}
            align="right"
          />
        </div>
      </header>

      {/* Main 2-Column Layout */}
      <div className={styles.layoutGrid}>
        {/* Left Column: Chat Composer & Conversations List */}
        <div className={styles.mainCol}>
          {/* Prompt Bar / Chat Composer */}
          <form className={styles.promptBar} onSubmit={handleStartChatFromPrompt}>
            <textarea
              ref={textareaRef}
              rows={1}
              value={promptText}
              onChange={(e) => {
                setPromptText(e.target.value);
                basePromptTextRef.current = e.target.value;
              }}
              onKeyDown={handleKeyDown}
              placeholder={`Ask anything or start a chat in ${currentProject.name}...`}
              className={styles.promptTextarea}
            />

            <div className={styles.promptBottomBar}>
              <div className={styles.promptLeftActions}>
                <IconButton
                  icon={<Paperclip size={15} />}
                  label="Add source to project"
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setIsAddSourceModalOpen(true)}
                  title="Upload local files as project sources"
                />

                <button
                  type="button"
                  className={`${styles.modelPill} ${selectedModel === 'flash' ? styles.activeModel : ''}`}
                  onClick={() => setSelectedModel('flash')}
                >
                  <Sparkles size={12} /> Flash
                </button>
                <button
                  type="button"
                  className={`${styles.modelPill} ${selectedModel === 'pro' ? styles.activeModel : ''}`}
                  onClick={() => setSelectedModel('pro')}
                >
                  <Cpu size={12} /> Pro
                </button>
              </div>

              <div className={styles.promptRightActions}>
                {isVoiceSupported && (
                  <IconButton
                    icon={isListening ? <MicOff size={15} /> : <Mic size={15} />}
                    label={isListening ? 'Stop dictation' : 'Voice dictation'}
                    size="sm"
                    variant={isListening ? 'danger' : 'ghost'}
                    type="button"
                    onClick={handleToggleListening}
                  />
                )}

                <button
                  type="submit"
                  className={styles.sendBtn}
                  disabled={isCreatingChat}
                  aria-label="Start chat"
                  title="Send message or start chat"
                >
                  <ArrowUp size={15} />
                </button>
              </div>
            </div>
          </form>

          {/* Conversations Section */}
          <section className={styles.chatsSection}>
            <div className={styles.chatsHeader}>
              <h2 className={styles.chatsTitle}>
                Conversations ({filteredChats.length})
              </h2>

              {filteredChats.length > 0 && (
                <div className={styles.chatSearchWrapper}>
                  <Input
                    placeholder="Search chats..."
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    prefix={<Search size={13} />}
                    size="sm"
                  />
                </div>
              )}
            </div>

            {filteredChats.length === 0 ? (
              <div className={styles.projectEmptyState}>
                <div className={styles.emptyStateIcon}>
                  <MessageSquare size={34} />
                </div>
                <p className={styles.emptyStateTitle}>
                  NexAI references the same knowledge every time you talk to it in this project.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={handleStartChatFromPrompt}
                  loading={isCreatingChat}
                >
                  Start New Chat in Project
                </Button>
              </div>
            ) : (
              <div className={styles.chatsList}>
                {filteredChats.map((chat) => (
                  <div
                    key={chat._id}
                    className={styles.chatCard}
                    onClick={() => handleOpenChat(chat._id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleOpenChat(chat._id)}
                  >
                    <div className={styles.chatCardLeft}>
                      <MessageSquare size={16} className={styles.chatIcon} />
                      <div className={styles.chatCardInfo}>
                        <span className={styles.chatCardTitle}>
                          {chat.title || 'Untitled Chat'}
                        </span>
                        <span className={styles.chatCardDate}>
                          {new Date(chat.updatedAt || chat.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={
                          <IconButton
                            icon={<MoreVertical size={14} />}
                            label="Chat options"
                            size="sm"
                            variant="ghost"
                          />
                        }
                        items={[
                          {
                            label: 'Open chat',
                            icon: <ExternalLink size={13} />,
                            onClick: () => handleOpenChat(chat._id),
                          },
                          {
                            label: 'Remove from project',
                            icon: <FolderMinus size={13} />,
                            onClick: (e) => handleRemoveFromProject(chat._id, e),
                          },
                          {
                            label: 'Delete chat',
                            icon: <Trash2 size={13} />,
                            danger: true,
                            onClick: (e) => handleDeleteChat(chat._id, e),
                          },
                        ]}
                        align="right"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Project Sidebar Cards (Instructions, Memory, Context) */}
        <aside className={styles.sideCol}>
          {/* Instructions Card */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <span className={styles.sideCardTitle}>
                <Sparkles size={14} /> Instructions
              </span>
              <IconButton
                icon={<Edit2 size={13} />}
                label="Edit instructions"
                size="sm"
                variant="ghost"
                onClick={() => setIsSettingsModalOpen(true)}
              />
            </div>

            {currentProject.customInstructions ? (
              <pre className={styles.instructionsText}>
                {currentProject.customInstructions}
              </pre>
            ) : (
              <p className={styles.instructionsPlaceholder}>
                No instructions set. Click edit to set custom persona, constraints, or guidelines for this project.
              </p>
            )}
          </div>

          {/* Memory Card */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <span className={styles.sideCardTitle}>
                <Lock size={14} /> Memory
              </span>
              <span className={styles.memoryTag}>Project-only</span>
            </div>
            <p className={styles.memorySubtext}>
              NexAI isolates conversation memory and sources to this project. Its memory is hidden from outside chats.
            </p>
          </div>

          {/* Context / Sources Card */}
          <div className={styles.sideCard}>
            <div className={styles.sideCardHeader}>
              <span className={styles.sideCardTitle}>
                <FileText size={14} /> Context ({sources.length})
              </span>
              <div className={styles.sideCardActions}>
                <IconButton
                  icon={<Plus size={14} />}
                  label="Add source"
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsAddSourceModalOpen(true)}
                  title="Add local file source"
                />
              </div>
            </div>

            {/* Capacity Progress Bar */}
            <div className={styles.capacitySection}>
              <div className={styles.capacityBarTrack}>
                <div
                  className={styles.capacityBarFill}
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
              <div className={styles.capacityLabel}>
                <span>{capacityPercent}% of project capacity used ({formatBytes(totalSourceBytes)})</span>
                <span title="Calculated from local source files attached to this project">
                  <Info size={12} />
                </span>
              </div>
            </div>

            {/* Sources List / Preview Thumbnails */}
            {sources.length === 0 ? (
              <div className={styles.emptySourcesBox}>
                <p className={styles.emptySourcesText}>
                  Upload local files (Markdown, PDF, code, text, JSON) to give AI grounded context in this project.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus size={13} />}
                  onClick={() => setIsAddSourceModalOpen(true)}
                >
                  Add Sources
                </Button>
              </div>
            ) : (
              <div className={styles.sourcesGrid}>
                {sources.map((src) => (
                  <div
                    key={src._id}
                    className={styles.sourceThumbCard}
                    onClick={() => setSelectedSourceForView(src)}
                    title={`Click to view ${src.name}`}
                  >
                    <div className={styles.sourceThumbTop}>
                      <span className={styles.extBadge}>
                        {getFileExtension(src.name)}
                      </span>
                      <button
                        type="button"
                        className={styles.sourceDeleteBtn}
                        onClick={(e) => handleDeleteSource(src._id, e)}
                        title="Delete source"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div className={styles.sourceThumbSnippet}>
                      {src.content ? src.content.slice(0, 90) : 'Document content'}
                    </div>

                    <div className={styles.sourceThumbBottom}>
                      <span className={styles.sourceThumbName}>{src.name}</span>
                      <span className={styles.sourceThumbSize}>
                        {formatBytes(src.size)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        open={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        project={currentProject}
        onSuccess={() => {
          if (projectId) fetchProject(projectId);
        }}
        onOpenDeleteConfirm={() => setIsDeleteModalOpen(true)}
      />

      {/* Add Local File Sources Modal */}
      <AddSourceModal
        open={isAddSourceModalOpen}
        onClose={() => setIsAddSourceModalOpen(false)}
        projectId={currentProject._id}
        onSourceAdded={() => {
          if (projectId) fetchProject(projectId);
        }}
      />

      {/* View Source File Content Modal */}
      <SourceViewerModal
        open={Boolean(selectedSourceForView)}
        onClose={() => setSelectedSourceForView(null)}
        source={selectedSourceForView}
      />

      {/* Delete Project Confirmation Modal */}
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Project Workspace"
      >
        <div className={styles.confirmBox}>
          <p className={styles.confirmText}>
            Are you sure you want to delete <strong>{currentProject.name}</strong>?
          </p>
          <p className={styles.confirmSubtext}>
            Chats in this project will not be lost. They will be safely preserved as standalone chats in your chat history.
          </p>
          <div className={styles.confirmActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={isDeleting}
              onClick={handleConfirmDeleteProject}
            >
              Delete Project
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

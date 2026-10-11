import { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  SquarePen,
  Search,
  MessageSquare,
  Bookmark,
  Terminal,
  Mic,
  Wallet,
  Settings,
  Shield,
  Layers,
  LogOut,
  PanelLeftClose,
  MoreHorizontal,
  ChevronDown,
  ChevronRight,
  Folder,
  Edit2,
  Trash2,
  Check,
  X,
  Zap,
  Pin,
  Archive,
  Share2,
  List,
  Plus,
  ExternalLink,
  Clock,
  Database,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown } from '@/components/ui/Dropdown';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useProjectStore } from '@/store/projectStore';
import { useWalletStore } from '@/store/walletStore';
import { useUiStore } from '@/store/uiStore';
import { toast } from '@/store/uiStore';
import { CreateProjectModal, MoveToProjectModal } from '@/features/projects';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import logoImg from '@/assets/logo.png';
import styles from './Sidebar.module.scss';

export function Sidebar({ onItemClick, isMobile = false }) {
  const { user, logout } = useAuthStore();
  const {
    chats,
    activeChatId,
    isLoadingChats,
    fetchChats,
    selectChat,
    updateChatTitle,
    deleteChat,
  } = useChatStore();

  const { projects, fetchProjects, deleteProject } = useProjectStore();

  const isCollapsedInStore = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebarCollapsed = useUiStore((state) => state.toggleSidebarCollapsed);

  // If inside mobile drawer, never show collapsed rail
  const isCollapsed = isMobile ? false : isCollapsedInStore;

  const navigate = useNavigate();
  const location = useLocation();

  // Collapsible sections and state
  const [isProjectsOpen, setIsProjectsOpen] = useState(true);
  const [isChatsOpen, setIsChatsOpen] = useState(true);
  const [organizeMode, setOrganizeMode] = useState(() => {
    try {
      return localStorage.getItem('nexai_chat_organize_mode') || 'list';
    } catch {
      return 'list';
    }
  }); // 'list' | 'project'
  const [chatFilter, setChatFilter] = useState('all'); // 'all' | 'today' | 'week' | 'older'

  const handleSetOrganizeMode = (mode) => {
    setOrganizeMode(mode);
    try {
      localStorage.setItem('nexai_chat_organize_mode', mode);
    } catch {
      // Ignore storage errors
    }
  };
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('nexai_collapsed_chat_groups');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleGroupCollapse = (groupId) => {
    setCollapsedGroups((prev) => {
      const next = {
        ...prev,
        [groupId]: !prev[groupId],
      };
      try {
        localStorage.setItem('nexai_collapsed_chat_groups', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  // Modals state for projects
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState(null);
  const [movingChat, setMovingChat] = useState(null);

  // Local storage persisted pinned and archived chats
  const [pinnedChatIds, setPinnedChatIds] = useState(() => {
    try {
      const saved = localStorage.getItem('nexai_pinned_chats');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [archivedChatIds, setArchivedChatIds] = useState(() => {
    try {
      const saved = localStorage.getItem('nexai_archived_chats');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingChatId, setDeletingChatId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Initial fetch of chats and projects
  useEffect(() => {
    fetchChats();
    fetchProjects();
  }, [fetchChats, fetchProjects]);

  // Primary visible navigation links
  const primaryNavItems = [
    { to: ROUTES.CHAT, label: 'Chat', icon: <MessageSquare size={17} /> },
    { to: ROUTES.LIBRARY, label: 'Library', icon: <Bookmark size={17} /> },
    { to: ROUTES.PROMPTS, label: 'Prompts', icon: <Terminal size={17} /> },
    { to: ROUTES.INTERVIEW, label: 'Interview', icon: <Mic size={17} /> },
    { to: ROUTES.SCHEMA, label: 'Data Modeling', icon: <Database size={17} /> },
  ];

  // Secondary items for ChatGPT-style floating "... More" popover
  const moreNavDropdownItems = [
    {
      label: 'Search',
      icon: <Search size={16} />,
      onClick: () => {
        navigate(ROUTES.SEARCH);
        onItemClick?.();
      },
    },
    {
      label: 'Wallet',
      icon: <Wallet size={16} />,
      onClick: () => {
        navigate(ROUTES.WALLET);
        onItemClick?.();
      },
    },
  ];

  if (user?.role === 'admin') {
    moreNavDropdownItems.push({
      label: 'Admin',
      icon: <Shield size={16} />,
      onClick: () => {
        navigate(ROUTES.ADMIN);
        onItemClick?.();
      },
    });
  }

  if (import.meta.env.DEV) {
    moreNavDropdownItems.push({
      label: 'Design System',
      icon: <Layers size={16} />,
      onClick: () => {
        navigate(ROUTES.DESIGN_SYSTEM);
        onItemClick?.();
      },
    });
  }

  // Filter out archived chats and apply date categorization
  const visibleChats = useMemo(() => {
    let list = chats.filter((c) => !archivedChatIds.includes(c._id));

    if (chatFilter !== 'all') {
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;
      const sevenDays = 7 * oneDay;

      list = list.filter((chat) => {
        const chatDate = new Date(chat.updatedAt || chat.createdAt);
        const diff = now - chatDate;

        if (chatFilter === 'today') return diff < oneDay;
        if (chatFilter === 'week') return diff >= oneDay && diff < sevenDays;
        if (chatFilter === 'older') return diff >= sevenDays;
        return true;
      });
    }

    return list;
  }, [chats, archivedChatIds, chatFilter]);

  // Separate pinned and unpinned chats
  const pinnedChats = useMemo(() => {
    return visibleChats.filter((c) => pinnedChatIds.includes(c._id));
  }, [visibleChats, pinnedChatIds]);

  const unpinnedChats = useMemo(() => {
    return visibleChats.filter((c) => !pinnedChatIds.includes(c._id));
  }, [visibleChats, pinnedChatIds]);

  const togglePin = (chatId, e) => {
    e?.stopPropagation();
    setPinnedChatIds((prev) => {
      const next = prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [chatId, ...prev];
      try {
        localStorage.setItem('nexai_pinned_chats', JSON.stringify(next));
      } catch (err) {
        void err;
      }
      return next;
    });
  };

  const handleArchive = (chatId, e) => {
    e?.stopPropagation();
    setArchivedChatIds((prev) => {
      const next = [...prev, chatId];
      try {
        localStorage.setItem('nexai_archived_chats', JSON.stringify(next));
      } catch (err) {
        void err;
      }
      return next;
    });
    toast.info('Conversation archived');
  };

  const handleShare = async (chat, e) => {
    e?.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/chat/${chat._id}`);
      toast.success('Chat link copied to clipboard!');
    } catch {
      toast.info('Link ready to share');
    }
  };

  const handleNewChat = () => {
    selectChat(null);
    navigate(ROUTES.CHAT);
    onItemClick?.();
  };

  const handleSelectChat = (chatId) => {
    selectChat(chatId);
    navigate(`/chat/${chatId}`);
    onItemClick?.();
  };

  const handleSelectProject = (project) => {
    const id = project._id || project.id;
    navigate(`/projects/${id}`);
    onItemClick?.();
  };

  const handleStartEditProject = (project, e) => {
    e?.stopPropagation();
    setProjectToEdit(project);
    setIsCreateProjectOpen(true);
  };

  const handleDeleteProject = async (project, e) => {
    e?.stopPropagation();
    const id = project._id || project.id;
    await deleteProject(id);
  };

  const handleStartRename = (chat, e) => {
    e?.stopPropagation();
    setEditingChatId(chat._id);
    setEditTitle(chat.title);
  };

  const handleSaveRename = async (chatId, e) => {
    e?.stopPropagation();
    if (editTitle.trim()) {
      await updateChatTitle(chatId, editTitle.trim());
    }
    setEditingChatId(null);
  };

  const handleCancelRename = (e) => {
    e?.stopPropagation();
    setEditingChatId(null);
  };

  const handleStartDelete = (chatId, e) => {
    e?.stopPropagation();
    setDeletingChatId(chatId);
  };

  const handleConfirmDelete = async () => {
    if (!deletingChatId) return;
    setIsDeleting(true);
    const wasActive = activeChatId === deletingChatId;
    await deleteChat(deletingChatId);
    setIsDeleting(false);
    setDeletingChatId(null);

    if (wasActive && location.pathname.startsWith('/chat/')) {
      navigate(ROUTES.CHAT);
    }
  };

  const storeGovernance = useWalletStore((state) => state.governance);
  const quotaRemaining = storeGovernance?.dailyRequestsRemaining ?? 1500;
  const quotaLimit = storeGovernance?.dailyGeminiQuotaLimit ?? 1500;
  const userDisplayName = user?.email ? user.email.split('@')[0] : 'User';
  const userPlan =
    user?.role === 'admin'
      ? 'Admin'
      : user?.wallet?.tier === 'pro_monthly'
        ? 'Pro Tier'
        : 'Free Tier';

  const userMenuItems = [
    {
      label: `API Quota (${quotaRemaining.toLocaleString()} calls left)`,
      icon: <Zap size={15} />,
      onClick: () => {
        onItemClick?.();
        navigate(ROUTES.WALLET);
      },
    },
    {
      label: 'Settings',
      icon: <Settings size={15} />,
      onClick: () => {
        onItemClick?.();
        navigate(ROUTES.SETTINGS);
      },
    },
    { divider: true },
    {
      label: 'Sign Out',
      icon: <LogOut size={15} />,
      danger: true,
      onClick: async () => {
        onItemClick?.();
        await logout();
        navigate(ROUTES.LOGIN);
      },
    },
  ];

  const renderChatItem = (chat) => {
    const isActive = chat._id === activeChatId;
    const isEditing = chat._id === editingChatId;
    const isPinned = pinnedChatIds.includes(chat._id);

    return (
      <div
        key={chat._id}
        className={cn(styles.chatItem, isActive && styles.active, isPinned && styles.hasPinned)}
        onClick={() => {
          if (!isEditing) {
            handleSelectChat(chat._id);
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !isEditing) {
            handleSelectChat(chat._id);
          }
        }}
      >
        {isEditing ? (
          <div className={styles.editRow} onClick={(e) => e.stopPropagation()}>
            <input
              type="text"
              className={styles.editInput}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveRename(chat._id, e);
                if (e.key === 'Escape') handleCancelRename(e);
              }}
              autoFocus
            />
            <button
              type="button"
              className={styles.inlineActionBtn}
              onClick={(e) => handleSaveRename(chat._id, e)}
              aria-label="Save title"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              className={styles.inlineActionBtn}
              onClick={handleCancelRename}
              aria-label="Cancel rename"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <>
            <span className={styles.chatTitle} title={chat.title}>
              {chat.title}
            </span>

            {/* Hover Actions: Quick Pin Icon + Three Dots Context Menu */}
            <div className={styles.chatActions} onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className={cn(styles.pinBtn, isPinned && styles.isPinned)}
                onClick={(e) => togglePin(chat._id, e)}
                title={isPinned ? 'Unpin chat' : 'Pin chat'}
                aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}
              >
                <Pin size={13} className={styles.pinIcon} />
              </button>

              <Dropdown
                trigger={
                  <IconButton
                    icon={<MoreHorizontal size={14} />}
                    label="Chat options"
                    size="sm"
                    variant="ghost"
                    className={styles.itemMenuBtn}
                  />
                }
                items={[
                  {
                    label: 'Share',
                    icon: <Share2 size={13} />,
                    onClick: (e) => handleShare(chat, e),
                  },
                  {
                    label: 'Rename',
                    icon: <Edit2 size={13} />,
                    onClick: (e) => handleStartRename(chat, e),
                  },
                  {
                    label: isPinned ? 'Unpin chat' : 'Pin chat',
                    icon: <Pin size={13} />,
                    onClick: (e) => togglePin(chat._id, e),
                  },
                  {
                    label: 'Archive',
                    icon: <Archive size={13} />,
                    onClick: (e) => handleArchive(chat._id, e),
                  },
                  {
                    label: 'Delete',
                    icon: <Trash2 size={13} />,
                    danger: true,
                    onClick: (e) => handleStartDelete(chat._id, e),
                  },
                  { divider: true },
                  {
                    label: 'Move to project',
                    icon: <Folder size={13} />,
                    trailing: <ChevronRight size={13} />,
                    onClick: () => {
                      setMovingChat(chat);
                    },
                  },
                ]}
                align="flyout"
              />
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(styles.sidebar, isCollapsed && styles.collapsed, isMobile && styles.mobile)}
      aria-label="Sidebar navigation"
    >
      {/* Brand Header: Single search icon + collapse toggle on top right */}
      <div className={styles.brandHeader}>
        {isCollapsed ? (
          <button
            type="button"
            className={styles.collapsedBrandBtn}
            onClick={toggleSidebarCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <img src={logoImg} alt="NexAI Logo" className={styles.collapsedBrandLogo} />
          </button>
        ) : (
          <>
            <div
              className={styles.brandTitle}
              onClick={() => {
                onItemClick?.();
                navigate(ROUTES.CHAT);
              }}
              role="button"
              tabIndex={0}
              title="NexAI"
            >
              <img src={logoImg} alt="NexAI Logo" className={styles.brandLogo} />
              <span>NexAI</span>
            </div>

            <div className={styles.headerActions}>
              <IconButton
                icon={<Search size={17} />}
                label="Search workspace and conversations"
                size="sm"
                variant="ghost"
                onClick={() => {
                  onItemClick?.();
                  navigate(ROUTES.SEARCH);
                }}
                className={styles.headerActionBtn}
              />
              {!isMobile && (
                <IconButton
                  icon={<PanelLeftClose size={18} />}
                  label="Collapse sidebar"
                  size="sm"
                  variant="ghost"
                  onClick={toggleSidebarCollapsed}
                  className={styles.headerActionBtn}
                />
              )}
            </div>
          </>
        )}
      </div>

      {/* Primary Action: New chat & Search */}
      <div className={styles.newChatWrapper}>
        {isCollapsed ? (
          <div className={styles.collapsedActions}>
            <IconButton
              icon={<SquarePen size={18} />}
              label="New chat"
              variant="ghost"
              size="md"
              onClick={handleNewChat}
              className={styles.collapsedNewChatBtn}
            />
            <IconButton
              icon={<Search size={18} />}
              label="Search conversations"
              variant="ghost"
              size="md"
              onClick={() => {
                onItemClick?.();
                navigate(ROUTES.SEARCH);
              }}
              className={styles.collapsedSearchBtn}
            />
          </div>
        ) : (
          <div className={styles.newChatRow}>
            <button
              type="button"
              className={styles.expandedNewChatBtn}
              onClick={handleNewChat}
              aria-label="New chat"
            >
              <SquarePen size={17} className={styles.newChatIcon} />
              <span>New chat</span>
            </button>
          </div>
        )}
      </div>

      {/* Primary Navigation Links + ChatGPT-style floating "... More" popover */}
      <nav className={styles.navSection} aria-label="Main Navigation">
        {primaryNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onItemClick}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) => cn(styles.navItem, isActive && styles.active)}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
          </NavLink>
        ))}

        {/* ChatGPT Style "... More" row with floating flyout dropdown */}
        {!isCollapsed && (
          <Dropdown
            trigger={
              <button
                type="button"
                className={cn(styles.navItem, styles.moreTriggerBtn)}
                aria-label="Toggle more navigation links"
              >
                <span className={styles.navIcon}>
                  <MoreHorizontal size={17} />
                </span>
                <span className={styles.navLabel}>More</span>
              </button>
            }
            items={moreNavDropdownItems}
            align={isMobile ? 'left' : 'flyout'}
            className={styles.moreDropdownWrapper}
          />
        )}
      </nav>

      {/* Scrollable Middle Container: Projects & Chats */}
      <div className={styles.middleScrollArea}>


        {/* Collapsible Projects Section (ChatGPT Style) */}
        {!isCollapsed && (
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeaderRow}>
              <button
                type="button"
                className={styles.titleToggleBtn}
                onClick={() => setIsProjectsOpen((prev) => !prev)}
                aria-expanded={isProjectsOpen}
                aria-label="Toggle projects section"
              >
                <span className={styles.sectionTitle}>Projects</span>
                <span className={styles.sectionChevron}>
                  {isProjectsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
              </button>

              <IconButton
                icon={<Plus size={14} />}
                label="New project"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setProjectToEdit(null);
                  setIsCreateProjectOpen(true);
                }}
                className={styles.headerQuickBtn}
              />
            </div>

            {isProjectsOpen && (
              <div className={styles.sectionList}>
                {projects.map((proj) => {
                  const projId = proj._id || proj.id;
                  const isActive = location.pathname === `/projects/${projId}`;

                  return (
                    <div
                      key={projId}
                      className={cn(styles.listItem, isActive && styles.active)}
                      onClick={() => handleSelectProject(proj)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSelectProject(proj);
                      }}
                    >
                      <Folder
                        size={14}
                        className={styles.itemIcon}
                        style={{ color: proj.color || '#8b5cf6' }}
                      />
                      <span className={styles.itemTitle}>{proj.name}</span>
                      <div
                        className={styles.projectActions}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Dropdown
                          trigger={
                            <IconButton
                              icon={<MoreHorizontal size={13} />}
                              label="Project options"
                              size="sm"
                              variant="ghost"
                              className={styles.itemMenuBtn}
                            />
                          }
                          items={[
                            {
                              label: 'Open workspace',
                              icon: <ExternalLink size={13} />,
                              onClick: () => handleSelectProject(proj),
                            },
                            {
                              label: 'Edit project',
                              icon: <Edit2 size={13} />,
                              onClick: (e) => handleStartEditProject(proj, e),
                            },
                            {
                              label: 'Delete project',
                              icon: <Trash2 size={13} />,
                              danger: true,
                              onClick: (e) => handleDeleteProject(proj, e),
                            },
                          ]}
                          align="flyout"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Collapsible Chats Section (ChatGPT Style: New chat edit icon + 3-dots with 'Organize chats') */}
        {!isCollapsed && (
          <div className={styles.sectionBlock}>
            <div className={styles.sectionHeaderRow}>
              <button
                type="button"
                className={styles.titleToggleBtn}
                onClick={() => setIsChatsOpen((prev) => !prev)}
                aria-expanded={isChatsOpen}
                aria-label="Toggle chats section"
              >
                <span className={styles.sectionTitle}>Chats</span>
                <span className={styles.sectionChevron}>
                  {isChatsOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
              </button>

              {/* Two header action icons: New Chat + 3-Dots Organize Dropdown */}
              <div className={styles.headerRightControls}>
                <IconButton
                  icon={<SquarePen size={14} />}
                  label="New chat"
                  size="sm"
                  variant="ghost"
                  onClick={handleNewChat}
                  className={styles.headerQuickBtn}
                />

                <Dropdown
                  trigger={
                    <IconButton
                      icon={<MoreHorizontal size={14} />}
                      label="Filter chats"
                      size="sm"
                      variant="ghost"
                      className={styles.headerQuickBtn}
                    />
                  }
                  items={[
                    { header: true, label: 'Organize chats' },
                    {
                      label: 'In one list',
                      icon: <List size={14} />,
                      trailing: organizeMode === 'list' && chatFilter === 'all' ? <Check size={14} /> : undefined,
                      active: organizeMode === 'list' && chatFilter === 'all',
                      onClick: () => {
                        handleSetOrganizeMode('list');
                        setChatFilter('all');
                      },
                    },
                    {
                      label: 'By project',
                      icon: <Folder size={14} />,
                      trailing: organizeMode === 'project' ? <Check size={14} /> : undefined,
                      active: organizeMode === 'project',
                      onClick: () => handleSetOrganizeMode('project'),
                    },
                    { divider: true },
                    { header: true, label: 'Filter by date' },
                    {
                      label: 'Today',
                      trailing: chatFilter === 'today' ? <Check size={14} /> : undefined,
                      active: chatFilter === 'today',
                      onClick: () => setChatFilter('today'),
                    },
                    {
                      label: 'Previous 7 days',
                      trailing: chatFilter === 'week' ? <Check size={14} /> : undefined,
                      active: chatFilter === 'week',
                      onClick: () => setChatFilter('week'),
                    },
                    {
                      label: 'Older',
                      trailing: chatFilter === 'older' ? <Check size={14} /> : undefined,
                      active: chatFilter === 'older',
                      onClick: () => setChatFilter('older'),
                    },
                  ]}
                  align="flyout"
                />
              </div>
            </div>

            {isChatsOpen && (
              <div className={styles.sectionList} role="list" aria-label="Recent chats">
                {isLoadingChats ? (
                  <div className={styles.skeletonList}>
                    <Skeleton height="30px" radius="md" />
                    <Skeleton height="30px" radius="md" />
                    <Skeleton height="30px" radius="md" />
                  </div>
                ) : visibleChats.length === 0 ? (
                  <div className={styles.emptyNotice}>
                    <p>No conversations yet</p>
                  </div>
                ) : (
                  <>
                    {organizeMode === 'project' ? (
                      <div className={styles.projectGroups}>
                        {projects.map((proj) => {
                          const projId = (proj._id || proj.id)?.toString();
                          const projChats = visibleChats.filter(
                            (c) => (c.projectId?.toString() || c.projectId) === projId,
                          );
                          if (projChats.length === 0) return null;
                          const isGroupCollapsed = !!collapsedGroups[projId];

                          return (
                            <div key={projId} className={styles.chatGroup}>
                              <div className={styles.groupHeaderRow}>
                                <button
                                  type="button"
                                  className={styles.groupToggleBtn}
                                  onClick={() => toggleGroupCollapse(projId)}
                                  aria-expanded={!isGroupCollapsed}
                                  aria-label={`Toggle ${proj.name} group`}
                                >
                                  <span className={styles.groupChevron}>
                                    {isGroupCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                  </span>
                                  <Folder
                                    size={13}
                                    style={{ color: proj.color || '#8b5cf6' }}
                                    className={styles.groupFolderIcon}
                                  />
                                  <span className={styles.groupName}>{proj.name}</span>
                                  <span className={styles.groupBadge}>{projChats.length}</span>
                                </button>
                                <IconButton
                                  icon={<ExternalLink size={12} />}
                                  label={`Open ${proj.name} workspace`}
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectProject(proj);
                                  }}
                                  className={styles.groupQuickOpenBtn}
                                />
                              </div>
                              {!isGroupCollapsed && (
                                <div className={styles.nestedGroupList}>
                                  {projChats.map((chat) => renderChatItem(chat))}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Standalone Chats (Not assigned to any project) */}
                        {(() => {
                          const standaloneChats = visibleChats.filter((c) => !c.projectId);
                          if (standaloneChats.length === 0) return null;
                          const isStandaloneCollapsed = !!collapsedGroups['standalone'];

                          return (
                            <div className={styles.chatGroup}>
                              <div className={styles.groupHeaderRow}>
                                <button
                                  type="button"
                                  className={styles.groupToggleBtn}
                                  onClick={() => toggleGroupCollapse('standalone')}
                                  aria-expanded={!isStandaloneCollapsed}
                                  aria-label="Toggle Standalone chats group"
                                >
                                  <span className={styles.groupChevron}>
                                    {isStandaloneCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                                  </span>
                                  <Layers size={13} className={styles.standaloneIcon} />
                                  <span className={styles.groupName}>Standalone Chats</span>
                                  <span className={styles.groupBadge}>{standaloneChats.length}</span>
                                </button>
                              </div>
                              {!isStandaloneCollapsed && (
                                <div className={styles.nestedGroupList}>
                                  {standaloneChats.map((chat) => renderChatItem(chat))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      <>
                        {/* Pinned Section */}
                        {pinnedChats.length > 0 && (
                          <div className={styles.chatGroup}>
                            <div className={styles.groupHeaderRow}>
                              <button
                                type="button"
                                className={styles.groupToggleBtn}
                                onClick={() => toggleGroupCollapse('pinned')}
                                aria-expanded={!collapsedGroups['pinned']}
                                aria-label="Toggle pinned chats"
                              >
                                <span className={styles.groupChevron}>
                                  {collapsedGroups['pinned'] ? (
                                    <ChevronRight size={12} />
                                  ) : (
                                    <ChevronDown size={12} />
                                  )}
                                </span>
                                <Pin size={11} className={styles.groupPinIcon} />
                                <span className={styles.groupHeaderTitle}>Pinned</span>
                                <span className={styles.groupBadge}>{pinnedChats.length}</span>
                              </button>
                            </div>
                            {!collapsedGroups['pinned'] &&
                              pinnedChats.map((chat) => renderChatItem(chat))}
                          </div>
                        )}

                        {/* Unpinned / Recent Section */}
                        {unpinnedChats.length > 0 && (
                          <div className={styles.chatGroup}>
                            {pinnedChats.length > 0 && (
                              <div className={styles.groupHeaderRow}>
                                <button
                                  type="button"
                                  className={styles.groupToggleBtn}
                                  onClick={() => toggleGroupCollapse('recent')}
                                  aria-expanded={!collapsedGroups['recent']}
                                  aria-label="Toggle recent chats"
                                >
                                  <span className={styles.groupChevron}>
                                    {collapsedGroups['recent'] ? (
                                      <ChevronRight size={12} />
                                    ) : (
                                      <ChevronDown size={12} />
                                    )}
                                  </span>
                                  <Clock size={11} className={styles.groupClockIcon} />
                                  <span className={styles.groupHeaderTitle}>Recent</span>
                                  <span className={styles.groupBadge}>{unpinnedChats.length}</span>
                                </button>
                              </div>
                            )}
                            {(!pinnedChats.length || !collapsedGroups['recent']) &&
                              unpinnedChats.map((chat) => renderChatItem(chat))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* User Profile Footer Card (with Settings icon on the right side) */}
      <div className={styles.footerSection}>
        {!isCollapsed ? (
          <div className={styles.footerRow}>
            <div className={styles.userCardContainer}>
              <Dropdown
                trigger={
                  <div
                    className={styles.userCard}
                    role="button"
                    tabIndex={0}
                    aria-label="User account menu"
                  >
                    <Avatar name={user?.email || 'User'} size="sm" />
                    <div className={styles.userInfo}>
                      <span className={styles.userName}>{userDisplayName}</span>
                      <span className={styles.userPlan}>{userPlan}</span>
                    </div>
                    <div
                      className={styles.creditChip}
                      title={`⚡ Daily Quota: ${quotaRemaining.toLocaleString()} / ${quotaLimit.toLocaleString()} calls left`}
                    >
                      <Zap size={11} className={styles.creditIcon} />
                      <span>{quotaRemaining.toLocaleString()}</span>
                    </div>
                  </div>
                }
                items={userMenuItems}
                align="top-left"
              />
            </div>

            {/* Direct Settings button on the right side of the bottom user profile */}
            <IconButton
              icon={<Settings size={16} />}
              label="Settings"
              variant="ghost"
              size="sm"
              onClick={() => {
                onItemClick?.();
                navigate(ROUTES.SETTINGS);
              }}
              className={styles.footerSettingsBtn}
            />
          </div>
        ) : (
          <div className={styles.collapsedFooter}>
            <Dropdown
              trigger={
                <div
                  className={styles.collapsedUserAvatar}
                  role="button"
                  tabIndex={0}
                  title={`${userDisplayName} (${userPlan}) - ${quotaRemaining.toLocaleString()} calls left`}
                >
                  <Avatar name={user?.email || 'User'} size="sm" />
                </div>
              }
              items={userMenuItems}
              align="flyout"
            />
            <IconButton
              icon={<Settings size={16} />}
              label="Settings"
              variant="ghost"
              size="sm"
              onClick={() => {
                onItemClick?.();
                navigate(ROUTES.SETTINGS);
              }}
              className={styles.collapsedSettingsBtn}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deletingChatId)}
        title="Delete conversation?"
        description="This will permanently delete this conversation and all its messages. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        tone="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingChatId(null)}
      />

      <CreateProjectModal
        open={isCreateProjectOpen}
        onClose={() => {
          setIsCreateProjectOpen(false);
          setProjectToEdit(null);
        }}
        projectToEdit={projectToEdit}
        onSuccess={(p) => {
          if (p) navigate(`/projects/${p._id || p.id}`);
        }}
      />

      <MoveToProjectModal
        open={Boolean(movingChat)}
        onClose={() => setMovingChat(null)}
        chat={movingChat}
        onSuccess={() => {
          fetchChats();
          fetchProjects();
        }}
      />
    </aside>
  );
}

Sidebar.propTypes = {
  onItemClick: PropTypes.func,
  isMobile: PropTypes.bool,
};

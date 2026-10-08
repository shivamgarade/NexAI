import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore } from '@/store/chatStore';
import {
  Search,
  X,
  MessageSquare,
  Clock,
  ArrowRight,
  RotateCcw,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
  Check,
  Pin,
  MoreVertical,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Dropdown } from '@/components/ui/Dropdown';
import { useSearchStore } from '@/store/searchStore';
import { useDebounce } from '@/hooks/useDebounce';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './SearchPage.module.scss';

function HighlightedText({ text, query }) {
  if (!query || !query.trim() || !text) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className={styles.highlight}>
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function CustomCheckbox({ checked, onChange, ariaLabel }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={cn(styles.customCheckbox, checked && styles.checked)}
      onClick={(e) => {
        e.stopPropagation();
        onChange(e);
      }}
    >
      {checked && <Check size={11} className={styles.checkIcon} />}
    </button>
  );
}

export default function SearchPage() {
  const navigate = useNavigate();
  const searchContainerRef = useRef(null);

  const {
    chats: allChats,
    fetchChats,
    updateChatTitle,
    deleteChat,
    deleteMultipleChats,
  } = useChatStore();

  const {
    query,
    results,
    isLoading,
    error,
    recentSearches,
    setQuery,
    performSearch,
    clearSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useSearchStore();

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  // View mode preference (Grid / Cards vs List)
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('nexai_search_view_mode') || 'grid';
    } catch {
      return 'grid';
    }
  });

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('nexai_search_view_mode', mode);
    } catch {
      // Ignore storage errors
    }
  };

  // Pinned chat IDs synchronization
  const [pinnedChatIds, setPinnedChatIds] = useState(() => {
    try {
      const saved = localStorage.getItem('nexai_pinned_chats');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const togglePin = (chatId) => {
    setPinnedChatIds((prev) => {
      const next = prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [chatId, ...prev];
      try {
        localStorage.setItem('nexai_pinned_chats', JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  // Search input & focus state
  const [localInput, setLocalInput] = useState(query);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const debouncedInput = useDebounce(localInput, 300);

  useEffect(() => {
    if (debouncedInput.trim()) {
      performSearch(debouncedInput.trim(), 'chats');
    } else {
      clearSearch();
    }
  }, [debouncedInput, performSearch, clearSearch]);

  // Click outside to close recent searches dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClear = () => {
    setLocalInput('');
    clearSearch();
  };

  const handleRecentClick = (term) => {
    setLocalInput(term);
    setQuery(term);
    setIsSearchFocused(false);
    performSearch(term, 'chats');
  };

  // Multi-selection state
  const [selectedChatIds, setSelectedChatIds] = useState([]);

  // Rename Modal state
  const [chatToRename, setChatToRename] = useState(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  const handleStartRename = (chat) => {
    setChatToRename(chat);
    setRenameTitle(chat.title || '');
  };

  const handleConfirmRename = async () => {
    if (!chatToRename || !renameTitle.trim()) return;
    const targetId = chatToRename._id || chatToRename.chatId;
    setIsRenaming(true);
    await updateChatTitle(targetId, renameTitle.trim());
    setIsRenaming(false);
    setChatToRename(null);
  };

  // Single Delete Confirmation Modal
  const [chatToDelete, setChatToDelete] = useState(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  const handleStartDelete = (chat) => {
    setChatToDelete(chat);
  };

  const handleConfirmSingleDelete = async () => {
    if (!chatToDelete) return;
    const targetId = chatToDelete._id || chatToDelete.chatId;
    setIsDeletingSingle(true);
    await deleteChat(targetId);
    setSelectedChatIds((prev) => prev.filter((id) => id !== targetId));
    setIsDeletingSingle(false);
    setChatToDelete(null);
  };

  // Bulk Delete Confirmation Modal
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const handleConfirmBulkDelete = async () => {
    if (selectedChatIds.length === 0) return;
    setIsDeletingBulk(true);
    await deleteMultipleChats(selectedChatIds);
    setSelectedChatIds([]);
    setIsDeletingBulk(false);
    setIsBulkDeleteModalOpen(false);
  };

  // Determine current displayed chats list
  const isSearchActive = Boolean(debouncedInput.trim());
  const displayedChats = useMemo(() => {
    if (isSearchActive) {
      return results.chats || [];
    }
    return allChats;
  }, [isSearchActive, results.chats, allChats]);

  // Selection helpers
  const isAllSelected =
    displayedChats.length > 0 &&
    displayedChats.every((c) => selectedChatIds.includes(c._id || c.chatId));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedChatIds([]);
    } else {
      const allIds = displayedChats.map((c) => c._id || c.chatId);
      setSelectedChatIds(allIds);
    }
  };

  const handleToggleSelectOne = (chatId) => {
    setSelectedChatIds((prev) =>
      prev.includes(chatId) ? prev.filter((id) => id !== chatId) : [...prev, chatId],
    );
  };

  const handleChatNavigate = (chat) => {
    const id = chat._id || chat.chatId;
    navigate(`/chat/${id}`);
  };

  return (
    <div className={styles.pageContainer}>
      <PageHeader
        title="Search Conversations"
        description="Search through message history, rename titles, and organize your chats."
      />

      {/* Compact Search & Filter Section */}
      <div className={styles.searchSection}>
        <div ref={searchContainerRef} className={styles.searchInputWrapper}>
          <Search size={18} className={styles.searchIcon} />
          <input
            type="text"
            value={localInput}
            onChange={(e) => setLocalInput(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            placeholder="Search conversations by title or message content..."
            className={styles.searchInput}
            autoFocus
          />
          {localInput && (
            <button
              onClick={handleClear}
              className={styles.clearButton}
              aria-label="Clear search"
              type="button"
            >
              <X size={16} />
            </button>
          )}

          {/* Floating Recent Searches Popover */}
          {isSearchFocused && !localInput && recentSearches && recentSearches.length > 0 && (
            <div className={styles.recentPopover}>
              <div className={styles.recentPopoverHeader}>
                <span>
                  <Clock size={12} /> Recent Searches
                </span>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className={styles.clearAllBtn}
                >
                  Clear all
                </button>
              </div>
              <div className={styles.recentPopoverList}>
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    className={styles.recentItemRow}
                    onClick={() => handleRecentClick(term)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.recentItemText}>
                      <Clock size={13} className={styles.recentClockIcon} />
                      <span>{term}</span>
                    </div>
                    <button
                      type="button"
                      className={styles.removeRecentBtn}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(term);
                      }}
                      aria-label={`Remove ${term}`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Streamlined Toolbar */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            {selectedChatIds.length > 0 ? (
              <div className={styles.bulkActiveGroup}>
                <CustomCheckbox
                  checked={isAllSelected}
                  onChange={handleToggleSelectAll}
                  ariaLabel="Toggle select all"
                />
                <span className={styles.bulkCountText}>
                  {selectedChatIds.length} {selectedChatIds.length === 1 ? 'chat' : 'chats'} selected
                </span>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setIsBulkDeleteModalOpen(true)}
                >
                  <Trash2 size={13} /> Delete Selected ({selectedChatIds.length})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedChatIds([])}
                >
                  Deselect All
                </Button>
              </div>
            ) : (
              displayedChats.length > 0 && (
                <div className={styles.selectAllGroup} onClick={handleToggleSelectAll}>
                  <CustomCheckbox
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    ariaLabel="Select all conversations"
                  />
                  <span>Select All</span>
                  <Badge tone="neutral">
                    {displayedChats.length}{' '}
                    {displayedChats.length === 1 ? 'conversation' : 'conversations'}
                  </Badge>
                </div>
              )
            )}
          </div>

          <div className={styles.toolbarRight}>
            <div className={styles.viewModeToggle}>
              <button
                type="button"
                className={cn(styles.viewModeBtn, viewMode === 'grid' && styles.active)}
                onClick={() => handleSetViewMode('grid')}
                title="Cards Grid View"
                aria-label="Cards Grid View"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                className={cn(styles.viewModeBtn, viewMode === 'list' && styles.active)}
                onClick={() => handleSetViewMode('list')}
                title="Compact List View"
                aria-label="Compact List View"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => performSearch(localInput, 'chats')}
          >
            <RotateCcw size={14} /> Retry
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading && (
        <div className={styles.skeletonGrid}>
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} height="130px" radius="md" />
          ))}
        </div>
      )}

      {/* Empty State: No chats exist at all */}
      {!isLoading && !isSearchActive && allChats.length === 0 && (
        <EmptyState
          icon={<MessageSquare size={36} />}
          title="No conversations yet"
          description="Start a new chat to begin exploring with NexAI."
          action={
            <Button variant="primary" size="sm" onClick={() => navigate(ROUTES.CHAT)}>
              Start New Chat
            </Button>
          }
        />
      )}

      {/* Empty State: Search produced no results */}
      {!isLoading && isSearchActive && displayedChats.length === 0 && !error && (
        <EmptyState
          icon={<Search size={36} />}
          title={`No conversations found for "${debouncedInput}"`}
          description="Try searching with different keywords, check for typos, or browse all conversations."
          action={
            <Button variant="secondary" size="sm" onClick={handleClear}>
              Clear Search
            </Button>
          }
        />
      )}

      {/* Render Conversations in Cards (Grid) or List View */}
      {!isLoading && displayedChats.length > 0 && (
        <div>
          {viewMode === 'grid' ? (
            /* CARDS GRID VIEW */
            <div className={styles.cardsGrid}>
              {displayedChats.map((chat) => {
                const chatId = chat._id || chat.chatId;
                const isSelected = selectedChatIds.includes(chatId);
                const isPinned = pinnedChatIds.includes(chatId);

                return (
                  <div
                    key={chatId}
                    className={cn(styles.cardItem, isSelected && styles.selected)}
                    onClick={() => handleChatNavigate(chat)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleChatNavigate(chat);
                    }}
                  >
                    <div>
                      {/* Card Top: Custom Checkbox, Status Badges & 3-Dots Dropdown */}
                      <div className={styles.cardTop}>
                        <div className={styles.cardTopLeft}>
                          <CustomCheckbox
                            checked={isSelected}
                            onChange={() => handleToggleSelectOne(chatId)}
                            ariaLabel={`Select chat ${chat.title}`}
                          />
                          {chat.matchType === 'message' && (
                            <Badge tone="neutral">Message Match</Badge>
                          )}
                          {isPinned && (
                            <span className={styles.pinnedIndicator}>
                              <Pin size={11} /> Pinned
                            </span>
                          )}
                        </div>

                        <div onClick={(e) => e.stopPropagation()}>
                          <Dropdown
                            portal
                            align="right"
                            trigger={
                              <button
                                type="button"
                                className={styles.kebabBtn}
                                title="Conversation options"
                                aria-label="Conversation options"
                              >
                                <MoreVertical size={16} />
                              </button>
                            }
                            items={[
                              {
                                label: isPinned ? 'Unpin Conversation' : 'Pin to Top',
                                icon: <Pin size={14} />,
                                onClick: () => togglePin(chatId),
                              },
                              {
                                label: 'Rename Title',
                                icon: <Pencil size={14} />,
                                onClick: () => handleStartRename(chat),
                              },
                              { divider: true },
                              {
                                label: 'Delete Conversation',
                                icon: <Trash2 size={14} />,
                                danger: true,
                                onClick: () => handleStartDelete(chat),
                              },
                            ]}
                          />
                        </div>
                      </div>

                      {/* Card Title */}
                      <div className={styles.cardTitleArea}>
                        <h4 className={styles.cardTitle}>
                          <HighlightedText text={chat.title || 'Untitled Chat'} query={debouncedInput} />
                        </h4>
                      </div>

                      {/* Snippet / Description */}
                      <p className={styles.cardSnippet}>
                        {chat.snippet ? (
                          <HighlightedText text={chat.snippet} query={debouncedInput} />
                        ) : (
                          'Click to resume this conversation and view discussion history.'
                        )}
                      </p>
                    </div>

                    {/* Card Footer */}
                    <div className={styles.cardFooter}>
                      <span>
                        {new Date(chat.updatedAt || chat.createdAt || Date.now()).toLocaleDateString(
                          undefined,
                          { month: 'short', day: 'numeric', year: 'numeric' },
                        )}
                      </span>
                      <span className={styles.resumeLink}>
                        Resume <ArrowRight size={12} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* COMPACT LIST VIEW */
            <div className={styles.listView}>
              {displayedChats.map((chat) => {
                const chatId = chat._id || chat.chatId;
                const isSelected = selectedChatIds.includes(chatId);
                const isPinned = pinnedChatIds.includes(chatId);

                return (
                  <div
                    key={chatId}
                    className={cn(styles.listRow, isSelected && styles.selected)}
                    onClick={() => handleChatNavigate(chat)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleChatNavigate(chat);
                    }}
                  >
                    <div className={styles.listRowLeft}>
                      <CustomCheckbox
                        checked={isSelected}
                        onChange={() => handleToggleSelectOne(chatId)}
                        ariaLabel={`Select chat ${chat.title}`}
                      />

                      <div className={styles.listRowMain}>
                        <div className={styles.listRowTitleRow}>
                          <span className={styles.listRowTitle}>
                            <HighlightedText
                              text={chat.title || 'Untitled Chat'}
                              query={debouncedInput}
                            />
                          </span>
                          {chat.matchType === 'message' && (
                            <Badge tone="neutral">Message Match</Badge>
                          )}
                          {isPinned && (
                            <span className={styles.pinnedIndicator}>
                              <Pin size={11} /> Pinned
                            </span>
                          )}
                        </div>

                        <span className={styles.listRowSnippet}>
                          {chat.snippet ? (
                            <HighlightedText text={chat.snippet} query={debouncedInput} />
                          ) : (
                            'Click to resume conversation'
                          )}
                        </span>
                      </div>
                    </div>

                    <div className={styles.listRowRight}>
                      <span className={styles.listRowDate}>
                        {new Date(chat.updatedAt || chat.createdAt || Date.now()).toLocaleDateString(
                          undefined,
                          { month: 'short', day: 'numeric' },
                        )}
                      </span>

                      <div onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          portal
                          align="right"
                          trigger={
                            <button
                              type="button"
                              className={styles.kebabBtn}
                              title="Conversation options"
                              aria-label="Conversation options"
                            >
                              <MoreVertical size={16} />
                            </button>
                          }
                          items={[
                            {
                              label: isPinned ? 'Unpin Conversation' : 'Pin to Top',
                              icon: <Pin size={14} />,
                              onClick: () => togglePin(chatId),
                            },
                            {
                              label: 'Rename Title',
                              icon: <Pencil size={14} />,
                              onClick: () => handleStartRename(chat),
                            },
                            { divider: true },
                            {
                              label: 'Delete Conversation',
                              icon: <Trash2 size={14} />,
                              danger: true,
                              onClick: () => handleStartDelete(chat),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Rename Conversation Modal */}
      <Modal
        open={Boolean(chatToRename)}
        onClose={() => setChatToRename(null)}
        title="Rename Conversation"
        footer={
          <>
            <Button variant="ghost" onClick={() => setChatToRename(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmRename}
              disabled={!renameTitle.trim() || isRenaming}
              loading={isRenaming}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirmRename();
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}
        >
          <Input
            label="Conversation Title"
            value={renameTitle}
            onChange={(e) => setRenameTitle(e.target.value)}
            placeholder="Enter new conversation title..."
            autoFocus
          />
        </form>
      </Modal>

      {/* Single Chat Delete Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(chatToDelete)}
        title="Delete Conversation"
        description={`Are you sure you want to delete "${chatToDelete?.title || 'this conversation'}"? All messages and history in this chat will be permanently removed.`}
        confirmLabel="Delete"
        tone="danger"
        loading={isDeletingSingle}
        onConfirm={handleConfirmSingleDelete}
        onCancel={() => setChatToDelete(null)}
      />

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmDialog
        open={isBulkDeleteModalOpen}
        title="Delete Multiple Conversations"
        description={`Are you sure you want to delete ${selectedChatIds.length} selected conversations? This action cannot be undone and will permanently remove all message history.`}
        confirmLabel={`Delete ${selectedChatIds.length} Chats`}
        tone="danger"
        loading={isDeletingBulk}
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setIsBulkDeleteModalOpen(false)}
      />
    </div>
  );
}

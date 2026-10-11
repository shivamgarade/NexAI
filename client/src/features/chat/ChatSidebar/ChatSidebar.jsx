import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Plus, MessageSquare, MoreVertical, Edit2, Trash2, Check, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Dropdown } from '@/components/ui/Dropdown';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { useChatStore } from '@/store/chatStore';
import { cn } from '@/lib/utils/cn';
import styles from './ChatSidebar.module.scss';

function formatChatDate(timestamp) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export function ChatSidebar({ onSelectChat, className }) {
  const {
    chats,
    activeChatId,
    isLoadingChats,
    createChat,
    updateChatTitle,
    deleteChat,
  } = useChatStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [deletingChatId, setDeletingChatId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase();
    return chats.filter((c) => c.title?.toLowerCase().includes(query));
  }, [chats, searchQuery]);

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
    await deleteChat(deletingChatId);
    setIsDeleting(false);
    setDeletingChatId(null);
  };

  const handleNewChat = async () => {
    const newChat = await createChat('New Chat');
    if (newChat && onSelectChat) {
      onSelectChat(newChat._id);
    }
  };

  return (
    <aside className={cn(styles.sidebar, className)} aria-label="Chat conversations">
      <div className={styles.header}>
        <div className={styles.actionRow}>
          <Button
            variant="primary"
            leftIcon={<Plus size={16} />}
            fullWidth
            onClick={handleNewChat}
            className={styles.newChatButton}
          >
            New Chat
          </Button>
        </div>

        {chats.length > 3 && (
          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Filter chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              aria-label="Filter conversations by title"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={styles.clearSearch}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className={styles.chatList}>

        {isLoadingChats ? (
          <div className={styles.skeletonList}>
            <Skeleton height="44px" radius="md" />
            <Skeleton height="44px" radius="md" />
            <Skeleton height="44px" radius="md" />
          </div>
        ) : chats.length === 0 ? (
          <div className={styles.emptyState}>
            <MessageSquare size={24} className={styles.emptyIcon} />
            <p className={styles.emptyTitle}>No conversations yet</p>
            <p className={styles.emptySubtitle}>Start a chat to get started</p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className={styles.noMatch}>
            <p>No chats matching &quot;{searchQuery}&quot;</p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = chat._id === activeChatId;
            const isEditing = chat._id === editingChatId;
            const chatDate = formatChatDate(chat.updatedAt || chat.createdAt);

            return (
              <div
                key={chat._id}
                className={cn(styles.chatItem, isActive && styles.active)}
                onClick={() => {
                  if (!isEditing && onSelectChat) {
                    onSelectChat(chat._id);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isEditing && onSelectChat) {
                    onSelectChat(chat._id);
                  }
                }}
              >
                <MessageSquare size={15} className={styles.itemIcon} />

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
                      className={styles.actionBtn}
                      onClick={(e) => handleSaveRename(chat._id, e)}
                      aria-label="Save title"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      className={styles.actionBtn}
                      onClick={handleCancelRename}
                      aria-label="Cancel rename"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className={styles.titleCol}>
                      <span className={styles.chatTitle} title={chat.title}>
                        {chat.title}
                      </span>
                      {chatDate && <span className={styles.chatDate}>{chatDate}</span>}
                    </div>

                    <div className={styles.itemActions} onClick={(e) => e.stopPropagation()}>
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
                            label: 'Rename',
                            icon: <Edit2 size={14} />,
                            onClick: (e) => handleStartRename(chat, e),
                          },
                          { divider: true },
                          {
                            label: 'Delete',
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onClick: (e) => handleStartDelete(chat._id, e),
                          },
                        ]}
                        align="flyout"
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })
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
    </aside>
  );
}

ChatSidebar.propTypes = {
  onSelectChat: PropTypes.func,
  className: PropTypes.string,
};

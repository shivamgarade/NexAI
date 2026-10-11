import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  MessageSquare,
  Bookmark,
  FileText,
  Terminal,
  Wallet,
  Settings,
  Shield,
  SunMoon,
  FolderGit2,
  Mic,
  Loader2,
} from 'lucide-react';
import { useHotkey } from '@/hooks/useHotkey';
import { useDebounce } from '@/hooks/useDebounce';
import { useUiStore } from '@/store/uiStore';
import { searchApi } from '@/lib/api/search.api.js';
import { Kbd } from '@/components/ui/Kbd';
import { ROUTES } from '@/constants/routes';
import { cn } from '@/lib/utils/cn';
import styles from './CommandPalette.module.scss';

export function CommandPalette({ defaultOpen = false } = {}) {
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchResults, setSearchResults] = useState({ library: [], prompts: [], chats: [] });
  const [isSearching, setIsSearching] = useState(false);

  const navigate = useNavigate();
  const toggleTheme = useUiStore((state) => state.toggleTheme);
  const inputRef = useRef(null);
  const itemRefs = useRef([]);

  const debouncedQuery = useDebounce(query, 250);

  // Global hotkeys
  useHotkey('ctrl+k', () => setOpen((prev) => !prev));
  useHotkey('cmd+k', () => setOpen((prev) => !prev));
  useHotkey('escape', () => setOpen(false), { disabled: !open });

  const navigationCommands = useMemo(
    () => [
      {
        id: 'nav-chat',
        label: 'New Chat',
        snippet: 'Start a new streaming conversation',
        category: 'Navigation',
        icon: <MessageSquare size={16} />,
        perform: () => navigate(ROUTES.CHAT),
      },
      {
        id: 'nav-library',
        label: 'Personal Library',
        snippet: 'Browse notes, links, files, and documents',
        category: 'Navigation',
        icon: <Bookmark size={16} />,
        perform: () => navigate(ROUTES.LIBRARY),
      },
      {
        id: 'nav-documents',
        label: 'Document Generator',
        snippet: 'Draft structured specifications and resumes',
        category: 'Navigation',
        icon: <FileText size={16} />,
        perform: () => navigate(ROUTES.DOCUMENTS),
      },
      {
        id: 'nav-interview',
        label: 'AI Mock Interview',
        snippet: 'Simulate viva defense and technical interviews',
        category: 'Navigation',
        icon: <Mic size={16} />,
        perform: () => navigate(ROUTES.INTERVIEW),
      },
      {
        id: 'nav-projects',
        label: 'Project Workspaces',
        snippet: 'Grounded custom instructions and source files',
        category: 'Navigation',
        icon: <FolderGit2 size={16} />,
        perform: () => navigate(ROUTES.PROJECTS),
      },
      {
        id: 'nav-prompts',
        label: 'Prompt Vault',
        snippet: 'Reusable prompt templates with variable injection',
        category: 'Navigation',
        icon: <Terminal size={16} />,
        perform: () => navigate(ROUTES.PROMPTS),
      },
      {
        id: 'nav-search',
        label: 'Unified Search',
        snippet: 'Deep hybrid search across entire workspace',
        category: 'Navigation',
        icon: <Search size={16} />,
        perform: () => navigate(ROUTES.SEARCH),
      },
      {
        id: 'nav-wallet',
        label: 'Wallet & Billing',
        snippet: 'Token usage ledger and credit recharge',
        category: 'Navigation',
        icon: <Wallet size={16} />,
        perform: () => navigate(ROUTES.WALLET),
      },
      {
        id: 'nav-settings',
        label: 'Settings',
        snippet: 'Theme, default model, and preferences',
        category: 'Navigation',
        icon: <Settings size={16} />,
        perform: () => navigate(ROUTES.SETTINGS),
      },
      {
        id: 'nav-admin',
        label: 'Admin Dashboard',
        snippet: 'System analytics and error logs (admin only)',
        category: 'Navigation',
        icon: <Shield size={16} />,
        perform: () => navigate(ROUTES.ADMIN),
      },
      {
        id: 'pref-theme',
        label: 'Toggle Theme',
        snippet: 'Switch between dark and light appearance',
        category: 'Preferences',
        icon: <SunMoon size={16} />,
        perform: () => toggleTheme(),
      },
    ],
    [navigate, toggleTheme],
  );

  // Live backend search on debounced query
  useEffect(() => {
    let isCancelled = false;

    if (!debouncedQuery.trim()) {
      setSearchResults({ library: [], prompts: [], chats: [] });
      setIsSearching(false);
      return;
    }

    async function fetchSearch() {
      setIsSearching(true);
      try {
        const res = await searchApi.unifiedSearch({ q: debouncedQuery.trim(), limit: 4 });
        if (!isCancelled) {
          const data = res.data?.data || res.data || {};
          setSearchResults({
            library: data.library || [],
            prompts: data.prompts || [],
            chats: data.chats || [],
          });
        }
      } catch {
        if (!isCancelled) {
          setSearchResults({ library: [], prompts: [], chats: [] });
        }
      } finally {
        if (!isCancelled) {
          setIsSearching(false);
        }
      }
    }

    fetchSearch();

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery]);

  // Combine filtered navigation items with live search items
  const combinedItems = useMemo(() => {
    const qLower = query.toLowerCase().trim();

    // 1. Filtered Navigation Commands
    const navMatches = navigationCommands.filter(
      (cmd) =>
        !qLower ||
        cmd.label.toLowerCase().includes(qLower) ||
        cmd.snippet?.toLowerCase().includes(qLower),
    );

    if (!qLower) {
      return navMatches;
    }

    // 2. Chat Conversation Matches
    const chatMatches = (searchResults.chats || []).map((chat) => ({
      id: `chat-${chat.chatId || chat._id}`,
      label: chat.title || 'Untitled Conversation',
      snippet: chat.snippet || 'Chat conversation',
      category: 'Chats',
      icon: <MessageSquare size={16} />,
      perform: () => navigate(`/chat/${chat.chatId || chat._id}`),
    }));

    // 3. Prompt Template Matches
    const promptMatches = (searchResults.prompts || []).map((prompt) => ({
      id: `prompt-${prompt._id}`,
      label: prompt.title,
      snippet: prompt.description || prompt.template,
      category: 'Prompts',
      icon: <Terminal size={16} />,
      perform: () => navigate(ROUTES.PROMPTS),
    }));

    // 4. Library Matches
    const libraryMatches = (searchResults.library || []).map((item) => {
      let tab = 'all';
      if (item.type === 'note' || item.type === 'link') tab = 'notes_links';
      else if (item.type === 'document') tab = 'documents';
      else if (item.type === 'file') tab = 'files';
      else if (item.type === 'interview') tab = 'interviews';

      return {
        id: `lib-${item._id}`,
        label: item.title,
        snippet: item.summary || item.content?.slice(0, 100),
        category: 'Library',
        icon: <Bookmark size={16} />,
        perform: () => navigate(`${ROUTES.LIBRARY}?tab=${tab}`),
      };
    });

    return [...navMatches, ...chatMatches, ...promptMatches, ...libraryMatches];
  }, [query, navigationCommands, searchResults, navigate]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setSearchResults({ library: [], prompts: [], chats: [] });
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, searchResults]);

  // Ensure active element is scrolled into view
  useEffect(() => {
    if (itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView?.({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [selectedIndex]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % (combinedItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + combinedItems.length) % (combinedItems.length || 1),
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (combinedItems[selectedIndex]) {
        combinedItems[selectedIndex].perform();
        setOpen(false);
      }
    }
  };

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div className={styles.palette}>
        <div className={styles.searchHeader}>
          {isSearching ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search across chats, prompts & library..."
            className={styles.input}
          />
          <Kbd>Esc</Kbd>
        </div>

        <div className={styles.list} role="listbox">
          {combinedItems.length === 0 ? (
            <div className={styles.empty}>
              {isSearching ? 'Searching...' : `No matching commands or results for "${query}"`}
            </div>
          ) : (
            combinedItems.map((cmd, index) => {
              const isSelected = index === selectedIndex;
              const prevItem = combinedItems[index - 1];
              const showCategoryHeader = !prevItem || prevItem.category !== cmd.category;

              return (
                <div key={cmd.id}>
                  {showCategoryHeader && (
                    <div className={styles.categoryHeader}>{cmd.category}</div>
                  )}
                  <div
                    ref={(el) => (itemRefs.current[index] = el)}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(styles.item, isSelected && styles.active)}
                    onClick={() => {
                      cmd.perform();
                      setOpen(false);
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <div className={styles.itemLeft}>
                      <span className={styles.itemIconWrapper}>{cmd.icon}</span>
                      <div className={styles.itemText}>
                        <span className={styles.itemLabel}>{cmd.label}</span>
                        {cmd.snippet && (
                          <span className={styles.itemSnippet}>{cmd.snippet}</span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <span className={styles.itemEnterHint}>
                        <span className={styles.enterLabel}>Open</span>
                        <Kbd>↵</Kbd>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <span>Unified Search</span>
          </div>
          <div className={styles.footerRight}>
            <span className={styles.hint}>
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> Navigate
            </span>
            <span className={styles.hint}>
              <Kbd>↵</Kbd> Select
            </span>
            <span className={styles.hint}>
              <Kbd>Esc</Kbd> Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommandPalette;


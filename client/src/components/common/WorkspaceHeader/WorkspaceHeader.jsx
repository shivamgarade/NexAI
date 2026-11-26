import PropTypes from 'prop-types';
import { Menu, Search, X } from 'lucide-react';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { useUiStore } from '@/store/uiStore';
import { cn } from '@/lib/utils/cn';
import styles from './WorkspaceHeader.module.scss';

/**
 * Standard Higher-Order Workspace Header
 * Provides a locked, permanent layout skeleton for all primary app views:
 * Row 1: Mobile menu toggle + Area Title Badge + Navigation Segmented Tabs (Left) | Search + Primary Actions (Right)
 * Row 2 (Optional): Stable sub-filter pills (Category chips, status subtabs, tag indicators)
 */
export function WorkspaceHeader({
  titleIcon,
  titleText,
  tabs = [],
  activeTab,
  onTabChange,
  search,
  onSearchChange,
  onSearchClear,
  searchPlaceholder = 'Search...',
  actions,
  subFilters,
  className,
}) {
  const setDrawerOpen = useUiStore((state) => state.setDrawerOpen);

  return (
    <header className={cn(styles.stickyHeader, className)}>
      <div className={styles.commandRow}>
        {/* Left: Mobile Drawer Button + Area Title Badge + Segmented Navigation Tabs */}
        <div className={styles.navLeft}>
          <div className={styles.mobileMenuBtn}>
            <IconButton
              icon={<Menu size={18} />}
              label="Open menu"
              size="sm"
              variant="ghost"
              onClick={() => setDrawerOpen(true)}
            />
          </div>

          {titleText && (
            <div className={styles.titleBadge}>
              {titleIcon && <span className={styles.titleIcon}>{titleIcon}</span>}
              <span className={styles.titleText}>{titleText}</span>
            </div>
          )}

          {tabs.length > 0 && (
            <div className={styles.segmentedTabs} role="tablist">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={cn(styles.segmentedTabBtn, isActive && styles.segmentedTabActive)}
                    onClick={() => onTabChange?.(tab.id)}
                  >
                    {tab.icon && <span className={styles.tabIcon}>{tab.icon}</span>}
                    <span className={styles.tabLabel}>{tab.label}</span>
                    {typeof tab.count === 'number' && tab.count > 0 && (
                      <span className={styles.tabBadge}>{tab.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Search Box + Action Buttons */}
        <div className={styles.actionsGroup}>
          {onSearchChange && (
            <div className={styles.searchWrapper}>
              <Input
                value={search || ''}
                onChange={onSearchChange}
                placeholder={searchPlaceholder}
                size="sm"
                leftIcon={<Search size={14} />}
                rightIcon={
                  search && onSearchClear ? (
                    <X
                      size={13}
                      className={styles.clearIcon}
                      onClick={onSearchClear}
                      style={{ cursor: 'pointer' }}
                    />
                  ) : null
                }
              />
            </div>
          )}

          {actions}
        </div>
      </div>

      {/* Row 2: Stable Sub-Filter Strip (Categories, Subtabs, Status pills) */}
      {subFilters && <div className={styles.subFilterRow}>{subFilters}</div>}
    </header>
  );
}

WorkspaceHeader.propTypes = {
  titleIcon: PropTypes.node,
  titleText: PropTypes.string,
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.node,
      count: PropTypes.number,
    }),
  ),
  activeTab: PropTypes.string,
  onTabChange: PropTypes.func,
  search: PropTypes.string,
  onSearchChange: PropTypes.func,
  onSearchClear: PropTypes.func,
  searchPlaceholder: PropTypes.string,
  actions: PropTypes.node,
  subFilters: PropTypes.node,
  className: PropTypes.string,
};

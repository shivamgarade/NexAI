import { useState } from 'react';
import {
  Sparkles,
  Search,
  Bell,
  CheckCircle,
  AlertCircle,
  Info,
  Settings,
  MoreVertical,
} from 'lucide-react';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Drawer } from '@/components/ui/Drawer';
import { Badge } from '@/components/ui/Badge';
import { Tag } from '@/components/ui/Tag';
import { TagInput } from '@/components/ui/TagInput';
import { Tabs } from '@/components/ui/Tabs';
import { Dropdown } from '@/components/ui/Dropdown';
import { Tooltip } from '@/components/ui/Tooltip';
import { Spinner } from '@/components/ui/Spinner';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { Switch } from '@/components/ui/Switch';
import { Kbd } from '@/components/ui/Kbd';
import { ThinkingIndicator } from '@/components/ui/ThinkingIndicator';
import { toast } from '@/store/uiStore';
import { useTheme } from '@/hooks/useTheme';

export default function DesignSystemPage() {
  const { isDark, toggleTheme } = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tags, setTags] = useState(['react', 'design-tokens', 'saas']);
  const [tab, setTab] = useState('tab1');
  const [switchVal, setSwitchVal] = useState(true);
  const [selectVal, setSelectVal] = useState('flash');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>
      <PageHeader
        title="NexAI Design System Gallery"
        description="Comprehensive verification showcase for all 20 UI component primitives in dark and light modes."
        actions={
          <Button variant="secondary" onClick={toggleTheme}>
            Toggle Theme ({isDark ? 'Dark' : 'Light'})
          </Button>
        }
      />

      {/* 1. Buttons & IconButtons */}
      <Card padding="md">
        <Card.Header>
          <h3>1 &amp; 2. Buttons and Icon Buttons</h3>
        </Card.Header>
        <Card.Body style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" loading>
              Loading
            </Button>
            <Button variant="primary" leftIcon={<Sparkles size={16} />}>
              With Icon
            </Button>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <IconButton icon={<Bell size={18} />} label="Notification" />
            <IconButton icon={<Settings size={18} />} label="Settings" variant="secondary" />
          </div>
        </Card.Body>
      </Card>

      {/* 3, 4, 5. Inputs, Textarea, Select */}
      <Card padding="md">
        <Card.Header>
          <h3>3, 4 &amp; 5. Form Elements (Input, Textarea, Select)</h3>
        </Card.Header>
        <Card.Body
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <Input
            label="Sample Input"
            placeholder="Type something..."
            leftIcon={<Search size={16} />}
            hint="Supports assistive hints"
          />
          <Input label="Input with Error" defaultValue="Invalid value" error="Invalid format" />
          <Select
            label="Select Dropdown"
            value={selectVal}
            onChange={(e) => setSelectVal(e.target.value)}
            options={[
              { value: 'flash', label: 'Gemini 1.5 Flash' },
              { value: 'pro', label: 'Gemini 1.5 Pro' },
            ]}
          />
          <div style={{ gridColumn: '1 / -1' }}>
            <Textarea
              label="Auto-resizable Textarea"
              autoResize
              placeholder="Expandable input..."
            />
          </div>
        </Card.Body>
      </Card>

      {/* 6, 7, 8. Card, Modal, Drawer */}
      <Card padding="md">
        <Card.Header>
          <h3>6, 7 &amp; 8. Overlays &amp; Containers (Card, Modal, Drawer)</h3>
        </Card.Header>
        <Card.Body style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open Sample Modal
          </Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
            Open Sample Drawer
          </Button>

          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Design System Modal"
            footer={
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Got it
              </Button>
            }
          >
            <p
              style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-relaxed)' }}
            >
              Accessible modal dialog with backdrop blur, focus trap, and Escape key dismissal.
            </p>
          </Modal>

          <Drawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            title="Slide Drawer"
            side="right"
          >
            <p
              style={{ color: 'var(--color-text-secondary)', lineHeight: 'var(--leading-relaxed)' }}
            >
              Slide-in drawer for auxiliary panels and responsive navigation.
            </p>
          </Drawer>
        </Card.Body>
      </Card>

      {/* 9, 10, 11. Badge, Tag, TagInput */}
      <Card padding="md">
        <Card.Header>
          <h3>9, 10 &amp; 11. Badges &amp; Tags</h3>
        </Card.Header>
        <Card.Body style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Badge tone="neutral">Neutral</Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="warning">Warning</Badge>
            <Badge tone="danger">Danger</Badge>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <Tag label="Design" />
            <Tag label="Removable Tag" removable onRemove={() => toast.info('Tag removed')} />
          </div>
          <TagInput tags={tags} onChange={setTags} placeholder="Add tag..." />
        </Card.Body>
      </Card>

      {/* 12, 13, 14, 15. Tabs, Dropdown, Tooltip, Toast */}
      <Card padding="md">
        <Card.Header>
          <h3>12, 13, 14 &amp; 15. Tabs, Dropdown, Tooltip &amp; Toasts</h3>
        </Card.Header>
        <Card.Body style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { id: 'tab1', label: 'First Tab' },
              { id: 'tab2', label: 'Second Tab' },
              { id: 'tab3', label: 'Third Tab' },
            ]}
          />

          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <Dropdown
              trigger={
                <Button variant="secondary" rightIcon={<MoreVertical size={16} />}>
                  Open Dropdown
                </Button>
              }
              items={[
                { label: 'Action One', onClick: () => toast.info('Action One clicked') },
                { label: 'Action Two', onClick: () => toast.info('Action Two clicked') },
                { divider: true },
                { label: 'Destructive', danger: true, onClick: () => toast.error('Deleted item') },
              ]}
            />

            <Tooltip content="Helpful tooltip text" side="top">
              <Button variant="ghost">Hover me for Tooltip</Button>
            </Tooltip>

            <Button
              variant="secondary"
              leftIcon={<CheckCircle size={16} color="var(--color-success)" />}
              onClick={() => toast.success('Success notification triggered!')}
            >
              Toast Success
            </Button>
            <Button
              variant="secondary"
              leftIcon={<AlertCircle size={16} color="var(--color-danger)" />}
              onClick={() => toast.error('Error notification triggered!')}
            >
              Toast Error
            </Button>
            <Button
              variant="secondary"
              leftIcon={<Info size={16} color="var(--color-info)" />}
              onClick={() => toast.info('Info notification triggered!')}
            >
              Toast Info
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* 16, 17, 18, 19, 20. Spinner, Skeleton, EmptyState, Avatar, Switch, Kbd */}
      <Card padding="md">
        <Card.Header>
          <h3>16, 17, 18, 19 &amp; 20. Feedback, State &amp; Display</h3>
        </Card.Header>
        <Card.Body style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
            <Skeleton width={120} height={32} />
            <Skeleton width={40} height={40} radius="full" />
            <Avatar name="Shivam Garade" size="md" />
            <Switch checked={switchVal} onChange={setSwitchVal} label="Accessible Switch" />
            <div>
              Shortcut: <Kbd>Ctrl K</Kbd> or <Kbd>⌘K</Kbd>
            </div>
          </div>

          <EmptyState
            icon={<Sparkles size={28} />}
            title="EmptyState Demonstration"
            description="Clear visual communication for zero-state screens with actionable next steps."
            action={<Button size="sm">Primary Action</Button>}
          />
        </Card.Body>
      </Card>

      {/* 21. AI Thinking & Reasoning Indicators */}
      <Card padding="md">
        <Card.Header>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <h3>21. AI Thinking &amp; Reasoning Indicators</h3>
            <Badge tone="accent">Brand AI Animations</Badge>
          </div>
        </Card.Header>
        <Card.Body style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {/* Brand "N" Logo Thinking Animation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              NexAI Brand &quot;N&quot; Logo Animation (Default Streaming / Thinking State)
            </span>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-6)',
                alignItems: 'center',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ThinkingIndicator variant="logo" size="sm" />
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Small (26px)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ThinkingIndicator variant="logo" size="md" />
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Medium (36px)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ThinkingIndicator variant="logo" size="lg" />
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Large (52px)</span>
              </div>
            </div>
          </div>

          {/* Orbital Dots Thinking Animation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Orbital 3-Dot Constellation Animation (Alternative Variant)
            </span>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-6)',
                alignItems: 'center',
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ThinkingIndicator variant="dots" size="sm" />
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Small (26px)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ThinkingIndicator variant="dots" size="md" />
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Medium (36px)</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ThinkingIndicator variant="dots" size="lg" />
                <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Large (52px)</span>
              </div>
            </div>
          </div>

          {/* Simulated Chat Message Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Live Message Stream Simulation
            </span>
            <div
              style={{
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-app)',
                border: '1px solid var(--color-border)',
                display: 'flex',
                gap: 'var(--space-3)',
                alignItems: 'flex-start',
              }}
            >
              <ThinkingIndicator variant="logo" size="sm" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text-muted)' }}>
                    NexAI
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Just now</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
                  <span>Synthesizing response...</span>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '2px',
                      height: '14px',
                      backgroundColor: 'var(--color-accent)',
                      animation: 'blink 1s infinite steps(2, start)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}

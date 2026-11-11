import { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Play,
  Edit2,
  Trash2,
  Sparkles,
  Loader2,
  MessageSquare,
  BookOpen,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { ScheduleFormModal } from './ScheduleFormModal';
import { useScheduleStore } from '@/store/scheduleStore';
import { cn } from '@/lib/utils/cn';
import styles from './SchedulesTab.module.scss';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatTiming(schedule) {
  const time = schedule.runTime || '09:00';
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const timeFormatted = `${h}:${mStr || '00'} ${ampm}`;

  if (schedule.frequency === 'daily') {
    return `Daily around ${timeFormatted}`;
  }
  if (schedule.frequency === 'weekly') {
    const days = (schedule.weeklyDays || []).map((d) => DAY_LABELS[d]).join(', ');
    return `Weekly on ${days || 'weekdays'} around ${timeFormatted}`;
  }
  return `Once around ${timeFormatted}`;
}

export function SchedulesTab() {
  const {
    schedules,
    isLoading,
    fetchSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    toggleSchedule,
    runScheduleNow,
    runningScheduleIds,
    isSaving,
  } = useScheduleStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [deletingSchedule, setDeletingSchedule] = useState(null);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setIsFormOpen(true);
  };

  const handleCreateWithGemini = () => {
    setEditingSchedule({
      title: 'Daily Workspace & Tech Digest',
      frequency: 'daily',
      weeklyDays: [1, 2, 3, 4, 5],
      runTime: '09:00',
      instructions:
        'Search the web for top trending developer news and AI updates, and summarize the top 3 actionable breakthroughs in clean bullet points.',
      deliveryTarget: 'chat',
      model: 'flash',
    });
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    try {
      if (editingSchedule?._id) {
        await updateSchedule(editingSchedule._id, formData);
      } else {
        await createSchedule(formData);
      }
      setIsFormOpen(false);
      setEditingSchedule(null);
    } catch {
      // Handled in store
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSchedule) return;
    try {
      await deleteSchedule(deletingSchedule._id);
      setDeletingSchedule(null);
    } catch {
      // Handled in store
    }
  };

  return (
    <div className={styles.container}>
      {/* Google Gemini Schedules Header */}
      <div className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>Schedules</h1>
          <p className={styles.subtitle}>
            Get proactive help with tasks scheduled to run on repeat, respond to events, or continuously monitor and react.{' '}
            <span className={styles.learnMore}>Learn more</span>
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.geminiPillBtn}
            onClick={handleCreateWithGemini}
          >
            <Sparkles size={15} />
            <span>Create with Gemini</span>
          </button>
          <button
            type="button"
            className={styles.manualPillBtn}
            onClick={handleOpenCreate}
          >
            <Plus size={15} />
            <span>Create manually</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading && schedules.length === 0 ? (
        <div className={styles.skeletonGrid}>
          <Skeleton height={200} />
          <Skeleton height={200} />
        </div>
      ) : schedules.length === 0 ? (
        <div className={styles.emptyContainer}>
          <h2 className={styles.emptyTitle}>Add your first schedule</h2>
          <p className={styles.emptySubtitle}>
            Schedules created from your tasks appear automatically
          </p>
          <button
            type="button"
            className={styles.emptyActionBtn}
            onClick={handleOpenCreate}
          >
            <Plus size={15} />
            <span>Create schedule</span>
          </button>
        </div>
      ) : (
        <div className={styles.grid}>
          {schedules.map((schedule) => {
            const isRunning = runningScheduleIds.includes(schedule._id);
            return (
              <Card
                key={schedule._id}
                className={cn(styles.card, !schedule.isActive && styles.cardInactive)}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.titleCol}>
                    <div className={styles.titleRow}>
                      <Clock size={16} className={styles.clockIcon} />
                      <h3 className={styles.scheduleTitle}>{schedule.title}</h3>
                    </div>
                    <span className={styles.timingBadge}>{formatTiming(schedule)}</span>
                  </div>

                  <div className={styles.toggleWrapper}>
                    <Switch
                      checked={schedule.isActive}
                      onChange={() => toggleSchedule(schedule._id)}
                      title={schedule.isActive ? 'Active (Click to pause)' : 'Paused (Click to activate)'}
                    />
                  </div>
                </div>

                <p className={styles.instructionsText}>{schedule.instructions}</p>

                {schedule.lastRunSummary && (
                  <div className={styles.summaryBox}>
                    <span className={styles.summaryLabel}>Last Run Output</span>
                    <p className={styles.summarySnippet}>{schedule.lastRunSummary}</p>
                  </div>
                )}

                <div className={styles.cardFooter}>
                  <div className={styles.telemetryRow}>
                    <span className={styles.targetBadge}>
                      {schedule.deliveryTarget === 'library' ? (
                        <>
                          <BookOpen size={12} />
                          <span>Library</span>
                        </>
                      ) : (
                        <>
                          <MessageSquare size={12} />
                          <span>Chat</span>
                        </>
                      )}
                    </span>

                    <span className={styles.lastRunText}>
                      {schedule.lastRunAt
                        ? `Ran ${new Date(schedule.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'Never run'}
                    </span>
                  </div>

                  <div className={styles.actionsGroup}>
                    <button
                      type="button"
                      className={styles.runNowBtn}
                      onClick={() => runScheduleNow(schedule._id)}
                      disabled={isRunning}
                      title="Trigger schedule immediately for live testing"
                    >
                      {isRunning ? (
                        <>
                          <Loader2 size={12} className={styles.spinner} />
                          <span>Running...</span>
                        </>
                      ) : (
                        <>
                          <Play size={12} fill="currentColor" />
                          <span>Run Now</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className={styles.iconBtn}
                      onClick={() => {
                        setEditingSchedule(schedule);
                        setIsFormOpen(true);
                      }}
                      title="Edit schedule"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      type="button"
                      className={cn(styles.iconBtn, styles.deleteBtn)}
                      onClick={() => setDeletingSchedule(schedule)}
                      title="Delete schedule"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Modal */}
      <ScheduleFormModal
        open={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingSchedule(null);
        }}
        onSubmit={handleFormSubmit}
        initialSchedule={editingSchedule}
        isSaving={isSaving}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={Boolean(deletingSchedule)}
        title="Delete Schedule?"
        message={`Are you sure you want to delete "${deletingSchedule?.title}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingSchedule(null)}
      />
    </div>
  );
}

import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft, Sparkles, MessageSquare, BookOpen, AlertCircle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils/cn';
import styles from './ScheduleFormModal.module.scss';

const DAYS = [
  { label: 'S', day: 0, title: 'Sunday' },
  { label: 'M', day: 1, title: 'Monday' },
  { label: 'T', day: 2, title: 'Tuesday' },
  { label: 'W', day: 3, title: 'Wednesday' },
  { label: 'T', day: 4, title: 'Thursday' },
  { label: 'F', day: 5, title: 'Friday' },
  { label: 'S', day: 6, title: 'Saturday' },
];

const TIME_OPTIONS = [
  '06:00', '06:15', '06:30', '06:45',
  '07:00', '07:15', '07:30', '07:45',
  '08:00', '08:15', '08:30', '08:45',
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '20:00',
  '21:00', '22:00',
];

function formatTimeLabel(hhmm) {
  const [hStr, mStr] = hhmm.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export function ScheduleFormModal({ open, onClose, onSubmit, initialSchedule = null, isSaving = false }) {
  const [title, setTitle] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [weeklyDays, setWeeklyDays] = useState([1, 2, 3, 4, 5]);
  const [runTime, setRunTime] = useState('09:00');
  const [instructions, setInstructions] = useState('');
  const [deliveryTarget, setDeliveryTarget] = useState('chat');
  const [model, setModel] = useState('flash');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialSchedule) {
      setTitle(initialSchedule.title || '');
      setFrequency(initialSchedule.frequency || 'weekly');
      setWeeklyDays(Array.isArray(initialSchedule.weeklyDays) ? initialSchedule.weeklyDays : [1, 2, 3, 4, 5]);
      setRunTime(initialSchedule.runTime || '09:00');
      setInstructions(initialSchedule.instructions || '');
      setDeliveryTarget(initialSchedule.deliveryTarget || 'chat');
      setModel(initialSchedule.model || 'flash');
    } else {
      setTitle('');
      setFrequency('weekly');
      setWeeklyDays([1, 2, 3, 4, 5]);
      setRunTime('09:00');
      setInstructions('');
      setDeliveryTarget('chat');
      setModel('flash');
    }
    setErrors({});
  }, [initialSchedule, open]);

  const toggleDay = (dayNum) => {
    setWeeklyDays((prev) =>
      prev.includes(dayNum) ? prev.filter((d) => d !== dayNum) : [...prev, dayNum].sort(),
    );
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    const newErrors = {};

    if (!title.trim()) {
      newErrors.title = 'Please enter a schedule name';
    }
    if (!instructions.trim()) {
      newErrors.instructions = 'Please provide instructions for the scheduled task';
    }
    if (frequency === 'weekly' && weeklyDays.length === 0) {
      newErrors.weeklyDays = 'Select at least one day to run';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit({
      title: title.trim(),
      frequency,
      weeklyDays,
      runTime,
      instructions: instructions.trim(),
      deliveryTarget,
      model,
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <div className={styles.container}>
        {/* Top Header matching Screenshot 2: "← Schedules" and "[Create]" */}
        <div className={styles.header}>
          <button type="button" onClick={onClose} className={styles.backBtn} aria-label="Go back">
            <ArrowLeft size={18} />
            <span className={styles.headerTitle}>Schedules</span>
          </button>

          <button
            type="button"
            className={styles.createPillBtn}
            onClick={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : initialSchedule ? 'Save' : 'Create'}
          </button>
        </div>

        {/* Form Body matching Screenshot 2 */}
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldBlock}>
            <input
              type="text"
              className={cn(styles.nameInput, errors.title && styles.inputError)}
              placeholder="Name your schedule"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: null }));
              }}
              autoFocus
            />
            {errors.title && <span className={styles.errorMsg}>{errors.title}</span>}
          </div>

          <div className={styles.fieldBlock}>
            <span className={styles.sectionLabel}>When to run</span>

            {/* Inline row matching Screenshot 2: [Weekly ⌵] on [S M T W T F S] around [9:00 AM ⌵] */}
            <div className={styles.inlineWhenRow}>
              <select
                className={styles.styledSelect}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="once">Once</option>
              </select>

              {frequency === 'weekly' && (
                <div className={styles.daysGroup}>
                  <span className={styles.connectorWord}>on</span>
                  <div className={styles.dayCircles}>
                    {DAYS.map((d, idx) => {
                      const isSelected = weeklyDays.includes(d.day);
                      return (
                        <button
                          key={`${d.day}-${idx}`}
                          type="button"
                          className={cn(styles.circleDay, isSelected && styles.circleDaySelected)}
                          onClick={() => toggleDay(d.day)}
                          title={d.title}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className={styles.timeGroup}>
                <span className={styles.connectorWord}>around</span>
                <select
                  className={styles.styledSelect}
                  value={runTime}
                  onChange={(e) => setRunTime(e.target.value)}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {formatTimeLabel(t)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.assistLinkRow}>
              <span className={styles.assistLink}>
                Ask Gemini to create and edit event-based schedules and monitors
              </span>
            </div>
            {errors.weeklyDays && <span className={styles.errorMsg}>{errors.weeklyDays}</span>}
          </div>

          <div className={styles.fieldBlock}>
            <label htmlFor="schedule-instructions" className={styles.sectionLabel}>
              Instructions
            </label>
            <textarea
              id="schedule-instructions"
              rows={5}
              className={cn(styles.instructionsArea, errors.instructions && styles.inputError)}
              placeholder="Give your schedule some instructions"
              value={instructions}
              onChange={(e) => {
                setInstructions(e.target.value);
                if (errors.instructions) setErrors((prev) => ({ ...prev, instructions: null }));
              }}
            />
            {errors.instructions && <span className={styles.errorMsg}>{errors.instructions}</span>}
          </div>

          <div className={styles.targetSection}>
            <span className={styles.sectionLabel}>Output Delivery</span>
            <div className={styles.targetRow}>
              <button
                type="button"
                className={cn(styles.targetPill, deliveryTarget === 'chat' && styles.targetPillActive)}
                onClick={() => setDeliveryTarget('chat')}
              >
                <MessageSquare size={14} />
                <span>Chat conversation</span>
              </button>
              <button
                type="button"
                className={cn(styles.targetPill, deliveryTarget === 'library' && styles.targetPillActive)}
                onClick={() => setDeliveryTarget('library')}
              >
                <BookOpen size={14} />
                <span>Library document</span>
              </button>
            </div>
          </div>

          {/* Bottom disclaimer text matching Screenshot 2 */}
          <p className={styles.bottomDisclaimer}>
            Schedules run at approximate times and use more of your limit at peak hours. They won&apos;t run if you reach your limit.{' '}
            <span className={styles.learnMoreLink}>Learn more</span>
          </p>
        </form>
      </div>
    </Modal>
  );
}

ScheduleFormModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialSchedule: PropTypes.object,
  isSaving: PropTypes.bool,
};

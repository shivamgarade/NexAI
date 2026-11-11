import { Schedule } from '../models/Schedule.js';
import { executeSchedule } from './schedule.service.js';
import { logger } from '../utils/logger.js';

let intervalId = null;
let isTickRunning = false;

/**
 * Checks all active schedules and executes any that are due this minute.
 */
export async function checkAndRunDueSchedules() {
  if (isTickRunning) return;
  isTickRunning = true;

  try {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${minutes}`;
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    const activeSchedules = await Schedule.find({ isActive: true });

    for (const schedule of activeSchedules) {
      if (schedule.runTime !== currentTimeStr) {
        continue;
      }

      // Guard against running multiple times within the same minute
      if (schedule.lastRunAt) {
        const diffMinutes = (now.getTime() - new Date(schedule.lastRunAt).getTime()) / 60000;
        if (diffMinutes < 2) {
          continue;
        }
      }

      let isDue = false;
      if (schedule.frequency === 'daily') {
        isDue = true;
      } else if (schedule.frequency === 'weekly') {
        const days = Array.isArray(schedule.weeklyDays) ? schedule.weeklyDays : [];
        if (days.includes(currentDay)) {
          isDue = true;
        }
      } else if (schedule.frequency === 'once') {
        isDue = true;
      }

      if (isDue) {
        logger.info(
          { scheduleId: schedule._id, title: schedule.title, currentTime: currentTimeStr },
          'Autonomous Schedule triggered by background runner',
        );

        try {
          await executeSchedule(schedule._id, false);

          // If 'once', automatically deactivate
          if (schedule.frequency === 'once') {
            schedule.isActive = false;
            await schedule.save();
          }
        } catch (err) {
          logger.warn(
            { scheduleId: schedule._id, error: err.message },
            'Background schedule execution failed',
          );
        }
      }
    }
  } catch (err) {
    logger.error({ error: err.message }, 'Schedule ticker error');
  } finally {
    isTickRunning = false;
  }
}

/**
 * Starts the in-process background schedule ticker (checks every 60 seconds).
 */
export function startScheduleRunner() {
  if (intervalId) return;

  logger.info('⏰ Autonomous Schedule background runner initialized (60s tick)');
  intervalId = setInterval(checkAndRunDueSchedules, 60000);
}

/**
 * Stops the schedule runner on server shutdown.
 */
export function stopScheduleRunner() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('Autonomous Schedule runner stopped');
  }
}

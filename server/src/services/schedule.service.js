import { Schedule } from '../models/Schedule.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { Document } from '../models/Document.js';
import { generateContent } from './gemini.service.js';
import { assertBalance, deductCredits } from './credit.service.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

/**
 * Retrieves all schedules for a specific user.
 */
export async function getSchedules(userId) {
  return Schedule.find({ userId }).sort({ createdAt: -1 });
}

/**
 * Retrieves a single schedule by ID.
 */
export async function getScheduleById(userId, scheduleId) {
  const schedule = await Schedule.findOne({ _id: scheduleId, userId });
  if (!schedule) {
    throw new ApiError(404, 'NOT_FOUND', 'Schedule not found');
  }
  return schedule;
}

/**
 * Creates a new schedule for a user.
 */
export async function createSchedule(userId, data) {
  const schedule = await Schedule.create({
    userId,
    title: data.title,
    description: data.description || '',
    instructions: data.instructions,
    frequency: data.frequency || 'daily',
    weeklyDays: data.weeklyDays || [1, 2, 3, 4, 5],
    runTime: data.runTime || '09:00',
    isActive: data.isActive !== undefined ? data.isActive : true,
    model: data.model || 'flash',
    deliveryTarget: data.deliveryTarget || 'chat',
  });

  logger.info({ scheduleId: schedule._id, userId, title: schedule.title }, 'Schedule created');
  return schedule;
}

/**
 * Updates an existing schedule.
 */
export async function updateSchedule(userId, scheduleId, data) {
  const schedule = await getScheduleById(userId, scheduleId);

  if (data.title !== undefined) schedule.title = data.title;
  if (data.description !== undefined) schedule.description = data.description;
  if (data.instructions !== undefined) schedule.instructions = data.instructions;
  if (data.frequency !== undefined) schedule.frequency = data.frequency;
  if (data.weeklyDays !== undefined) schedule.weeklyDays = data.weeklyDays;
  if (data.runTime !== undefined) schedule.runTime = data.runTime;
  if (data.isActive !== undefined) schedule.isActive = data.isActive;
  if (data.model !== undefined) schedule.model = data.model;
  if (data.deliveryTarget !== undefined) schedule.deliveryTarget = data.deliveryTarget;

  await schedule.save();
  return schedule;
}

/**
 * Deletes a schedule.
 */
export async function deleteSchedule(userId, scheduleId) {
  const schedule = await getScheduleById(userId, scheduleId);
  await schedule.deleteOne();
  logger.info({ scheduleId, userId }, 'Schedule deleted');
  return { success: true };
}

/**
 * Toggles a schedule active/paused state.
 */
export async function toggleScheduleActive(userId, scheduleId) {
  const schedule = await getScheduleById(userId, scheduleId);
  schedule.isActive = !schedule.isActive;
  await schedule.save();
  return schedule;
}

/**
 * Executes a schedule immediately (either by background cron or manual 'Run Now').
 * Checks credit balance, calls Gemini, deducts tokens, saves delivered output,
 * and updates schedule telemetry.
 *
 * @param {string} scheduleId
 * @param {boolean} [isManualTrigger=false]
 * @returns {Promise<{ success: boolean, schedule: object, resultText: string, tokensUsed: number }>}
 */
export async function executeSchedule(scheduleId, isManualTrigger = false) {
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) {
    throw new ApiError(404, 'NOT_FOUND', 'Schedule not found for execution');
  }

  const userId = schedule.userId;

  // 1. Credit balance verification
  await assertBalance(userId);

  // Set status to running
  schedule.lastRunStatus = 'running';
  await schedule.save();

  try {
    const systemInstruction = `You are the NexAI Autonomous Schedule Agent executing a recurring scheduled task for the user titled "${schedule.title}".
Execute the user's instructions thoroughly and produce an executive-ready output.
Structure your output cleanly with markdown formatting (e.g., Executive Summary, Findings/Output, and Actionable Next Steps).
Today's date and time is ${new Date().toLocaleString('en-US')}.`;

    const contents = [{ role: 'user', parts: [{ text: schedule.instructions }] }];

    const { text, totalTokens } = await generateContent({
      contents,
      model: schedule.model || 'flash',
      systemInstruction,
    });

    // Deduct real tokens
    await deductCredits({
      userId,
      tokensUsed: totalTokens || 100,
      feature: 'chat',
      model: schedule.model || 'flash',
    });

    // Deliver results: Always create a fresh chat thread so every run appears in Recent Chats
    const chat = await Chat.create({
      userId,
      title: `⏰ ${schedule.title}`,
    });
    schedule.targetChatId = chat._id;

    await Message.create({
      chatId: chat._id,
      role: 'user',
      content: `[Automated Schedule Trigger: ${schedule.title} (${isManualTrigger ? 'Manual Test Run' : 'Scheduled Run'})]\n${schedule.instructions}`,
    });

    await Message.create({
      chatId: chat._id,
      role: 'assistant',
      content: text,
      tokensUsed: totalTokens || 100,
    });

    chat.updatedAt = new Date();
    await chat.save();

    // If deliveryTarget is library, also archive a copy in Library
    if (schedule.deliveryTarget === 'library') {
      await Document.create({
        userId,
        title: `⏰ Schedule: ${schedule.title} (${new Date().toLocaleDateString()})`,
        content: text,
        type: 'document',
        tags: ['schedule', 'automation', schedule.frequency],
      });
    }

    // Update schedule telemetry
    schedule.lastRunAt = new Date();
    schedule.lastRunStatus = 'success';
    schedule.lastRunSummary = text.slice(0, 220).trim() + (text.length > 220 ? '...' : '');
    schedule.totalRuns = (schedule.totalRuns || 0) + 1;
    await schedule.save();

    logger.info(
      { scheduleId, userId, tokensUsed: totalTokens, isManualTrigger },
      'Schedule executed successfully',
    );

    return {
      success: true,
      schedule,
      resultText: text,
      tokensUsed: totalTokens,
      chatId: chat._id,
      chat,
    };
  } catch (err) {
    schedule.lastRunStatus = 'failed';
    schedule.lastRunSummary = `Execution error: ${err.message}`;
    await schedule.save();

    logger.error({ scheduleId, error: err.message }, 'Schedule execution failed');
    throw err;
  }
}

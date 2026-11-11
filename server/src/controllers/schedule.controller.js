import { asyncHandler } from '../utils/asyncHandler.js';
import * as scheduleService from '../services/schedule.service.js';

export const getSchedules = asyncHandler(async (req, res) => {
  const schedules = await scheduleService.getSchedules(req.user._id);
  res.status(200).json({ data: schedules });
});

export const getScheduleById = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.getScheduleById(req.user._id, req.params.id);
  res.status(200).json({ data: schedule });
});

export const createSchedule = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.createSchedule(req.user._id, req.body);
  res.status(201).json({ data: schedule });
});

export const updateSchedule = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.updateSchedule(req.user._id, req.params.id, req.body);
  res.status(200).json({ data: schedule });
});

export const deleteSchedule = asyncHandler(async (req, res) => {
  await scheduleService.deleteSchedule(req.user._id, req.params.id);
  res.status(200).json({ success: true, message: 'Schedule deleted successfully' });
});

export const toggleSchedule = asyncHandler(async (req, res) => {
  const schedule = await scheduleService.toggleScheduleActive(req.user._id, req.params.id);
  res.status(200).json({ data: schedule });
});

export const runScheduleNow = asyncHandler(async (req, res) => {
  const result = await scheduleService.executeSchedule(req.params.id, true);
  res.status(200).json({
    success: true,
    message: 'Schedule executed successfully',
    data: result,
  });
});

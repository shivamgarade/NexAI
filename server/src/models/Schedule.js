import mongoose from 'mongoose';

const scheduleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    instructions: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'once'],
      default: 'daily',
    },
    // For weekly: array of day numbers: 0 (Sun), 1 (Mon), ..., 6 (Sat)
    weeklyDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5],
    },
    // Time in 24h format HH:mm (e.g., '09:00')
    runTime: {
      type: String,
      default: '09:00',
      match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    model: {
      type: String,
      enum: ['flash', 'pro'],
      default: 'flash',
    },
    deliveryTarget: {
      type: String,
      enum: ['chat', 'library'],
      default: 'chat',
    },
    targetChatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      default: null,
    },
    lastRunAt: {
      type: Date,
      default: null,
    },
    lastRunStatus: {
      type: String,
      enum: ['idle', 'running', 'success', 'failed'],
      default: 'idle',
    },
    lastRunSummary: {
      type: String,
      default: '',
    },
    totalRuns: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

scheduleSchema.index({ userId: 1, isActive: 1 });

export const Schedule = mongoose.model('Schedule', scheduleSchema);

import mongoose from 'mongoose';

const interviewMessageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['assistant', 'user'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const scorecardCategorySchema = new mongoose.Schema(
  {
    technicalAccuracy: { type: Number, min: 0, max: 100, default: 0 },
    problemSolving: { type: Number, min: 0, max: 100, default: 0 },
    communication: { type: Number, min: 0, max: 100, default: 0 },
    systemDesign: { type: Number, min: 0, max: 100, default: 0 },
  },
  { _id: false },
);

const scorecardSchema = new mongoose.Schema(
  {
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      required: true,
    },
    rating: {
      type: String,
      enum: ['Strong Hire', 'Hire', 'Needs Improvement', 'Unprepared', 'Incomplete'],
      required: true,
    },
    categories: {
      type: scorecardCategorySchema,
      required: true,
    },
    strengths: {
      type: [String],
      default: [],
    },
    improvements: {
      type: [String],
      default: [],
    },
    summary: {
      type: String,
      default: '',
      trim: true,
    },
    recommendedTopics: {
      type: [String],
      default: [],
    },
  },
  { _id: false },
);

const interviewSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
    },
    difficulty: {
      type: String,
      enum: ['junior', 'mid', 'senior'],
      required: true,
    },
    topic: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'incomplete'],
      default: 'in_progress',
      index: true,
    },
    messages: {
      type: [interviewMessageSchema],
      default: [],
    },
    scorecard: {
      type: scorecardSchema,
      default: null,
    },
    totalTokensUsed: {
      type: Number,
      default: 0,
    },
    isSimulation: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

interviewSessionSchema.index({ userId: 1, createdAt: -1 });
interviewSessionSchema.index({ userId: 1, status: 1, createdAt: -1 });

export const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);

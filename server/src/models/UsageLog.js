import mongoose from 'mongoose';

const usageLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    model: {
      type: String,
      enum: ['flash', 'pro', 'tts'],
      required: true,
    },
    feature: {
      type: String,
      enum: ['chat', 'library', 'docgen', 'document', 'interview', 'schema'],
      required: true,
    },
    tokensUsed: {
      type: Number,
      required: true,
    },
    creditsDeducted: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

usageLogSchema.index({ userId: 1, createdAt: -1 });

export const UsageLog = mongoose.model('UsageLog', usageLogSchema);

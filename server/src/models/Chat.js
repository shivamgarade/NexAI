import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
      index: true,
    },
    title: {
      type: String,
      default: 'New Chat',
      trim: true,
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    isTemporary: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

chatSchema.index({ userId: 1, createdAt: -1 });
chatSchema.index({ userId: 1, projectId: 1, updatedAt: -1 });

export const Chat = mongoose.model('Chat', chatSchema);

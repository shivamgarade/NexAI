import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    chatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    thoughts: {
      type: String,
      default: '',
    },
    tokensUsed: {
      type: Number,
      default: 0,
    },
    skillId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Skill',
      default: null,
    },
    steps: [
      {
        id: { type: String },
        type: { type: String }, // 'tool_call' | 'grounding' | 'thought' | 'code_execution'
        tool: { type: String }, // 'web_search' | 'fetch_url' | 'code_execution' | 'workspace_search' | 'memory_search'
        title: { type: String },
        input: { type: mongoose.Schema.Types.Mixed },
        output: { type: mongoose.Schema.Types.Mixed },
        status: { type: String, enum: ['running', 'completed', 'failed'], default: 'completed' },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    groundingMetadata: {
      webSearchQueries: [String],
      sources: [
        {
          title: { type: String },
          url: { type: String },
        },
      ],
    },
    attachments: [
      {
        name: { type: String, default: '' },
        mimeType: { type: String, required: true },
        data: { type: String, default: '' },
        size: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true },
);

messageSchema.index({ chatId: 1, createdAt: 1 });

export const Message = mongoose.model('Message', messageSchema);

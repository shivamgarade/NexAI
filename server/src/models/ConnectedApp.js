import mongoose from 'mongoose';

const connectedAppSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    appSlug: {
      type: String,
      required: true,
      enum: ['github', 'google-drive', 'web-search', 'notion', 'figma'],
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    icon: {
      type: String,
      default: 'Layers',
    },
    category: {
      type: String,
      default: 'Developer',
    },
    isConnected: {
      type: Boolean,
      default: false,
    },
    credentials: {
      apiKey: {
        type: String,
        default: '',
        select: false,
      },
      webhookUrl: {
        type: String,
        default: '',
      },
      accountName: {
        type: String,
        default: '',
      },
    },
    scopes: {
      type: [String],
      default: [],
    },
    settings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastSyncedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

connectedAppSchema.index({ userId: 1, appSlug: 1 }, { unique: true });

export const ConnectedApp = mongoose.model('ConnectedApp', connectedAppSchema);

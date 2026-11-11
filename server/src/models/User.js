import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      select: false,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    wallet: {
      creditsRemaining: {
        type: Number,
        default: 100,
        min: 0,
      },
      tier: {
        type: String,
        enum: ['free', 'pro_monthly'],
        default: 'free',
      },
      totalTokensConsumed: {
        type: Number,
        default: 0,
      },
    },
    settings: {
      theme: {
        type: String,
        enum: ['dark', 'light'],
        default: 'dark',
      },
      defaultModel: {
        type: String,
        enum: ['flash', 'pro'],
        default: 'flash',
      },
      webSearchDefaultOn: {
        type: Boolean,
        default: false,
      },
      toolExecutionMode: {
        type: String,
        enum: ['auto', 'confirm', 'manual'],
        default: 'auto',
      },
      personalization: {
        customInstructions: {
          type: String,
          default: '',
          trim: true,
          maxlength: 2000,
        },
        responseTone: {
          type: String,
          enum: ['default', 'concise', 'detailed', 'technical', 'casual'],
          default: 'default',
        },
        aiMemoryEnabled: {
          type: Boolean,
          default: true,
        },
      },
    },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);

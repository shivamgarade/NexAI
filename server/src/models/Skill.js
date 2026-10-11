import mongoose from 'mongoose';

/**
 * Extracts and deduplicates {{variable}} names from a template or instructions string.
 * Supports spaces inside braces like {{ user_name }}.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function extractVariables(text) {
  if (!text || typeof text !== 'string') return [];
  const regex = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  const matches = [...text.matchAll(regex)];
  const vars = matches.map((m) => m[1].trim());
  return [...new Set(vars)];
}

const skillSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null, // null indicates system-wide built-in skill
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    icon: {
      type: String,
      default: 'Zap',
      trim: true,
    },
    instructions: {
      type: String,
      required: true,
    },
    template: {
      type: String,
      default: '',
    },
    variables: {
      type: [String],
      default: [],
    },
    tools: {
      type: [String],
      enum: ['web_search', 'fetch_url', 'code_execution', 'workspace_search', 'memory_search'],
      default: [],
    },
    category: {
      type: String,
      enum: ['Research', 'Coding', 'Writing', 'Analysis', 'Productivity', 'General'],
      default: 'General',
    },
    isSystem: {
      type: Boolean,
      default: false,
      index: true,
    },
    isFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

// Sync instructions/template and auto-extract variables before validation and saving
skillSchema.pre('validate', function (next) {
  if (!this.instructions && this.template) {
    this.instructions = this.template;
  }
  if (!this.template && this.instructions) {
    this.template = this.instructions;
  }
  next();
});

skillSchema.pre('save', function (next) {
  if (this.isModified('template') && !this.isModified('instructions')) {
    this.instructions = this.template;
  } else if (this.isModified('instructions') && !this.isModified('template')) {
    this.template = this.instructions;
  }

  if (this.isModified('instructions') || this.isModified('template')) {
    const sourceText = this.isModified('template') ? this.template : (this.instructions || this.template || '');
    this.variables = extractVariables(sourceText);
  }

  if (!this.slug && this.title) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  next();
});

skillSchema.index({ userId: 1, isFavorite: -1, createdAt: -1 });
skillSchema.index({ title: 'text', instructions: 'text', template: 'text', tags: 'text', description: 'text' });

export const Skill = mongoose.models.Skill || mongoose.model('Skill', skillSchema);

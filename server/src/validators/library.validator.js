import { z } from 'zod';

export const suggestLibrarySchema = z
  .object({
    type: z.enum(['link', 'note', 'file'], {
      required_error: 'Type must be "link", "note", or "file"',
    }),
    url: z.string().url('A valid URL is required for link suggestions').optional(),
    content: z.string().min(3, 'Content must be at least 3 characters').optional(),
    fileName: z.string().optional(),
    fileBase64: z.string().optional(),
    mimeType: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'link') return Boolean(data.url);
      if (data.type === 'note') return Boolean(data.content);
      if (data.type === 'file') return Boolean(data.content || data.fileBase64);
      return false;
    },
    {
      message: 'Either a valid url (for link) or content/file data (for note/file) must be provided',
    },
  );


export const generateDocumentSchema = z.object({
  prompt: z.string().min(3, 'Prompt must be at least 3 characters').max(2000),
  category: z.enum(['resume', 'report', 'spec', 'notes', 'other']).default('other'),
});

const sectionSchema = z.object({
  heading: z.string().min(1, 'Heading is required'),
  body: z.string().min(1, 'Body is required'),
});

export const createLibraryItemSchema = z.object({
  type: z.enum(['link', 'note', 'document', 'file', 'interview']),
  title: z.string().min(1, 'Title is required').max(200),
  summary: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  content: z.string().optional().default(''),
  url: z.string().url().optional().or(z.literal('')),
  category: z.enum(['resume', 'report', 'spec', 'notes', 'other']).optional(),
  sections: z.array(sectionSchema).optional(),
  fileFormat: z.string().optional().default('pdf'),
  fileName: z.string().optional().default(''),
  mimeType: z.string().optional().default(''),
  size: z.number().optional().default(0),
  fileData: z.string().optional().default(''),
  scorecard: z.any().optional(),
  transcript: z.array(z.any()).optional(),
  topic: z.string().optional().default(''),
  difficulty: z.string().optional().default(''),
  role: z.string().optional().default(''),
});

export const updateLibraryItemSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  content: z.string().optional(),
  fileData: z.string().optional(),
  category: z.enum(['resume', 'report', 'spec', 'notes', 'other']).optional(),
  sections: z.array(sectionSchema).optional(),
  pinned: z.boolean().optional(),
});

export const queryLibrarySchema = z.object({
  tag: z.string().optional(),
  type: z.enum(['link', 'note', 'document', 'file', 'interview']).optional(),
  tab: z.enum(['all', 'notes', 'bookmarks', 'links', 'notes_links', 'documents', 'files', 'interviews']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'title', 'score']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const searchLibrarySchema = z.object({
  q: z.string().min(1, 'Query parameter "q" is required and cannot be empty'),
  type: z.enum(['link', 'note', 'document', 'file', 'interview']).optional(),
  tab: z.enum(['all', 'notes', 'bookmarks', 'links', 'notes_links', 'documents', 'files', 'interviews']).optional(),
});

import { LibraryItem } from '../models/LibraryItem.js';
import { extractLinkContent } from '../services/linkExtractor.service.js';
import { generateLibrarySuggestion } from '../agents/tagging.agent.js';
import { generateDocumentDraft } from '../agents/docGen.agent.js';
import { generateDocumentPdf } from '../services/pdfExport.service.js';
import { deductCredits } from '../services/credit.service.js';
import * as geminiService from '../services/gemini.service.js';
import { vectorDbService } from '../services/vectorDb.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { logger } from '../utils/logger.js';

/**
 * Builds one or more text representations of any polymorphic library item for multi-chunk vector embedding.
 * Prevents the 1,500-char truncation and ensures deep document sections and notes are indexed.
 *
 * @param {any} item
 * @returns {string[]}
 */
function buildItemEmbeddingTexts(item) {
  const metaParts = [
    item.title ? `Title: ${item.title}` : '',
    item.summary ? `Summary: ${item.summary}` : '',
    Array.isArray(item.tags) && item.tags.length > 0 ? `Tags: ${item.tags.join(' ')}` : '',
    item.topic || item.role ? `Topic: ${item.topic || ''} Role: ${item.role || ''}` : '',
    item.scorecard?.summary ? `Scorecard: ${item.scorecard.summary}` : '',
  ].filter(Boolean);

  const baseHeader = metaParts.join('\n');
  const chunks = [];

  // 1. Structured Document with Sections
  if (Array.isArray(item.sections) && item.sections.length > 0) {
    let currentChunk = baseHeader ? `${baseHeader}\n\n` : '';
    for (const sec of item.sections) {
      const sectionText = `## ${sec.heading}\n${sec.body}`;
      if ((currentChunk + sectionText).length > 3000 && currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = baseHeader ? `${baseHeader}\n\n${sectionText}\n\n` : `${sectionText}\n\n`;
      } else {
        currentChunk += `${sectionText}\n\n`;
      }
      if (chunks.length >= 4) break;
    }
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
  } else if (item.content && item.content.trim()) {
    // 2. Notes, Links, and Text Files
    const fullText = item.content.trim();
    if (fullText.length <= 3500) {
      chunks.push([baseHeader, fullText].filter(Boolean).join('\n\n'));
    } else {
      // Chunking long content with 300-char overlap
      const chunkSize = 3000;
      let start = 0;
      while (start < fullText.length && chunks.length < 4) {
        const slice = fullText.slice(start, start + chunkSize);
        chunks.push([baseHeader, slice].filter(Boolean).join('\n\n'));
        start += chunkSize - 300;
      }
    }
  } else {
    // 3. Fallback for items with only title/summary
    chunks.push(baseHeader || item.title || 'Library Item');
  }

  return chunks.filter(Boolean);
}

/**
 * Generates an AI-suggested title, summary, and tags for a link, note, or file without saving.
 * Metered via creditCheck and credit deduction.
 */
export const suggestItem = asyncHandler(async (req, res) => {
  const { type, url, content, fileName, fileBase64, mimeType } = req.body;
  let textToAnalyze = content || '';
  let extractedTitle = fileName || '';

  if (type === 'link' && url) {
    const extracted = await extractLinkContent(url);
    textToAnalyze = extracted.content || extracted.description || extracted.title;
    extractedTitle = extracted.title;
  }

  const suggestion = await generateLibrarySuggestion({
    content: textToAnalyze,
    suggestedTitle: extractedTitle,
    fileBase64,
    mimeType,
  });


  let creditsDeducted = 0;
  let creditsRemaining = req.user.wallet?.creditsRemaining ?? 0;

  if (suggestion.tokensUsed > 0) {
    try {
      const deduction = await deductCredits({
        userId: req.user._id,
        tokensUsed: suggestion.tokensUsed,
        feature: 'library',
        model: 'flash',
      });
      creditsDeducted = deduction.creditsDeducted;
      creditsRemaining = deduction.creditsRemaining;
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to deduct credits for library suggestion');
    }
  }

  res.status(200).json({
    data: {
      type,
      url: url || null,
      title: suggestion.title,
      summary: suggestion.summary,
      tags: suggestion.tags,
      content: textToAnalyze.slice(0, 3000),
      tokensUsed: suggestion.tokensUsed,
      creditsDeducted,
      creditsRemaining,
    },
  });
});

/**
 * Generates an AI-drafted structured document (resume, report, spec, study notes).
 * Returns draft without auto-saving (Suggest -> Review -> Confirm).
 * Metered via creditCheck and credit deduction.
 * POST /api/library/documents/generate
 */
export const generateDocument = asyncHandler(async (req, res) => {
  const { prompt, category = 'other' } = req.body;

  const draft = await generateDocumentDraft({ prompt, category });

  let creditsDeducted = 0;
  let creditsRemaining = req.user.wallet?.creditsRemaining ?? 0;

  if (draft.tokensUsed > 0) {
    try {
      const deduction = await deductCredits({
        userId: req.user._id,
        tokensUsed: draft.tokensUsed,
        feature: 'document',
        model: 'flash',
      });
      creditsDeducted = deduction.creditsDeducted;
      creditsRemaining = deduction.creditsRemaining;
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to deduct credits for document generation');
    }
  }

  res.status(200).json({
    data: {
      title: draft.title,
      category: draft.category,
      summary: draft.summary,
      sections: draft.sections,
      tokensUsed: draft.tokensUsed,
      creditsDeducted,
      creditsRemaining,
    },
  });
});

/**
 * Streams a styled PDF generated server-side using pdf-lib.
 * GET /api/library/documents/:id/export.pdf
 */
export const exportDocumentPdf = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const item = await LibraryItem.findOne({
    _id: id,
    userId: req.user._id,
  });

  if (!item) {
    throw new ApiError(404, 'DOCUMENT_NOT_FOUND', 'Document not found');
  }

  // Build document payload for PDF renderer
  const docPayload = {
    title: item.title,
    category: item.category || (item.type === 'document' ? 'Document' : item.type),
    summary: item.summary || '',
    sections:
      Array.isArray(item.sections) && item.sections.length > 0
        ? item.sections
        : [
            {
              heading: 'Content',
              body: item.content || item.summary || 'No content provided.',
            },
          ],
    createdAt: item.createdAt,
  };

  const pdfBuffer = await generateDocumentPdf(docPayload);
  const sanitizedTitle = (item.title || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${sanitizedTitle}.pdf"`);
  res.setHeader('Content-Length', pdfBuffer.length);
  res.status(200).send(pdfBuffer);
});

/**
 * Saves a confirmed polymorphic library item (link, note, document, file, interview).
 * POST /api/library
 */
export const createItem = asyncHandler(async (req, res) => {
  const {
    type,
    title,
    summary,
    tags,
    content,
    url,
    category,
    sections,
    fileFormat,
    fileName,
    mimeType,
    size,
    fileData,
    scorecard,
    transcript,
    topic,
    difficulty,
    role,
  } = req.body;

  const normalizedTags = Array.isArray(tags)
    ? tags
        .map((t) =>
          t
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9-]/g, ''),
        )
        .filter(Boolean)
    : [];

  const item = await LibraryItem.create({
    userId: req.user._id,
    type,
    title: title.trim(),
    summary: summary?.trim() || '',
    tags: Array.from(new Set(normalizedTags)),
    content: content || '',
    url: url || undefined,
    category: category || 'other',
    sections: Array.isArray(sections) ? sections : [],
    fileFormat: fileFormat || 'pdf',
    fileName: fileName || '',
    mimeType: mimeType || '',
    size: size || 0,
    fileData: fileData || '',
    scorecard: scorecard || null,
    transcript: Array.isArray(transcript) ? transcript : [],
    topic: topic || '',
    difficulty: difficulty || '',
    role: role || '',
    vectorId: null,
    vectorIds: [],
  });

  // Vector embedding & upsert (multi-chunk support)
  try {
    const embedTexts = buildItemEmbeddingTexts(item);
    const chunkVectorIds = [];

    for (let i = 0; i < embedTexts.length; i++) {
      const textChunk = embedTexts[i];
      const embedding = await geminiService.embedContent({ contents: textChunk });

      if (embedding && embedding.length > 0) {
        const chunkId = i === 0 ? item._id.toString() : `${item._id.toString()}_${i}`;
        const success = await vectorDbService.upsert({
          id: chunkId,
          values: embedding,
          metadata: {
            userId: req.user._id.toString(),
            type: 'library',
            itemType: item.type,
            refId: item._id.toString(),
            chunkIndex: i,
          },
        });

        if (success) {
          chunkVectorIds.push(chunkId);
        }
      }
    }

    if (chunkVectorIds.length > 0) {
      item.vectorId = chunkVectorIds[0];
      item.vectorIds = chunkVectorIds;
      await item.save();
    }
  } catch (err) {
    logger.warn(
      { error: err.message, itemId: item._id },
      'Vector embedding failed during library item creation; item saved in MongoDB',
    );
  }


  res.status(201).json({
    data: item,
  });
});

/**
 * Lists library items with tabbed filtering: 'all', 'notes_links', 'documents', 'files', 'interviews'.
 * GET /api/library
 */
export const listItems = asyncHandler(async (req, res) => {
  const {
    tag,
    type,
    tab,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = req.query;
  const filter = { userId: req.user._id };

  // Handle tabbed filtering
  if (tab) {
    if (tab === 'notes') {
      filter.type = 'note';
    } else if (tab === 'bookmarks' || tab === 'links') {
      filter.type = 'link';
    } else if (tab === 'notes_links') {
      filter.type = { $in: ['link', 'note'] };
    } else if (tab === 'documents') {
      filter.type = 'document';
    } else if (tab === 'files') {
      filter.type = 'file';
    } else if (tab === 'interviews') {
      filter.type = 'interview';
    }
  } else if (type) {
    filter.type = type;
  }

  if (tag) {
    filter.tags = tag.toLowerCase().trim();
  }

  const numericPage = Math.max(1, parseInt(page, 10));
  const numericLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (numericPage - 1) * numericLimit;

  const sortDirection = sortOrder === 'asc' ? 1 : -1;
  const sortObj = { pinned: -1 };
  if (sortBy === 'title') {
    sortObj.title = sortDirection;
  } else if (sortBy === 'score') {
    sortObj['scorecard.overallScore'] = sortDirection;
  } else {
    sortObj.createdAt = sortDirection;
  }

  // Run queries in parallel: items, total count, distinct tags, and tab breakdown counts
  const [items, total, allTags, countAll, countNotes, countDocs, countFiles, countInterviews] =
    await Promise.all([
      LibraryItem.find(filter).sort(sortObj).skip(skip).limit(numericLimit).lean(),
      LibraryItem.countDocuments(filter),
      LibraryItem.distinct('tags', { userId: req.user._id }),
      LibraryItem.countDocuments({ userId: req.user._id }),
      LibraryItem.countDocuments({ userId: req.user._id, type: { $in: ['link', 'note'] } }),
      LibraryItem.countDocuments({ userId: req.user._id, type: 'document' }),
      LibraryItem.countDocuments({ userId: req.user._id, type: 'file' }),
      LibraryItem.countDocuments({ userId: req.user._id, type: 'interview' }),
    ]);

  res.status(200).json({
    data: items,
    meta: {
      total,
      page: numericPage,
      limit: numericLimit,
      totalPages: Math.ceil(total / numericLimit) || 1,
      tags: allTags.filter(Boolean).sort(),
      counts: {
        all: countAll,
        notes_links: countNotes,
        documents: countDocs,
        files: countFiles,
        interviews: countInterviews,
      },
    },
  });
});

/**
 * Retrieves a single library item by ID.
 * GET /api/library/:id
 */
export const getItemById = asyncHandler(async (req, res) => {
  const item = await LibraryItem.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!item) {
    throw new ApiError(404, 'ITEM_NOT_FOUND', 'Library item not found');
  }

  res.status(200).json({
    data: item,
  });
});

/**
 * Updates a polymorphic library item and refreshes its vector embedding.
 * PATCH /api/library/:id
 */
export const updateItem = asyncHandler(async (req, res) => {
  const item = await LibraryItem.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!item) {
    throw new ApiError(404, 'ITEM_NOT_FOUND', 'Library item not found');
  }

  const { title, summary, tags, content, category, sections } = req.body;
  let textChanged = false;

  if (title !== undefined && title.trim() !== item.title) {
    item.title = title.trim();
    textChanged = true;
  }
  if (summary !== undefined && summary.trim() !== item.summary) {
    item.summary = summary.trim();
    textChanged = true;
  }
  if (tags !== undefined) {
    item.tags = Array.from(
      new Set(
        tags
          .map((t) =>
            t
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9-]/g, ''),
          )
          .filter(Boolean),
      ),
    );
    textChanged = true;
  }
  if (content !== undefined && content !== item.content) {
    item.content = content;
    textChanged = true;
  }
  if (category !== undefined && category !== item.category) {
    item.category = category;
    textChanged = true;
  }
  if (sections !== undefined) {
    item.sections = sections;
    textChanged = true;
  }
  if (req.body.fileData !== undefined) {
    item.fileData = req.body.fileData;
  }
  if (req.body.pinned !== undefined) {
    item.pinned = Boolean(req.body.pinned);
  }

  await item.save();

  if (textChanged) {
    try {
      // Clean up previous chunk vectors
      const prevIds = Array.isArray(item.vectorIds) && item.vectorIds.length > 0
        ? item.vectorIds
        : item.vectorId ? [item.vectorId] : [];
      if (prevIds.length > 0) {
        await vectorDbService.removeMany(prevIds);
      }

      const embedTexts = buildItemEmbeddingTexts(item);
      const newChunkIds = [];

      for (let i = 0; i < embedTexts.length; i++) {
        const textChunk = embedTexts[i];
        const embedding = await geminiService.embedContent({ contents: textChunk });

        if (embedding && embedding.length > 0) {
          const chunkId = i === 0 ? item._id.toString() : `${item._id.toString()}_${i}`;
          const success = await vectorDbService.upsert({
            id: chunkId,
            values: embedding,
            metadata: {
              userId: req.user._id.toString(),
              type: 'library',
              itemType: item.type,
              refId: item._id.toString(),
              chunkIndex: i,
            },
          });

          if (success) {
            newChunkIds.push(chunkId);
          }
        }
      }

      if (newChunkIds.length > 0) {
        item.vectorId = newChunkIds[0];
        item.vectorIds = newChunkIds;
        await item.save();
      }
    } catch (err) {
      logger.warn({ error: err.message, itemId: item._id }, 'Vector re-embedding failed');
    }
  }

  res.status(200).json({
    data: item,
  });
});

/**
 * Deletes a library item and removes its vector index.
 * DELETE /api/library/:id
 */
export const deleteItem = asyncHandler(async (req, res) => {
  const item = await LibraryItem.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!item) {
    throw new ApiError(404, 'ITEM_NOT_FOUND', 'Library item not found');
  }

  const idsToRemove = Array.isArray(item.vectorIds) && item.vectorIds.length > 0
    ? item.vectorIds
    : item.vectorId ? [item.vectorId] : [];

  if (idsToRemove.length > 0) {
    try {
      await vectorDbService.removeMany(idsToRemove);
    } catch (err) {
      logger.warn({ error: err.message, ids: idsToRemove }, 'Failed to remove vector');
    }
  }

  await item.deleteOne();

  res.status(200).json({
    data: {
      message: 'Library item deleted successfully',
    },
  });
});


/**
 * Semantic search over polymorphic library items for the authenticated user.
 * Searches by conceptual meaning via vector embeddings, with MongoDB text search ranking.
 * GET /api/library/search?q=
 */
export const searchItems = asyncHandler(async (req, res) => {
  const { q, type, tab } = req.query;
  const userIdStr = req.user._id.toString();

  let matchedItems = [];
  const matchedIds = new Set();

  let typeFilter = null;
  if (tab) {
    if (tab === 'notes') {
      typeFilter = 'note';
    } else if (tab === 'bookmarks' || tab === 'links') {
      typeFilter = 'link';
    } else if (tab === 'notes_links') {
      typeFilter = { $in: ['link', 'note'] };
    } else if (tab === 'documents') {
      typeFilter = 'document';
    } else if (tab === 'files') {
      typeFilter = 'file';
    } else if (tab === 'interviews') {
      typeFilter = 'interview';
    }
  } else if (type) {
    typeFilter = type;
  }

  // 1. Semantic Vector Search
  try {
    const queryEmbedding = await geminiService.embedContent({ contents: q });
    if (queryEmbedding && queryEmbedding.length > 0) {
      const vectorMatches = await vectorDbService.query({
        values: queryEmbedding,
        topK: 25,
        filter: {
          userId: userIdStr,
          type: 'library',
        },
      });

      const refIds = vectorMatches.map((m) => m.metadata?.refId || m.id).filter(Boolean);

      if (refIds.length > 0) {
        const queryFilter = {
          _id: { $in: refIds },
          userId: req.user._id,
        };
        if (typeFilter) queryFilter.type = typeFilter;

        const docs = await LibraryItem.find(queryFilter).lean();

        // Preserve vector similarity score ordering
        const docMap = new Map(docs.map((d) => [d._id.toString(), d]));
        for (const refId of refIds) {
          const doc = docMap.get(refId);
          if (doc && !matchedIds.has(doc._id.toString())) {
            matchedIds.add(doc._id.toString());
            matchedItems.push(doc);
          }
        }
      }
    }
  } catch (err) {
    logger.warn(
      { error: err.message, query: q },
      'Semantic vector query failed, using text fallback',
    );
  }

  // 2. Keyword & Text Search Fallback / Augmentation
  try {
    const textFilter = {
      userId: req.user._id,
      $or: [
        { $text: { $search: q } },
        { title: { $regex: q, $options: 'i' } },
        { summary: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } },
        { 'sections.heading': { $regex: q, $options: 'i' } },
        { 'sections.body': { $regex: q, $options: 'i' } },
      ],
    };
    if (typeFilter) textFilter.type = typeFilter;

    const textMatches = await LibraryItem.find(textFilter)
      .sort({ createdAt: -1 })
      .limit(25)
      .lean();

    for (const doc of textMatches) {
      if (!matchedIds.has(doc._id.toString())) {
        matchedIds.add(doc._id.toString());
        matchedItems.push(doc);
      }
    }
  } catch (textErr) {
    logger.warn({ error: textErr.message }, 'Text search fallback encountered an issue');
  }

  res.status(200).json({
    data: matchedItems,
  });
});

/**
 * Inline AI Co-Writer for Notion-style notes editor.
 * Uses Gemini Flash (free tier) to draft, expand, polish, or summarize text.
 */
export const aiWrite = asyncHandler(async (req, res) => {
  const { prompt, context = '', mode = 'draft' } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw ApiError.badRequest('Prompt is required for AI writing');
  }

  const systemInstruction =
    'You are an expert AI writing assistant embedded in a Notion-style markdown notes editor. ' +
    'Provide clear, high-quality, directly usable markdown text without conversational preambles or wrap-ups.';

  let contents = prompt.trim();
  if (context && context.trim()) {
    contents = `Existing note content for context:\n${context.trim().slice(0, 3000)}\n\nInstruction / Prompt: ${prompt.trim()}`;
  }

  const { text, totalTokens } = await geminiService.generateContent({
    contents,
    model: 'flash',
    systemInstruction,
  });

  try {
    await deductCredits(req.user._id, totalTokens || 100, {
      feature: 'library',
      model: 'flash',
    });
  } catch (creditErr) {
    logger.warn({ err: creditErr.message }, 'Credit deduction notice for library ai-write');
  }

  res.status(200).json({
    data: {
      text,
      tokensUsed: totalTokens || 0,
    },
  });
});

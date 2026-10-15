import { Memory } from '../models/Memory.js';
import { generateContent, embedContent } from './gemini.service.js';
import { vectorDbService } from './vectorDb.service.js';
import { MEMORY_EXTRACTION_PROMPT, MEMORY_DECISION_PROMPT } from '../agents/prompts/memory.prompt.js';
import { logger } from '../utils/logger.js';

/**
 * Extracts rule-based quick matches for zero-latency, deterministic memory capture.
 *
 * @param {string} text
 * @returns {{ memories: Array<{ fact: string, category: string, confidence: number }>, forgetRequests: string[] }}
 */
function extractDeterministicMemories(text) {
  const memories = [];
  const forgetRequests = [];
  if (!text || typeof text !== 'string') return { memories, forgetRequests };

  const clean = text.trim();

  // 1. Explicit Forget / delete requests
  const forgetMatch = clean.match(/(?:forget that|forget my|don't remember|do not remember|bhool jao|yaad mat rakhna|delete kar do)\s+([^.!?\n]+)/i);
  if (forgetMatch) {
    forgetRequests.push(forgetMatch[1].trim());
  }

  // 2. Explicit Identity Directives (Direct name introductions)
  let identifiedName = null;

  // Pattern A: "my name is Alice" / "call me Bob"
  const directNameMatch = clean.match(/\b(?:my name is|call me)\s+([A-Za-z]{2,25})\b/i);
  if (directNameMatch) {
    identifiedName = directNameMatch[1].trim();
  }

  // Pattern B (Hindi/Hinglish): "mera naam Shivam hai" / "mera naam Shivam" / "mujhe Shivam bulao"
  if (!identifiedName) {
    const hindiNameMatch =
      clean.match(/\bmera\s+naam\s+([A-Za-z]{2,25})(?:\s+hai|\s+save)?\b/i) ||
      clean.match(/\bmujhe\s+([A-Za-z]{2,25})\s+bulao\b/i);
    if (hindiNameMatch) {
      identifiedName = hindiNameMatch[1].trim();
    }
  }

  // Pattern C: "its Shivam this side"
  if (!identifiedName) {
    const thisSideMatch = clean.match(/\b(?:it'?s|this is)\s+([A-Za-z]{2,25})\s+this side\b/i);
    if (thisSideMatch) {
      identifiedName = thisSideMatch[1].trim();
    }
  }

  const stopwords = /^(an?|the|here|ready|tired|hungry|happy|working|building|first|just|new|not|my|me|so|right|good|true|false|ok|okay|hai|hoon|kya|bhi|toh|aur|ye|yeh|wo|woh|kuch|save)\b/i;
  if (identifiedName && !stopwords.test(identifiedName)) {
    const formattedName = identifiedName.charAt(0).toUpperCase() + identifiedName.slice(1).toLowerCase();
    memories.push({
      fact: `User's name is ${formattedName}`,
      category: 'identity',
      confidence: 0.98,
      key: 'user.name',
    });
  }

  // 3. Explicit instruction: Remember that... / Yaad rakhna... / Save kar lo...
  const rememberMatch = clean.match(/(?:remember that|note that|keep in mind that|yaad rakhna ki|yaad rakhna|save kar lo ki|save kar lo)\s+([^.!?\n]{3,120})/i);
  if (rememberMatch) {
    memories.push({
      fact: `User note: ${rememberMatch[1].trim()}`,
      category: 'instruction',
      confidence: 0.99,
    });
  }

  return { memories, forgetRequests };
}

/**
 * Safely parses JSON response from Gemini for memory extraction.
 *
 * @param {string} rawText
 * @returns {{ memories?: Array<{ fact: string, category: string, confidence: number }>, forgetRequests?: string[] }}
 */
function parseExtractionJson(rawText) {
  if (!rawText) return { memories: [], forgetRequests: [] };
  try {
    const sanitized = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    return JSON.parse(sanitized);
  } catch (err) {
    logger.warn({ error: err.message }, 'Failed to parse Gemini memory extraction JSON');
    return { memories: [], forgetRequests: [] };
  }
}

export const memoryService = {
  /**
   * Retrieves relevant long-term memories for a user, combining core identity memories
   * with vector similarity search for the given context.
   *
   * @param {Object} options
   * @param {string|import('mongoose').Types.ObjectId} options.userId
   * @param {string} [options.query='']
   * @param {number} [options.limit=8]
   * @returns {Promise<Array<import('../models/Memory.js').Memory>>}
   */
  /**
   * Syncs active memory documents from MongoDB into vector store for zero-latency retrieval.
   *
   * @param {string|import('mongoose').Types.ObjectId} [userId] Optional filter by user
   * @returns {Promise<number>} Count of memories loaded into vector store
   */
  async syncActiveMemoryVectors(userId = null) {
    try {
      const filter = { active: true };
      if (userId) filter.userId = userId;
      const memories = await Memory.find(filter);
      return vectorDbService.warmupFromMemories(memories);
    } catch (err) {
      logger.warn({ error: err.message }, 'Failed to sync active memory vectors to vector store');
      return 0;
    }
  },

  /**
   * Retrieves relevant long-term memories for a user, combining core pinned/identity memories
   * with strict vector similarity thresholding and multi-factor ranking.
   * Eliminates random recency backfill.
   *
   * @param {Object} options
   * @param {string|import('mongoose').Types.ObjectId} options.userId
   * @param {string} [options.query='']
   * @param {number} [options.limit=6]
   * @param {string|import('mongoose').Types.ObjectId} [options.projectId=null]
   * @param {number} [options.threshold=0.65]
   * @returns {Promise<Array<import('../models/Memory.js').Memory>>}
   */
  async getRelevantMemories({ userId, query = '', limit = 6, projectId = null, threshold = 0.65 }) {
    if (!userId) return [];

    try {
      // Warm up vector store from MongoDB if empty (e.g. after server boot or reload)
      if (vectorDbService.getLocalStoreSize() === 0) {
        await this.syncActiveMemoryVectors(userId);
      }

      // 1. Fetch pinned and identity memories (Global + Current Project only)
      const priorityScopeFilter = {
        userId,
        active: true,
        $or: [{ pinned: true }, { category: 'identity' }],
        $and: [
          {
            $or: [
              { scope: 'global' },
              { scope: { $exists: false } },
              ...(projectId ? [{ scope: 'project', projectId }] : []),
            ],
          },
        ],
      };

      const priorityMemories = await Memory.find(priorityScopeFilter)
        .sort({ pinned: -1, updatedAt: -1 })
        .limit(4);

      const priorityIds = new Set(priorityMemories.map((m) => m._id.toString()));

      // 2. Fetch context-relevant memories via vector similarity with strict threshold
      const rankedVectorMemories = [];
      if (query && query.trim().length > 3) {
        try {
          const queryEmbedding = await embedContent({ contents: query.trim() });
          if (queryEmbedding && queryEmbedding.length > 0) {
            const matches = await vectorDbService.query({
              values: queryEmbedding,
              topK: limit * 2,
              filter: { userId: userId.toString(), type: 'memory' },
            });

            // Filter by threshold
            const qualifiedMatches = matches.filter(
              (m) => (m.score ?? 0) >= threshold && m.metadata?.refId && !priorityIds.has(m.metadata.refId),
            );

            if (qualifiedMatches.length > 0) {
              const matchedRefIds = qualifiedMatches.map((m) => m.metadata.refId);
              const matchedDocs = await Memory.find({
                _id: { $in: matchedRefIds },
                userId,
                active: true,
                $or: [
                  { scope: 'global' },
                  { scope: { $exists: false } },
                  ...(projectId ? [{ scope: 'project', projectId }] : []),
                ],
              });

              const docMap = new Map(matchedDocs.map((d) => [d._id.toString(), d]));
              const now = Date.now();
              const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

              for (const match of qualifiedMatches) {
                const doc = docMap.get(match.metadata.refId);
                if (doc) {
                  const similarity = match.score ?? 0;
                  const docAge = now - new Date(doc.updatedAt || doc.createdAt).getTime();
                  const recency = Math.max(0, 1 - docAge / thirtyDaysMs);
                  const confidence = doc.confidence ?? 0.9;
                  const pinnedBoost = doc.pinned ? 0.2 : 0;

                  // Weighted score formula: similarity*0.6 + recency*0.2 + confidence*0.1 + pinnedBoost
                  const compositeScore = similarity * 0.6 + recency * 0.2 + confidence * 0.1 + pinnedBoost;
                  rankedVectorMemories.push({ doc, compositeScore });
                }
              }

              rankedVectorMemories.sort((a, b) => b.compositeScore - a.compositeScore);
            }
          }
        } catch (vecErr) {
          logger.warn({ error: vecErr.message }, 'Vector similarity retrieval for memories skipped or failed');
        }

        // 3. Keyword / Lexical Fallback: If vector search found no candidates, check for keyword overlap
        if (rankedVectorMemories.length === 0) {
          const rawTokens = query
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter((w) => w.length >= 4 && !/^(what|when|where|which|about|could|would|should|please|thank|there|their|these|those)\b/i.test(w));

          if (rawTokens.length > 0) {
            const regexPatterns = rawTokens.map((t) => new RegExp(`\\b${t}`, 'i'));
            const lexicalCandidates = await Memory.find({
              userId,
              active: true,
              _id: { $nin: Array.from(priorityIds) },
              $or: regexPatterns.map((p) => ({ fact: p })),
              $and: [
                {
                  $or: [
                    { scope: 'global' },
                    { scope: { $exists: false } },
                    ...(projectId ? [{ scope: 'project', projectId }] : []),
                  ],
                },
              ],
            }).limit(limit - priorityMemories.length);

            for (const lexDoc of lexicalCandidates) {
              rankedVectorMemories.push({ doc: lexDoc, compositeScore: 0.70 });
            }
          }
        }
      }

      // Combine priority memories and threshold-qualified vector memories
      const combinedDocs = [...priorityMemories];
      for (const item of rankedVectorMemories) {
        if (combinedDocs.length >= limit) break;
        if (!priorityIds.has(item.doc._id.toString())) {
          combinedDocs.push(item.doc);
          priorityIds.add(item.doc._id.toString());
        }
      }

      // Update telemetry for retrieved memories (lastUsedAt and useCount)
      if (combinedDocs.length > 0) {
        const retrievedIds = combinedDocs.map((m) => m._id);
        await Memory.updateMany(
          { _id: { $in: retrievedIds } },
          { $set: { lastUsedAt: new Date() }, $inc: { useCount: 1 } },
        ).catch((err) => {
          logger.warn({ error: err.message }, 'Failed to record memory usage telemetry');
        });
      }

      return combinedDocs.slice(0, limit);
    } catch (error) {
      logger.error({ error: error.message, userId }, 'Error retrieving relevant memories');
      return [];
    }
  },

  /**
   * Formats an array of memories into a clear markdown instruction block for Gemini system prompt.
   *
   * @param {Array<import('../models/Memory.js').Memory>} memories
   * @returns {string} Formatted instructions or empty string
   */
  formatMemoriesForPrompt(memories) {
    if (!Array.isArray(memories) || memories.length === 0) {
      return '';
    }

    const items = memories
      .map((m) => `- ${m.fact}`)
      .join('\n');

    return `\n\n[USER LONG-TERM MEMORY (CROSS-CHAT PERSISTENT CONTEXT)]:\nThe following verified facts and preferences have been learned about this user across conversations. Seamlessly incorporate them into your responses without explicitly declaring "According to my memory" unless asked:\n${items}\n`;
  },

  /**
   * Extracts durable user facts from message content and persists them to MongoDB and Vector DB.
   *
   * @param {Object} options
   * @param {string|import('mongoose').Types.ObjectId} options.userId
   * @param {string} options.messageContent - User's message
   * @param {string|import('mongoose').Types.ObjectId} [options.chatId]
   * @param {boolean} [options.isSimulation=false]
   * @returns {Promise<{ extractedCount: number, savedMemories: Array<any> }>}
   */
  /**
   * Extracts durable user facts from message content and persists them to MongoDB and Vector DB
   * using the ADD/UPDATE/DELETE/NONE decision engine with temporal superseding.
   *
   * @param {Object} options
   * @param {string|import('mongoose').Types.ObjectId} options.userId
   * @param {string} options.messageContent - Raw user's message
   * @param {string|import('mongoose').Types.ObjectId} [options.chatId]
   * @param {string|import('mongoose').Types.ObjectId} [options.projectId=null]
   * @param {boolean} [options.isSimulation=false]
   * @param {boolean} [options.isTemporary=false]
   * @returns {Promise<{ extractedCount: number, savedMemories: Array<any>, disabled?: boolean }>}
   */
  async extractAndSaveMemories({
    userId,
    messageContent,
    chatId = null,
    projectId = null,
    isSimulation = false,
    isTemporary = false,
  }) {
    if (!userId || !messageContent || typeof messageContent !== 'string') {
      return { extractedCount: 0, savedMemories: [] };
    }

    // Safety Rule: Don't extract in Temporary chats
    if (isTemporary) {
      return { extractedCount: 0, savedMemories: [], skippedTemporary: true };
    }

    const trimmed = messageContent.trim();
    if (trimmed.length < 3) {
      return { extractedCount: 0, savedMemories: [] };
    }

    // Safety Rule: Filter out sensitive credentials/tokens/secrets unless explicit directive
    const isSensitive =
      /\b(password|passwd|api[_-]?key|secret[_-]?key|access[_-]?token|bearer|card\s*number|cvv|pin\s*code|bank\s*account)\b/i.test(trimmed);
    const hasExplicitRemember = /\b(remember that|save kar lo|yaad rakhna)\b/i.test(trimmed);
    if (isSensitive && !hasExplicitRemember) {
      return { extractedCount: 0, savedMemories: [], skippedSensitive: true };
    }

    // Check user personalization setting for autonomous AI memory learning
    try {
      const { User } = await import('../models/User.js');
      const userDoc = await User.findById(userId).select('settings.personalization');
      if (userDoc?.settings?.personalization?.aiMemoryEnabled === false) {
        return { extractedCount: 0, savedMemories: [], disabled: true };
      }
    } catch {
      // Non-blocking fallback
    }

    try {
      // 1. Run deterministic regex extraction first (explicit remember/forget commands)
      const { memories: deterministicMemories, forgetRequests: deterministicForgets } =
        extractDeterministicMemories(trimmed);

      let rawCandidates = [...deterministicMemories];
      let allForgets = [...deterministicForgets];

      // 2. If not simulation and message might contain personal clues, run AI extraction
      const hasPersonalClues =
        /\b(i am|i'm|my|i like|i prefer|i use|i work|remember|note|call me|building|project|mera|meri|mujhe|main|mai|naam|save|yaad|rakhna|batao|kar lo)\b/i.test(
          trimmed,
        );

      if (!isSimulation && hasPersonalClues) {
        try {
          const aiResult = await generateContent({
            contents: [{ role: 'user', parts: [{ text: `User typed message:\n${trimmed}` }] }],
            model: 'flash',
            systemInstruction: MEMORY_EXTRACTION_PROMPT,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });

          const parsed = parseExtractionJson(aiResult.text);
          if (Array.isArray(parsed.memories)) {
            for (const mem of parsed.memories) {
              if (mem.fact && typeof mem.fact === 'string') {
                const conf = typeof mem.confidence === 'number' ? mem.confidence : 0.9;
                // Safety Rule: Confidence cutoff >= 0.70
                if (conf >= 0.7) {
                  rawCandidates.push({
                    fact: mem.fact.trim(),
                    category: mem.category || 'fact',
                    confidence: conf,
                  });
                }
              }
            }
          }
          if (Array.isArray(parsed.forgetRequests)) {
            allForgets.push(...parsed.forgetRequests);
          }
        } catch (aiErr) {
          logger.warn({ error: aiErr.message }, 'Gemini memory extraction skipped or failed');
        }
      }

      // 3. Process explicit forget requests
      if (allForgets.length > 0) {
        for (const req of allForgets) {
          const safeRegex = new RegExp(req.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const memoriesToDeactivate = await Memory.find({
            userId,
            active: true,
            $or: [{ fact: safeRegex }, { category: safeRegex }],
          });

          for (const m of memoriesToDeactivate) {
            m.active = false;
            m.validTo = new Date();
            await m.save();
            if (m.vectorId) {
              await vectorDbService.remove(m.vectorId);
            }
          }
        }
      }

      if (rawCandidates.length === 0) {
        return { extractedCount: 0, savedMemories: [] };
      }

      // 4. Cap check: Max 200 active memories per user. Prune oldest unpinned low-use memories if exceeded
      const activeCount = await Memory.countDocuments({ userId, active: true });
      if (activeCount >= 200) {
        const excess = activeCount - 195;
        const toPrune = await Memory.find({ userId, active: true, pinned: false })
          .sort({ useCount: 1, createdAt: 1 })
          .limit(excess);
        for (const p of toPrune) {
          p.active = false;
          p.validTo = new Date();
          await p.save();
          if (p.vectorId) await vectorDbService.remove(p.vectorId);
        }
      }

      const savedMemories = [];

      // 5. Reconciliation Decision Loop for each candidate memory
      for (const candidate of rawCandidates) {
        if (!candidate.fact || candidate.fact.length < 4) continue;

        // Fetch top 3-5 existing similar memories to compare
        let similarMemories = [];
        try {
          const candEmbedding = await embedContent({ contents: candidate.fact });
          if (candEmbedding && candEmbedding.length > 0) {
            const matches = await vectorDbService.query({
              values: candEmbedding,
              topK: 4,
              filter: { userId: userId.toString(), type: 'memory' },
            });
            const refIds = matches.map((m) => m.metadata?.refId).filter(Boolean);
            if (refIds.length > 0) {
              similarMemories = await Memory.find({
                _id: { $in: refIds },
                userId,
                active: true,
              });
            }
          }
        } catch {
          // Vector lookup non-blocking
        }

        // Fast-path duplicate check
        const directMatch = similarMemories.find(
          (m) => m.fact.toLowerCase() === candidate.fact.toLowerCase(),
        );
        if (directMatch) {
          directMatch.updatedAt = new Date();
          directMatch.confidence = Math.max(directMatch.confidence, candidate.confidence || 0.9);
          await directMatch.save();
          savedMemories.push(directMatch);
          continue;
        }

        let action = 'ADD';
        let targetId = null;
        let finalFact = candidate.fact;
        let finalCategory = candidate.category || 'fact';
        let finalKey = candidate.key || null;

        // If similar memories exist and not in simulation, invoke Flash Reconciliation
        if (similarMemories.length > 0 && !isSimulation) {
          try {
            const existingContext = similarMemories
              .map((m) => `ID: ${m._id}\nCategory: ${m.category}\nFact: ${m.fact}\nKey: ${m.key || 'none'}`)
              .join('\n---\n');

            const reconciliationPrompt = `Candidate Memory:\nFact: "${candidate.fact}"\nCategory: ${candidate.category}\n\nExisting Similar Active Memories for this user:\n${existingContext}`;

            const reconResult = await generateContent({
              contents: [{ role: 'user', parts: [{ text: reconciliationPrompt }] }],
              model: 'flash',
              systemInstruction: MEMORY_DECISION_PROMPT,
              config: {
                responseMimeType: 'application/json',
                temperature: 0.1,
              },
            });

            const parsedRecon = parseExtractionJson(reconResult.text);
            const decision = parsedRecon?.decisions?.[0];
            if (decision && ['ADD', 'UPDATE', 'DELETE', 'NONE'].includes(decision.action)) {
              action = decision.action;
              targetId = decision.targetMemoryId;
              if (decision.fact) finalFact = decision.fact.trim();
              if (decision.category) finalCategory = decision.category;
              if (decision.key) finalKey = decision.key;
            }
          } catch (reconErr) {
            logger.warn({ error: reconErr.message }, 'Flash memory reconciliation decision fallback');
          }
        }

        // Execute reconciliation decision
        if (action === 'NONE') {
          continue;
        }

        if (action === 'DELETE' && targetId) {
          const targetMem = await Memory.findOne({ _id: targetId, userId, active: true });
          if (targetMem) {
            targetMem.active = false;
            targetMem.validTo = new Date();
            await targetMem.save();
            if (targetMem.vectorId) await vectorDbService.remove(targetMem.vectorId);
          }
          continue;
        }

        if (action === 'UPDATE' && targetId) {
          const targetMem = await Memory.findOne({ _id: targetId, userId, active: true });
          if (targetMem) {
            // Supersede existing memory: mark inactive, set validTo and purge vector
            targetMem.active = false;
            targetMem.validTo = new Date();

            // Create new updated memory
            const updatedMemory = await Memory.create({
              userId,
              fact: finalFact,
              category: finalCategory,
              key: finalKey || targetMem.key,
              confidence: candidate.confidence || 0.95,
              sourceChatId: chatId,
              sourceMessage: trimmed.slice(0, 300),
              scope: projectId ? 'project' : 'global',
              projectId: projectId || null,
              active: true,
              validFrom: new Date(),
            });

            targetMem.supersededBy = updatedMemory._id;
            await targetMem.save();
            if (targetMem.vectorId) {
              await vectorDbService.remove(targetMem.vectorId);
            }

            // Index new memory in vector DB
            try {
              const embedding = await embedContent({ contents: updatedMemory.fact });
              if (embedding && embedding.length > 0) {
                const vectorId = `mem_${updatedMemory._id.toString()}`;
                const indexed = await vectorDbService.upsert({
                  id: vectorId,
                  values: embedding,
                  metadata: {
                    userId: userId.toString(),
                    type: 'memory',
                    category: updatedMemory.category,
                    refId: updatedMemory._id.toString(),
                    scope: updatedMemory.scope,
                    ...(updatedMemory.projectId ? { projectId: updatedMemory.projectId.toString() } : {}),
                  },
                });
                if (indexed) {
                  updatedMemory.vectorId = vectorId;
                  updatedMemory.embedding = embedding;
                  await updatedMemory.save();
                }
              }
            } catch (vecErr) {
              logger.warn({ error: vecErr.message, memoryId: updatedMemory._id }, 'Vector indexing failed');
            }

            savedMemories.push(updatedMemory);
            continue;
          }
        }

        // Action === 'ADD' or fallback
        const newMemory = await Memory.create({
          userId,
          fact: finalFact,
          category: finalCategory,
          key: finalKey,
          confidence: candidate.confidence || 0.9,
          sourceChatId: chatId,
          sourceMessage: trimmed.slice(0, 300),
          scope: projectId ? 'project' : 'global',
          projectId: projectId || null,
          active: true,
          validFrom: new Date(),
        });

        try {
          const embedding = await embedContent({ contents: newMemory.fact });
          if (embedding && embedding.length > 0) {
            const vectorId = `mem_${newMemory._id.toString()}`;
            const indexed = await vectorDbService.upsert({
              id: vectorId,
              values: embedding,
              metadata: {
                userId: userId.toString(),
                type: 'memory',
                category: newMemory.category,
                refId: newMemory._id.toString(),
                scope: newMemory.scope,
                ...(newMemory.projectId ? { projectId: newMemory.projectId.toString() } : {}),
              },
            });
            if (indexed) {
              newMemory.vectorId = vectorId;
              newMemory.embedding = embedding;
              await newMemory.save();
            }
          }
        } catch (vecErr) {
          logger.warn({ error: vecErr.message, memoryId: newMemory._id }, 'Vector indexing error');
        }

        savedMemories.push(newMemory);
      }

      return {
        extractedCount: savedMemories.length,
        savedMemories,
      };
    } catch (err) {
      logger.error({ error: err.message, userId }, 'Error in extractAndSaveMemories');
      return { extractedCount: 0, savedMemories: [] };
    }
  },

  /**
   * Lists all active memories for a user.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<Array<import('../models/Memory.js').Memory>>}
   */
  async listUserMemories(userId) {
    return Memory.find({ userId, active: true }).sort({ pinned: -1, createdAt: -1 });
  },

  /**
   * Manually creates a new user memory from UI.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {Object} data
   * @param {string} data.fact
   * @param {string} [data.category='fact']
   * @param {boolean} [data.pinned=false]
   * @param {string} [data.key=null]
   * @param {'global'|'project'} [data.scope='global']
   * @param {string|null} [data.projectId=null]
   * @returns {Promise<import('../models/Memory.js').Memory>}
   */
  async createManualMemory(userId, { fact, category = 'fact', pinned = false, key = null, scope = 'global', projectId = null }) {
    const memory = await Memory.create({
      userId,
      fact: fact.trim(),
      category,
      pinned,
      key,
      scope,
      projectId: projectId || null,
      confidence: 1.0,
      active: true,
      validFrom: new Date(),
    });

    try {
      const embedding = await embedContent({ contents: memory.fact });
      if (embedding && embedding.length > 0) {
        const vectorId = `mem_${memory._id.toString()}`;
        const indexed = await vectorDbService.upsert({
          id: vectorId,
          values: embedding,
          metadata: {
            userId: userId.toString(),
            type: 'memory',
            category: memory.category,
            refId: memory._id.toString(),
            scope: memory.scope,
            ...(memory.projectId ? { projectId: memory.projectId.toString() } : {}),
          },
        });

        if (indexed) {
          memory.vectorId = vectorId;
          memory.embedding = embedding;
          await memory.save();
        }
      }
    } catch (err) {
      logger.warn({ error: err.message }, 'Vectorization failed for manual memory');
    }

    return memory;
  },

  /**
   * Updates an existing user memory and synchronizes its vector embedding.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {string} memoryId
   * @param {Object} updates
   * @param {string} [updates.fact]
   * @param {string} [updates.category]
   * @param {boolean} [updates.pinned]
   * @param {boolean} [updates.active]
   * @returns {Promise<import('../models/Memory.js').Memory|null>}
   */
  async updateUserMemory(userId, memoryId, updates = {}) {
    const memory = await Memory.findOne({ _id: memoryId, userId });
    if (!memory) return null;

    let factChanged = false;
    if (updates.fact !== undefined && updates.fact.trim() !== memory.fact) {
      memory.fact = updates.fact.trim();
      factChanged = true;
    }
    if (updates.category !== undefined) memory.category = updates.category;
    if (updates.pinned !== undefined) memory.pinned = updates.pinned;
    if (updates.active !== undefined) memory.active = updates.active;
    if (updates.key !== undefined) memory.key = updates.key;
    if (updates.scope !== undefined) memory.scope = updates.scope;
    if (updates.projectId !== undefined) memory.projectId = updates.projectId;

    await memory.save();

    if (factChanged) {
      try {
        const embedding = await embedContent({ contents: memory.fact });
        if (embedding && embedding.length > 0) {
          const vectorId = memory.vectorId || `mem_${memory._id.toString()}`;
          const indexed = await vectorDbService.upsert({
            id: vectorId,
            values: embedding,
            metadata: {
              userId: userId.toString(),
              type: 'memory',
              category: memory.category,
              refId: memory._id.toString(),
              scope: memory.scope,
              ...(memory.projectId ? { projectId: memory.projectId.toString() } : {}),
            },
          });
          if (indexed && !memory.vectorId) {
            memory.vectorId = vectorId;
            await memory.save();
          }
        }
      } catch (vecErr) {
        logger.warn({ error: vecErr.message, memoryId }, 'Failed to re-vectorize memory on update');
      }
    }

    return memory;
  },

  /**
   * Consolidates and optimizes all active memories for a user using Gemini AI.
   * Resolves contradictions, removes duplicates, and merges fragmented notes into high-density facts.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<{ consolidatedCount: number, previousCount?: number, memories: Array<any>, message?: string }>}
   */
  async consolidateUserMemories(userId) {
    if (!userId) return { consolidatedCount: 0, memories: [] };

    const activeMemories = await Memory.find({ userId, active: true }).sort({ pinned: -1, createdAt: -1 });
    if (activeMemories.length < 2) {
      return {
        consolidatedCount: activeMemories.length,
        memories: activeMemories,
        message: 'At least 2 active memories are required to perform AI consolidation.',
      };
    }

    const rawFacts = activeMemories
      .map((m, i) => `${i + 1}. [${m.category}] ${m.fact}${m.pinned ? ' (PINNED)' : ''}`)
      .join('\n');

    const prompt = `You are NexAI's Memory Consolidation & Optimization Agent.
Analyze the following list of active memories for a single user. Perform comprehensive consolidation:
1. De-duplicate identical or overlapping statements.
2. Resolve contradictions (e.g. if user changed location, company, or preferred tool, retain only the newest/clearest state).
3. Synthesize fragmented points (e.g., "User uses React" and "User uses TypeScript" -> "User develops using React with TypeScript").
4. Keep core user identity facts (Name, Role, Location) intact.
5. Retain any explicit directives or pinned instructions.
6. Return a concise, high-density list of facts written clearly in the third person (e.g. "User's name is Alice").

Raw Memories:
${rawFacts}

You MUST return a JSON object strictly matching this schema:
{
  "consolidated": [
    {
      "fact": "Consolidated third-person factual statement",
      "category": "identity" | "preference" | "project" | "instruction" | "fact",
      "pinned": boolean
    }
  ]
}

Respond ONLY with valid raw JSON without markdown formatting.`;

    try {
      const aiResult = await generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        model: 'flash',
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const parsed = parseExtractionJson(aiResult.text);
      if (!parsed || !Array.isArray(parsed.consolidated) || parsed.consolidated.length === 0) {
        return {
          consolidatedCount: activeMemories.length,
          memories: activeMemories,
          message: 'Consolidation did not produce any changes.',
        };
      }

      // Deactivate existing active memories and remove old vectors
      for (const m of activeMemories) {
        m.active = false;
        await m.save();
        if (m.vectorId) {
          await vectorDbService.remove(m.vectorId);
        }
      }

      // Insert the consolidated memories
      const newMemories = [];
      for (const item of parsed.consolidated) {
        if (!item.fact || item.fact.length < 3) continue;

        const created = await Memory.create({
          userId,
          fact: item.fact.trim(),
          category: item.category || 'fact',
          pinned: !!item.pinned,
          confidence: 1.0,
          active: true,
        });

        try {
          const embedding = await embedContent({ contents: created.fact });
          if (embedding && embedding.length > 0) {
            const vectorId = `mem_${created._id.toString()}`;
            const indexed = await vectorDbService.upsert({
              id: vectorId,
              values: embedding,
              metadata: {
                userId: userId.toString(),
                type: 'memory',
                category: created.category,
                refId: created._id.toString(),
              },
            });
            if (indexed) {
              created.vectorId = vectorId;
              await created.save();
            }
          }
        } catch (vecErr) {
          logger.warn({ error: vecErr.message, memoryId: created._id }, 'Vector indexing error in consolidation');
        }

        newMemories.push(created);
      }

      return {
        consolidatedCount: newMemories.length,
        previousCount: activeMemories.length,
        memories: newMemories,
        message: `Successfully consolidated ${activeMemories.length} memories into ${newMemories.length} optimized knowledge items.`,
      };
    } catch (err) {
      logger.error({ error: err.message, userId }, 'Memory consolidation failed');
      return {
        consolidatedCount: activeMemories.length,
        memories: activeMemories,
        error: 'AI consolidation encountered an error. Existing memories were kept unchanged.',
      };
    }
  },

  /**
   * Deletes a memory and removes it from the vector database.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @param {string} memoryId
   * @returns {Promise<boolean>}
   */
  async deleteUserMemory(userId, memoryId) {
    const memory = await Memory.findOne({ _id: memoryId, userId });
    if (!memory) return false;

    if (memory.vectorId) {
      await vectorDbService.remove(memory.vectorId);
    }
    await memory.deleteOne();
    return true;
  },

  /**
   * Clears all memories for a user.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<number>}
   */
  async clearAllUserMemories(userId) {
    const memories = await Memory.find({ userId });
    for (const m of memories) {
      if (m.vectorId) {
        await vectorDbService.remove(m.vectorId);
      }
    }
    const result = await Memory.deleteMany({ userId });
    return result.deletedCount || 0;
  },

  /**
   * Backfills memories for a user by scanning past chat history.
   *
   * @param {string|import('mongoose').Types.ObjectId} userId
   * @returns {Promise<number>}
   */
  async backfillUserMemories(userId) {
    if (!userId) return 0;
    try {
      const { Chat } = await import('../models/Chat.js');
      const { Message } = await import('../models/Message.js');

      const userChats = await Chat.find({ userId }).select('_id');
      const chatIds = userChats.map((c) => c._id);
      if (chatIds.length === 0) return 0;

      const pastMessages = await Message.find({
        chatId: { $in: chatIds },
        role: 'user',
      })
        .sort({ createdAt: 1 })
        .limit(20);

      let totalBackfilled = 0;
      for (const msg of pastMessages) {
        if (msg.content && msg.content.length > 5) {
          const res = await this.extractAndSaveMemories({
            userId,
            messageContent: msg.content,
            chatId: msg.chatId,
            isSimulation: false,
          });
          totalBackfilled += res.extractedCount;
        }
      }

      return totalBackfilled;
    } catch (err) {
      logger.warn({ error: err.message, userId }, 'Failed to backfill memories from history');
      return 0;
    }
  },
};

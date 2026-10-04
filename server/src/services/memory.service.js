import { Memory } from '../models/Memory.js';
import { generateContent, embedContent } from './gemini.service.js';
import { vectorDbService } from './vectorDb.service.js';
import { MEMORY_EXTRACTION_PROMPT } from '../agents/prompts/memory.prompt.js';
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

  // 1. Forget / delete requests
  const forgetMatch = clean.match(/(?:forget that|forget my|don't remember|do not remember|bhool jao|yaad mat rakhna|delete kar do)\s+([^.!?\n]+)/i);
  if (forgetMatch) {
    forgetRequests.push(forgetMatch[1].trim());
  }

  // 2. Identity: Name
  let identifiedName = null;

  // Pattern A: "its shivam this side" / "it's shivam here"
  const thisSideMatch = clean.match(/\b(?:it'?s|this is)\s+([A-Za-z]{2,25})\s+this side\b/i);
  if (thisSideMatch) {
    identifiedName = thisSideMatch[1].trim();
  }

  // Pattern B: "hello ... its shivam" / "hi, i am shivam"
  if (!identifiedName) {
    const greetingMatch = clean.match(/(?:hello|hi|hey|greetings)[^.!?\n]*\b(?:it'?s|this is|i'?m|i am)\s+([A-Za-z]{2,25})\b/i);
    if (greetingMatch) {
      identifiedName = greetingMatch[1].trim();
    }
  }

  // Pattern C: "my name is Alice" / "call me Bob" / "i am called Charlie"
  if (!identifiedName) {
    const directNameMatch = clean.match(/\b(?:my name is|call me|i am called|i'm called)\s+([A-Za-z]{2,25})\b/i);
    if (directNameMatch) {
      identifiedName = directNameMatch[1].trim();
    }
  }

  // Pattern D (Hindi/Hinglish): "mera naam shivam hai" / "mera naam shivam" / "mera naam ... save kar lo"
  if (!identifiedName) {
    const hindiNameMatch =
      clean.match(/\b(?:mera\s+naam|naam\s+mera)\s+(?:hai\s+)?([A-Za-z]{2,25})\b/i) ||
      clean.match(/\bmera\s+naam\s+([A-Za-z]{2,25})\s*(?:hai|save)?\b/i);
    if (hindiNameMatch) {
      identifiedName = hindiNameMatch[1].trim();
    }
  }

  // Pattern E (Hindi/Hinglish): "mujhe shivam bulao" / "main shivam hoon"
  if (!identifiedName) {
    const mujheMatch =
      clean.match(/\b(?:mujhe)\s+([A-Za-z]{2,25})\s+(?:bulao|kehte)\b/i) ||
      clean.match(/\b(?:main|mai)\s+([A-Za-z]{2,25})\s+hoon\b/i);
    if (mujheMatch) {
      identifiedName = mujheMatch[1].trim();
    }
  }

  const stopwords = /^(an?|the|here|ready|tired|hungry|happy|working|building|first|just|new|not|my|me|so|right|good|true|false|ok|okay|hai|hoon|kya|bhi|toh|aur|ye|yeh|wo|woh|kuch|save)\b/i;
  if (identifiedName && !stopwords.test(identifiedName)) {
    const formattedName = identifiedName.charAt(0).toUpperCase() + identifiedName.slice(1).toLowerCase();
    memories.push({
      fact: `User's name is ${formattedName}`,
      category: 'identity',
      confidence: 0.98,
    });
  }

  // 3. Identity: Profession / Role
  const roleMatch = clean.match(/(?:i work as an?|i am an?|i'm an?)\s+([A-Za-z0-9\s-]{3,40}(?:developer|engineer|designer|manager|student|founder|architect|creator|freelancer))/i);
  if (roleMatch) {
    memories.push({
      fact: `User works as ${roleMatch[1].trim()}`,
      category: 'identity',
      confidence: 0.95,
    });
  }

  // 4. Project: Building something or working on a project/capstone
  const projectMatch = clean.match(/\b(?:my project|capstone project|working on|building)\s+(?:is\s+)?([^.,!?\n]{3,60})/i);
  if (projectMatch) {
    memories.push({
      fact: `User is working on ${projectMatch[1].trim()}`,
      category: 'project',
      confidence: 0.9,
    });
  }

  // 5. Explicit instruction: Remember that... / Yaad rakhna... / Save kar lo...
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
  async getRelevantMemories({ userId, query = '', limit = 8 }) {
    if (!userId) return [];

    try {
      // Auto-backfill memories from past chat messages if user has none recorded yet
      const existingCount = await Memory.countDocuments({ userId, active: true });
      if (existingCount === 0) {
        await this.backfillUserMemories(userId);
      }

      // 1. Fetch pinned and identity memories (always highest priority context)
      const priorityMemories = await Memory.find({
        userId,
        active: true,
        $or: [{ pinned: true }, { category: 'identity' }],
      })
        .sort({ pinned: -1, updatedAt: -1 })
        .limit(4);

      const priorityIds = new Set(priorityMemories.map((m) => m._id.toString()));

      // 2. Fetch context-relevant memories via vector similarity if query is present
      const vectorMemoryList = [];
      if (query && query.trim().length > 3) {
        try {
          const queryEmbedding = await embedContent({ contents: query.trim() });
          if (queryEmbedding && queryEmbedding.length > 0) {
            const matches = await vectorDbService.query({
              values: queryEmbedding,
              topK: limit,
              filter: { userId: userId.toString(), type: 'memory' },
            });

            const matchedRefIds = matches
              .map((m) => m.metadata?.refId)
              .filter((id) => id && !priorityIds.has(id));

            if (matchedRefIds.length > 0) {
              const matchedDocs = await Memory.find({
                _id: { $in: matchedRefIds },
                userId,
                active: true,
              });

              // Maintain score order from vector matches
              const docMap = new Map(matchedDocs.map((d) => [d._id.toString(), d]));
              for (const refId of matchedRefIds) {
                const found = docMap.get(refId);
                if (found) {
                  vectorMemoryList.push(found);
                }
              }
            }
          }
        } catch (vecErr) {
          logger.warn({ error: vecErr.message }, 'Vector similarity retrieval for memories failed; falling back to recent');
        }
      }

      // 3. If we still need more context, fetch recent active memories
      const currentCombined = [...priorityMemories, ...vectorMemoryList];
      const seenIds = new Set(currentCombined.map((m) => m._id.toString()));

      if (currentCombined.length < limit) {
        const remainingLimit = limit - currentCombined.length;
        const recentDocs = await Memory.find({
          userId,
          active: true,
          _id: { $nin: Array.from(seenIds) },
        })
          .sort({ updatedAt: -1 })
          .limit(remainingLimit);

        currentCombined.push(...recentDocs);
      }

      return currentCombined.slice(0, limit);
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
  async extractAndSaveMemories({ userId, messageContent, chatId = null, isSimulation = false }) {
    if (!userId || !messageContent || typeof messageContent !== 'string') {
      return { extractedCount: 0, savedMemories: [] };
    }

    const trimmed = messageContent.trim();
    if (trimmed.length < 3) {
      return { extractedCount: 0, savedMemories: [] };
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
      // 1. Run deterministic regex extraction first (fast & reliable)
      const { memories: deterministicMemories, forgetRequests: deterministicForgets } =
        extractDeterministicMemories(trimmed);

      let allCandidates = [...deterministicMemories];
      let allForgets = [...deterministicForgets];

      // 2. If not simulation and message might contain personal context, run AI extraction
      const hasPersonalClues =
        /\b(i am|i'm|my|i like|i prefer|i use|i work|remember|note|call me|building|project|mera|meri|mujhe|main|mai|naam|save|yaad|rakhna|batao|kar lo)\b/i.test(trimmed);

      if (!isSimulation && hasPersonalClues) {
        try {
          const aiResult = await generateContent({
            contents: [{ role: 'user', parts: [{ text: `User message:\n${trimmed}` }] }],
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
                allCandidates.push({
                  fact: mem.fact.trim(),
                  category: mem.category || 'fact',
                  confidence: typeof mem.confidence === 'number' ? mem.confidence : 0.9,
                });
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

      // 3. Process forget requests
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
            await m.save();
            if (m.vectorId) {
              await vectorDbService.remove(m.vectorId);
            }
          }
        }
      }

      // 4. Save and index candidate memories
      const savedMemories = [];

      for (const candidate of allCandidates) {
        if (!candidate.fact || candidate.fact.length < 4) continue;

        // Check for existing duplicate fact
        const existing = await Memory.findOne({
          userId,
          fact: { $regex: new RegExp(`^${candidate.fact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        });

        if (existing) {
          existing.active = true;
          existing.confidence = Math.max(existing.confidence, candidate.confidence || 0.9);
          existing.updatedAt = new Date();
          await existing.save();
          savedMemories.push(existing);
          continue;
        }

        // If updating a core identity aspect (e.g. name), deactivate outdated names
        if (candidate.category === 'identity' && candidate.fact.toLowerCase().startsWith("user's name is")) {
          const oldNames = await Memory.find({
            userId,
            active: true,
            fact: { $regex: /^user's name is/i },
          });
          for (const old of oldNames) {
            old.active = false;
            await old.save();
            if (old.vectorId) await vectorDbService.remove(old.vectorId);
          }
        }

        // Create new memory document
        const newMemory = await Memory.create({
          userId,
          fact: candidate.fact,
          category: candidate.category || 'fact',
          confidence: candidate.confidence || 0.9,
          sourceChatId: chatId,
          sourceMessage: trimmed.slice(0, 300),
          active: true,
        });

        // Index in vector DB
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
              },
            });

            if (indexed) {
              newMemory.vectorId = vectorId;
              await newMemory.save();
            }
          }
        } catch (vecErr) {
          logger.warn({ error: vecErr.message, memoryId: newMemory._id }, 'Failed to vectorize memory');
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
   * @returns {Promise<import('../models/Memory.js').Memory>}
   */
  async createManualMemory(userId, { fact, category = 'fact', pinned = false }) {
    const memory = await Memory.create({
      userId,
      fact: fact.trim(),
      category,
      pinned,
      confidence: 1.0,
      active: true,
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
          },
        });

        if (indexed) {
          memory.vectorId = vectorId;
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

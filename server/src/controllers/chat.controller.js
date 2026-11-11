import { Chat } from '../models/Chat.js';
import { Project } from '../models/Project.js';
import { Message } from '../models/Message.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { setupSse, sendSse, closeSse } from '../utils/sse.js';
import { streamChatReply, generateChatTitle } from '../agents/chat.agent.js';
import { streamChatSimulation } from '../utils/chatSimulator.js';
import { deductCredits } from '../services/credit.service.js';
import { memoryService } from '../services/memory.service.js';
import * as skillService from '../services/skill.service.js';
import { systemConfigService } from '../services/systemConfig.service.js';
import { logger } from '../utils/logger.js';

/**
 * Returns all chats for the authenticated user, ordered by most recently updated.
 * GET /api/chats
 */
export const getChats = asyncHandler(async (req, res) => {
  const filter = { userId: req.user._id, isTemporary: { $ne: true } };
  if (req.query.projectId) {
    filter.projectId = req.query.projectId;
  }
  const chats = await Chat.find(filter).sort({ updatedAt: -1 });
  res.status(200).json({ data: chats });
});

/**
 * Creates a new chat session for the authenticated user.
 * POST /api/chats
 */
export const createChat = asyncHandler(async (req, res) => {
  const { title, projectId, isTemporary } = req.body;
  const chat = await Chat.create({
    userId: req.user._id,
    title: title || (isTemporary ? 'Temporary Chat' : 'New Chat'),
    projectId: projectId || null,
    isTemporary: Boolean(isTemporary),
  });
  res.status(201).json({ data: chat });
});

/**
 * Updates an existing chat session (title, projectId, pinned).
 * PATCH /api/chats/:id
 */
export const updateChat = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, projectId, pinned } = req.body;

  const chat = await Chat.findOne({ _id: id, userId: req.user._id });
  if (!chat) {
    throw new ApiError(404, 'CHAT_NOT_FOUND', 'Chat conversation not found');
  }

  if (title !== undefined) chat.title = title;
  if (projectId !== undefined) chat.projectId = projectId;
  if (pinned !== undefined) chat.pinned = pinned;

  await chat.save();

  res.status(200).json({ data: chat });
});

/**
 * Deletes a chat session and all associated messages.
 * DELETE /api/chats/:id
 */
export const deleteChat = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const chat = await Chat.findOne({ _id: id, userId: req.user._id });
  if (!chat) {
    throw new ApiError(404, 'CHAT_NOT_FOUND', 'Chat conversation not found');
  }

  await Message.deleteMany({ chatId: chat._id });
  await chat.deleteOne();

  res.status(200).json({ data: { message: 'Chat deleted successfully' } });
});

/**
 * Retrieves all messages within a specific chat.
 * GET /api/chats/:id/messages
 */
export const getMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const chat = await Chat.findOne({ _id: id, userId: req.user._id });
  if (!chat) {
    throw new ApiError(404, 'CHAT_NOT_FOUND', 'Chat conversation not found');
  }

  const messages = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 });
  res.status(200).json({ data: messages });
});

/**
 * Sends a message in a chat and streams the AI assistant response via SSE.
 * POST /api/chats/:id/messages
 */
export async function sendMessage(req, res, next) {
  const { id } = req.params;
  const {
    content,
    model: requestedModel,
    thinkingLevel = 'off',
    isSimulation = false,
    attachments = [],
    skillId = null,
    enabledTools = [],
  } = req.body;
  const model = requestedModel || req.user.settings?.defaultModel || 'flash';
  const isSimulationMode =
    isSimulation === true ||
    req.query.simulation === 'true' ||
    req.headers['x-simulation'] === 'true';

  let sseStarted = false;

  try {
    const chat = await Chat.findOne({ _id: id, userId: req.user._id });
    if (!chat) {
      throw new ApiError(404, 'CHAT_NOT_FOUND', 'Chat conversation not found');
    }

    // Save incoming user message
    await Message.create({
      chatId: chat._id,
      role: 'user',
      content,
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    // Handle Zero-Token Simulation Mode for testing and offline demos
    if (isSimulationMode) {
      if (chat.title === 'New Chat') {
        chat.title = content.slice(0, 32).trim() || 'Simulated Session';
        await chat.save();
      }

      setupSse(res);
      sseStarted = true;

      let isClientConnected = true;
      req.on('close', () => {
        isClientConnected = false;
      });

      // Retrieve relevant user long-term memories across chats with project scope awareness
      const memories = await memoryService.getRelevantMemories({
        userId: req.user._id,
        query: content,
        limit: 6,
        projectId: chat.projectId,
      });

      let simSkill = null;
      const simSteps = [];
      let simGrounding = null;

      if (skillId) {
        try {
          simSkill = await skillService.getSkillById(req.user._id, skillId);
          if (simSkill?.tools?.includes('web_search')) {
            const stepObj = {
              id: 'sim-step-1',
              type: 'tool_call',
              tool: 'web_search',
              title: `Searched web: "${content.slice(0, 40)}"`,
              status: 'completed',
              input: { query: content.slice(0, 40) },
              output: { resultsFound: 3 },
            };
            simSteps.push(stepObj);
            simGrounding = {
              webSearchQueries: [content.slice(0, 40)],
              sources: [
                { title: 'Developer & Web Standards Documentation', url: 'https://developer.mozilla.org' },
                { title: 'NexAI Architecture & Knowledge Base', url: 'https://nexai.dev/docs' },
              ],
            };
            sendSse(res, 'step', stepObj);
            sendSse(res, 'grounding', simGrounding);
          }
        } catch {
          // ignore lookup error in simulation
        }
      }

      const simResult = await streamChatSimulation({
        res,
        prompt: content,
        attachments,
        memories,
        thinkingLevel,
        isClientConnected: () => isClientConnected,
      });

      const assistantMessage = await Message.create({
        chatId: chat._id,
        role: 'assistant',
        content: simResult.fullText,
        thoughts: simResult.thoughts || '',
        tokensUsed: 0,
        skillId: simSkill ? simSkill._id : null,
        steps: simSteps,
        groundingMetadata: simGrounding,
      });

      chat.updatedAt = new Date();
      await chat.save();

      let simMemoriesUpdated = [];
      if (!chat.isTemporary) {
        try {
          const memResult = await memoryService.extractAndSaveMemories({
            userId: req.user._id,
            messageContent: content,
            chatId: chat._id,
            isSimulation: true,
          });
          if (memResult.savedMemories && memResult.savedMemories.length > 0) {
            simMemoriesUpdated = memResult.savedMemories.map((m) => ({
              id: m._id.toString(),
              fact: m.fact,
              category: m.category,
              action: 'saved',
            }));
            sendSse(res, 'memory_updated', { memories: simMemoriesUpdated });
          }
        } catch (memErr) {
          logger.warn({ error: memErr.message }, 'Simulation memory extraction warning');
        }
      }

      if (simMemoriesUpdated.length > 0) {
        assistantMessage.memoriesUpdated = simMemoriesUpdated;
        await assistantMessage.save();
      }

      const currentCredits = req.user.wallet?.creditsRemaining ?? 0;
      const governance = await systemConfigService.getPublicGovernanceStatus().catch(() => null);

      sendSse(res, 'done', {
        messageId: assistantMessage._id.toString(),
        tokensUsed: 0,
        creditsDeducted: 0,
        creditsRemaining: currentCredits,
        chatTitle: chat.title,
        thoughts: simResult.thoughts || '',
        followUps: simResult.followUps,
        steps: simSteps,
        groundingMetadata: simGrounding,
        skillId: simSkill ? simSkill._id.toString() : null,
        isSimulation: true,
        memoriesUpdated: simMemoriesUpdated,
        ...(governance ? { governance } : {}),
      });

      closeSse(res);
      return;
    }

    // Check if chat is still using default title to auto-generate title via Gemini
    const existingMessagesCount = await Message.countDocuments({ chatId: chat._id });
    if (chat.title === 'New Chat' || existingMessagesCount <= 1) {
      const titleResult = await generateChatTitle({
        firstMessage: content,
        userId: req.user._id.toString(),
      });
      chat.title = titleResult.title;
      await chat.save();
    }

    // Initialize SSE connection
    setupSse(res);
    sseStarted = true;

    let isClientConnected = true;
    req.on('close', () => {
      isClientConnected = false;
    });

    // Load full message history for context
    const history = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 });

    // Retrieve relevant long-term memories for this user with strict threshold & project scope
    const memories = await memoryService.getRelevantMemories({
      userId: req.user._id,
      query: content,
      limit: 6,
      projectId: chat.projectId,
    });

    // If chat belongs to a project, inject project custom instructions and sources
    let customInstructions = '';
    let projectSources = [];
    if (chat.projectId) {
      const project = await Project.findOne({ _id: chat.projectId, userId: req.user._id });
      if (project?.customInstructions) {
        customInstructions = project.customInstructions;
      }
      if (project?.sources && project.sources.length > 0) {
        projectSources = project.sources;
      }
    }

    let activeSkill = null;
    if (skillId) {
      try {
        activeSkill = await skillService.getSkillById(req.user._id, skillId);
      } catch (skillErr) {
        logger.warn({ error: skillErr.message, skillId }, 'Active skill lookup ignored');
      }
    }

    let fullText = '';
    let thoughts = '';
    let tokensUsed = 0;
    const recordedSteps = [];
    let recordedGrounding = null;

    const toolExecutionMode = req.user.settings?.toolExecutionMode || 'auto';
    let resolvedTools = Array.isArray(enabledTools) ? enabledTools : [];
    if (resolvedTools.length === 0 && !activeSkill && toolExecutionMode !== 'manual') {
      resolvedTools = ['web_search', 'fetch_url', 'workspace_search'];
    }

    const stream = streamChatReply({
      messages: history,
      model,
      thinkingLevel,
      customInstructions,
      sources: projectSources,
      memories,
      personalization: req.user.settings?.personalization,
      skill: activeSkill,
      enabledTools: resolvedTools,
      toolExecutionMode,
      context: { userId: req.user._id, projectId: chat.projectId },
    });

    for await (const chunk of stream) {
      if (!isClientConnected) {
        break;
      }

      if (chunk.step) {
        recordedSteps.push(chunk.step);
        sendSse(res, 'step', chunk.step);
      }

      if (chunk.groundingMetadata) {
        recordedGrounding = chunk.groundingMetadata;
        sendSse(res, 'grounding', chunk.groundingMetadata);
      }

      if (chunk.thought) {
        thoughts += chunk.thought;
        sendSse(res, 'thought', { text: chunk.thought });
      }

      if (chunk.text) {
        fullText += chunk.text;
        sendSse(res, 'token', { text: chunk.text });
      }

      if (chunk.usageMetadata) {
        const count =
          chunk.usageMetadata.totalTokenCount ??
          (chunk.usageMetadata.promptTokenCount || 0) +
            (chunk.usageMetadata.candidatesTokenCount || 0);
        if (count > 0) {
          tokensUsed = count;
        }
      }
    }

    // Fallback estimation if API did not return token metrics
    if (tokensUsed <= 0) {
      const totalChars =
        history.reduce((sum, m) => sum + (m.content?.length || 0), 0) + fullText.length;
      tokensUsed = Math.max(1, Math.ceil(totalChars / 4));
    }

    // Save assistant message with steps and grounding citations
    const assistantMessage = await Message.create({
      chatId: chat._id,
      role: 'assistant',
      content: fullText,
      thoughts,
      tokensUsed,
      skillId: activeSkill ? activeSkill._id : null,
      steps: recordedSteps,
      groundingMetadata: recordedGrounding,
    });

    // Update chat timestamp
    chat.updatedAt = new Date();
    await chat.save();

    // Extract and learn persistent user facts/memories from conversation (skip for temporary chats)
    let liveMemoriesUpdated = [];
    if (!chat.isTemporary) {
      try {
        const memResult = await memoryService.extractAndSaveMemories({
          userId: req.user._id,
          messageContent: content,
          chatId: chat._id,
          projectId: chat.projectId,
          isSimulation: false,
          isTemporary: Boolean(chat.isTemporary),
        });
        if (memResult.savedMemories && memResult.savedMemories.length > 0) {
          liveMemoriesUpdated = memResult.savedMemories.map((m) => ({
            id: m._id.toString(),
            fact: m.fact,
            category: m.category,
            action: 'saved',
          }));
          sendSse(res, 'memory_updated', { memories: liveMemoriesUpdated });
        }
      } catch (memErr) {
        logger.warn({ error: memErr.message }, 'Background memory extraction warning');
      }
    }

    if (liveMemoriesUpdated.length > 0) {
      assistantMessage.memoriesUpdated = liveMemoriesUpdated;
      await assistantMessage.save();
    }

    // Deduct credits atomically and record UsageLog
    const deduction = await deductCredits({
      userId: req.user._id,
      tokensUsed,
      feature: 'chat',
      model,
    });

    const governance = await systemConfigService.getPublicGovernanceStatus().catch(() => null);

    // Send final done event with metrics, agent steps, and grounding metadata
    sendSse(res, 'done', {
      messageId: assistantMessage._id.toString(),
      tokensUsed,
      creditsDeducted: deduction.creditsDeducted,
      creditsRemaining: deduction.creditsRemaining,
      chatTitle: chat.title,
      thoughts,
      steps: recordedSteps,
      groundingMetadata: recordedGrounding,
      skillId: activeSkill ? activeSkill._id.toString() : null,
      memoriesUpdated: liveMemoriesUpdated,
      ...(governance ? { governance } : {}),
    });

    closeSse(res);
  } catch (error) {
    logger.error({ error: error.message }, 'Error in sendMessage SSE handler');

    const cleanMessage =
      error.message?.includes('high demand') ||
      error.message?.includes('503') ||
      error.message?.includes('UNAVAILABLE')
        ? 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again in a few moments.'
        : error.message || 'An error occurred while streaming response';

    if (sseStarted) {
      sendSse(res, 'error', {
        code: error.code || 'STREAM_ERROR',
        message: cleanMessage,
      });
      closeSse(res);
    } else {
      next(error);
    }
  }
}

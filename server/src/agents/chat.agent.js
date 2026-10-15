import { streamContent, generateContent } from '../services/gemini.service.js';
import { deductCredits } from '../services/credit.service.js';
import { buildGeminiToolsConfig, executeAgentTool } from '../services/tools.service.js';
import { CHAT_SYSTEM_PROMPT, TITLE_SYSTEM_PROMPT } from './prompts/chat.prompt.js';
import { getModelName } from '../config/gemini.js';
import { logger } from '../utils/logger.js';

const MAX_HISTORY_MESSAGES = 20;

/**
 * Builds thinking configuration based on user preference and model capability.
 * Follows official Google GenAI thinkingConfig documentation for Gemini 2.5 and 3.
 *
 * @param {Object} params
 * @param {'off' | 'low' | 'medium' | 'high'} [params.thinkingLevel='off']
 * @param {'flash' | 'pro'} [params.model='flash']
 * @returns {Record<string, unknown> | undefined}
 */
export function buildThinkingConfig({ thinkingLevel = 'off', model = 'flash' }) {
  if (!thinkingLevel || thinkingLevel === 'off') {
    return undefined;
  }

  const modelName = getModelName(model).toLowerCase();
  const level = thinkingLevel.toLowerCase();

  const isGemini3 = modelName.includes('3') || modelName.includes('gemini-3');

  if (isGemini3) {
    return {
      includeThoughts: true,
      thinkingLevel: level,
    };
  }

  const budgetMap = {
    low: 1024,
    medium: 4096,
    high: 8192,
  };

  return {
    includeThoughts: true,
    thinkingBudget: budgetMap[level] ?? -1,
  };
}

/**
 * Normalizes database messages into the contents structure expected by Google GenAI.
 * Formats roles ('user' -> 'user', 'assistant' -> 'model') and ensures valid turn order.
 *
 * @param {Array<{role: string, content: string}>} rawMessages
 * @returns {Array<{role: 'user' | 'model', parts: Array<{text: string}>}>}
 */
export function formatConversationHistory(rawMessages) {
  // Take last N messages
  const sliced = rawMessages.slice(-MAX_HISTORY_MESSAGES);

  // Find first user message to guarantee conversation starts with a user turn
  const firstUserIdx = sliced.findIndex((m) => m.role === 'user');
  const validMessages = firstUserIdx >= 0 ? sliced.slice(firstUserIdx) : sliced;

  return validMessages.map((msg) => {
    const parts = [{ text: msg.content || '' }];

    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (att.data && att.mimeType) {
          const base64Data = att.data.includes('base64,')
            ? att.data.split('base64,')[1]
            : att.data;
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: base64Data,
            },
          });
        }
      }
    }

    return {
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  });
}

/**
 * Initiates streaming response from Gemini for a chat conversation.
 *
 * @param {Object} options
 * @param {Array<{role: string, content: string}>} options.messages - Raw history
 * @param {'flash' | 'pro'} [options.model='flash'] - Model selection
 * @param {'off' | 'low' | 'medium' | 'high'} [options.thinkingLevel='off'] - Reasoning level
 * @param {string} [options.customInstructions=''] - Custom project or user instructions
 * @param {Array<{name: string, content: string, mimeType?: string}>} [options.sources=[]] - Project sources
 * @param {Array<any>} [options.memories=[]] - Retrieved long-term user memories
 * @param {Object} [options.personalization] - User global personalization settings
 * @returns {AsyncGenerator<{text: string, thought?: string, usageMetadata: any}, void, unknown>}
 */
export async function* streamChatReply({
  messages,
  model = 'flash',
  thinkingLevel = 'off',
  customInstructions = '',
  sources = [],
  memories = [],
  personalization,
  skill = null,
  enabledTools = [],
  toolExecutionMode = 'auto',
  context = {},
}) {
  const contents = formatConversationHistory(messages);

  let systemInstruction = CHAT_SYSTEM_PROMPT;

  // 1. Inject autonomous tool capabilities if active
  if (!skill && enabledTools.length > 0) {
    systemInstruction += `\n\n[AUTONOMOUS TOOL CAPABILITY]:\nYou have real-time access to tools: ${enabledTools.join(', ')}. When user inquiries require live information, up-to-date facts, URL reading, or project searches, autonomously invoke the appropriate tool.`;
  }

  // 2. Inject global user personalization directives if configured
  if (personalization?.customInstructions && personalization.customInstructions.trim()) {
    systemInstruction += `\n\n[USER GLOBAL CUSTOM INSTRUCTIONS]:\nThe user has provided the following global directives that must be honored across all conversations:\n${personalization.customInstructions.trim()}`;
  }

  if (personalization?.responseTone && personalization.responseTone !== 'default') {
    const toneMap = {
      concise: 'Be extremely concise, direct, and succinct. Output solutions and code immediately with minimal preamble or pleasantries.',
      detailed: 'Be thorough and comprehensive. Include architectural rationale, tradeoffs, and detailed breakdowns.',
      technical: 'Adopt a senior staff engineer persona. Prioritize technical rigor, performance, security, and edge-case resilience.',
      casual: 'Adopt an approachable, friendly, and collaborative peer tone while maintaining technical accuracy.',
    };
    if (toneMap[personalization.responseTone]) {
      systemInstruction += `\n\n[USER PREFERRED RESPONSE TONE]:\n${toneMap[personalization.responseTone]}`;
    }
  }

  // 2. Inject active Skill system instructions if present
  if (skill?.instructions && skill.instructions.trim()) {
    systemInstruction += `\n\n[ACTIVE AGENT SKILL: ${skill.title}]:\nYou are operating with the specialized skill "${skill.title}". Follow these core directives:\n${skill.instructions.trim()}`;
  }

  // 3. Inject project-level custom instructions
  if (customInstructions && customInstructions.trim()) {
    systemInstruction += `\n\n[PROJECT CUSTOM INSTRUCTIONS]:\nFollow these custom project instructions for all responses:\n${customInstructions.trim()}`;
  }

  if (Array.isArray(sources) && sources.length > 0) {
    const formattedSources = sources
      .map((s, idx) => {
        const fileHeading = `--- SOURCE ${idx + 1}: ${s.name || s.originalName || 'Document'} (${s.mimeType || 'text'}) ---`;
        const safeContent = (s.content || '').slice(0, 50000);
        return `${fileHeading}\n${safeContent}\n${'-'.repeat(fileHeading.length)}`;
      })
      .join('\n\n');

    systemInstruction += `\n\n[PROJECT KNOWLEDGE BASE / SOURCES]:\nThe user has uploaded the following project source files. Use this knowledge base as primary ground truth context to answer questions accurately:\n\n${formattedSources}`;
  }

  if (Array.isArray(memories) && memories.length > 0) {
    const memoryItems = memories
      .map((m) => `- ${m.fact || m}`)
      .join('\n');

    systemInstruction += `\n\n[USER LONG-TERM MEMORY (CROSS-CHAT PERSISTENT CONTEXT)]:\nThe following verified facts, identity, and preferences are remembered about this user across past conversations. Seamlessly incorporate them into your responses without explicitly saying "According to my memory" unless asked:\n${memoryItems}`;
  }

  // Inject real-time temporal awareness (current day, date, time)
  const now = new Date();
  const timeString = now.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  systemInstruction += `\n\n[TEMPORAL CONTEXT]:\nCurrent timestamp is ${timeString}. You are fully context-aware of the current time, day, and date when responding to user greetings, scheduling, or time-sensitive questions.`;

  // Combine skill tools and directly requested tools
  const combinedTools = Array.from(
    new Set([...(skill?.tools || []), ...(Array.isArray(enabledTools) ? enabledTools : [])]),
  );

  const geminiTools = buildGeminiToolsConfig(combinedTools);
  const thinkingConfig = buildThinkingConfig({ thinkingLevel, model });
  const config = {
    ...(thinkingConfig ? { thinkingConfig } : {}),
    ...(geminiTools.length > 0 ? { tools: geminiTools } : {}),
  };

  const MAX_TOOL_ITERATIONS = 5;
  let iteration = 0;
  let currentContents = [...contents];

  while (iteration < MAX_TOOL_ITERATIONS) {
    iteration++;
    let pendingFunctionCalls = [];
    let modelTurnParts = [];

    // On final iteration, omit tools to force model synthesis of all collected findings
    const iterationConfig =
      iteration >= MAX_TOOL_ITERATIONS
        ? { ...(thinkingConfig ? { thinkingConfig } : {}) }
        : config;

    const stream = streamContent({
      contents: currentContents,
      model,
      systemInstruction,
      config: iterationConfig,
    });

    for await (const chunk of stream) {
      if (chunk.candidateParts && chunk.candidateParts.length > 0) {
        modelTurnParts.push(...chunk.candidateParts);
      }

      if (chunk.groundingMetadata) {
        yield { groundingMetadata: chunk.groundingMetadata };
      }

      if (chunk.codeStep) {
        yield { step: chunk.codeStep };
      }

      if (chunk.thought) {
        yield { thought: chunk.thought };
      }

      if (chunk.text) {
        yield { text: chunk.text };
      }

      if (chunk.usageMetadata) {
        yield { usageMetadata: chunk.usageMetadata };
      }

      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        pendingFunctionCalls.push(...chunk.functionCalls);
      }
    }

    if (pendingFunctionCalls.length === 0) {
      break;
    }

    // Execute requested tool functions
    const toolResponseParts = [];
    for (const call of pendingFunctionCalls) {
      const stepId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const isSearch = call.name === 'web_search';
      const actionTitle = isSearch
        ? `Searching web: "${call.args?.query || ''}"`
        : `Executing ${call.name}`;

      yield {
        step: {
          id: stepId,
          type: 'tool_call',
          tool: call.name,
          title: actionTitle,
          input: call.args,
          status: 'running',
          mode: toolExecutionMode,
        },
      };

      const result = await executeAgentTool(call.name, call.args, context);

      const completedTitle = isSearch
        ? `Found ${result.resultsCount || (result.results ? result.results.length : 0)} search results for "${call.args?.query || ''}"`
        : `Completed ${call.name}`;

      yield {
        step: {
          id: stepId,
          type: 'tool_call',
          tool: call.name,
          title: completedTitle,
          input: call.args,
          output: result,
          status: 'completed',
        },
      };

      if (isSearch && Array.isArray(result.results) && result.results.length > 0) {
        yield {
          groundingMetadata: {
            webSearchQueries: [call.args?.query || ''],
            sources: result.results.map((r) => ({
              title: r.title,
              url: r.url,
            })),
          },
        };
      }

      toolResponseParts.push({
        functionResponse: {
          name: call.name,
          response: result,
        },
      });
    }

    // Retain exact model turn parts (including thoughtSignature) for Gemini protocol compliance
    currentContents.push({
      role: 'model',
      parts: modelTurnParts.length > 0 ? modelTurnParts : pendingFunctionCalls.map((c) => ({ functionCall: c })),
    });
    currentContents.push({
      role: 'user',
      parts: toolResponseParts,
    });
  }
}

/**
 * Generates a short, descriptive title for a chat based on the first message.
 * Meters token usage and logs credits if successful.
 *
 * @param {Object} options
 * @param {string} options.firstMessage - User's prompt text
 * @param {string} options.userId - ID of the user owning the chat
 * @returns {Promise<{title: string, tokensUsed: number, creditsDeducted: number}>}
 */
export async function generateChatTitle({ firstMessage, userId }) {
  try {
    const result = await generateContent({
      contents: [{ role: 'user', parts: [{ text: firstMessage }] }],
      model: 'flash',
      systemInstruction: TITLE_SYSTEM_PROMPT,
      config: {
        maxOutputTokens: 30,
        temperature: 0.3,
      },
    });

    let title = result.text.replace(/["'\n\r]/g, '').trim();
    if (!title || title.length > 80) {
      title = firstMessage.slice(0, 40).trim();
    }

    let creditsDeducted = 0;
    if (result.totalTokens > 0 && userId) {
      try {
        const deduction = await deductCredits({
          userId,
          tokensUsed: result.totalTokens,
          feature: 'chat',
          model: 'flash',
        });
        creditsDeducted = deduction.creditsDeducted;
      } catch (deductErr) {
        logger.warn({ error: deductErr.message }, 'Failed to deduct credits for title generation');
      }
    }

    return {
      title,
      tokensUsed: result.totalTokens || 0,
      creditsDeducted,
    };
  } catch (error) {
    logger.warn(
      { error: error.message },
      'Failed to auto-generate chat title from Gemini; using fallback',
    );
    const fallbackTitle = firstMessage.slice(0, 40).trim() || 'New Chat';
    return {
      title: fallbackTitle,
      tokensUsed: 0,
      creditsDeducted: 0,
    };
  }
}

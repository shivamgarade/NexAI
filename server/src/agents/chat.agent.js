import { streamContent, generateContent } from '../services/gemini.service.js';
import { deductCredits } from '../services/credit.service.js';
import { buildGeminiToolsConfig, executeAgentTool } from '../services/tools.service.js';
import { CHAT_SYSTEM_PROMPT, TITLE_SYSTEM_PROMPT } from './prompts/chat.prompt.js';
import { getModelName } from '../config/gemini.js';
import { logger } from '../utils/logger.js';

const MAX_HISTORY_MESSAGES = 20;

/**
 * Evaluates whether a prompt is a simple greeting or trivial conversational utterance.
 * If true, skips thinking tokens to ensure near-zero latency and conserve tokens.
 *
 * @param {string} text
 * @returns {boolean}
 */
export function isTrivialQuery(text = '') {
  const clean = text.trim().toLowerCase();
  if (clean.length < 2) return true;
  const greetings = [
    'hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening',
    'sup', 'howdy', 'yo', 'thanks', 'thank you', 'ok', 'okay', 'yes', 'no', 'cool',
    'bye', 'goodbye', 'help', 'what can you do', 'who are you',
  ];
  return greetings.includes(clean);
}

/**
 * Builds thinking configuration based on user preference, model capability, and query complexity.
 * Follows official Google GenAI thinkingConfig documentation for Gemini 2.5 and 3.
 *
 * @param {Object} params
 * @param {'off' | 'dynamic' | 'low' | 'medium' | 'high'} [params.thinkingLevel='off']
 * @param {'flash' | 'pro'} [params.model='flash']
 * @param {string} [params.query='']
 * @returns {Record<string, unknown> | undefined}
 */
export function buildThinkingConfig({ thinkingLevel = 'off', model = 'flash', query = '' }) {
  if (!thinkingLevel || thinkingLevel === 'off') {
    return undefined;
  }

  const modelName = getModelName(model).toLowerCase();
  const level = thinkingLevel.toLowerCase();

  const isGemini3 = modelName.includes('3') || modelName.includes('gemini-3');

  if (isGemini3) {
    if (level === 'dynamic') {
      if (isTrivialQuery(query)) {
        return undefined; // zero thinking tokens burned on simple greetings
      }
      return {
        includeThoughts: true,
        thinkingLevel: 'low',
      };
    }
    return {
      includeThoughts: true,
      thinkingLevel: level,
    };
  }

  // Gemini 2.5 thinking budget
  if (level === 'dynamic') {
    if (isTrivialQuery(query)) {
      return undefined; // zero thinking tokens on simple greetings
    }
    const hasCodeOrMath = /(function|class|def |const |let |var |import |SELECT |WHERE |algorithm|architecture|debug|error|why|how does|compare|difference|\{|\}|\=\>|\$|\=)/i.test(query);
    const budget = hasCodeOrMath ? (model === 'pro' ? 4096 : 2048) : 1024;
    return {
      includeThoughts: true,
      thinkingBudget: budget,
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
 * Formats roles ('user' -> 'user', 'assistant' -> 'model'), ensures valid turn order,
 * and prunes redundant past-turn base64 attachments to preserve context window tokens.
 *
 * @param {Array<{role: string, content: string}>} rawMessages
 * @param {Object} [options]
 * @param {number} [options.maxMessages=20]
 * @param {boolean} [options.pruneOlderAttachments=true]
 * @returns {Array<{role: 'user' | 'model', parts: Array<{text: string}>}>}
 */
export function formatConversationHistory(rawMessages, options = {}) {
  const maxMessages = options.maxMessages || MAX_HISTORY_MESSAGES;
  const pruneAttachments = options.pruneOlderAttachments !== false;

  // Take last N messages
  const sliced = rawMessages.slice(-maxMessages);

  // Find first user message to guarantee conversation starts with a user turn
  const firstUserIdx = sliced.findIndex((m) => m.role === 'user');
  const validMessages = firstUserIdx >= 0 ? sliced.slice(firstUserIdx) : sliced;

  // Identify index of the latest message with attachments
  let lastAttachmentMsgIdx = -1;
  for (let i = validMessages.length - 1; i >= 0; i--) {
    if (Array.isArray(validMessages[i].attachments) && validMessages[i].attachments.length > 0) {
      lastAttachmentMsgIdx = i;
      break;
    }
  }

  return validMessages.map((msg, idx) => {
    const parts = [{ text: msg.content || '' }];

    if (Array.isArray(msg.attachments)) {
      for (const att of msg.attachments) {
        if (att.data && att.mimeType) {
          // If this is an older turn and pruning is active, don't re-transmit megabytes of base64
          if (pruneAttachments && idx < lastAttachmentMsgIdx) {
            parts.push({
              text: `[Attached media: ${att.name || att.mimeType} previously analyzed]`,
            });
          } else {
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
  systemInstruction += `\n\n[TEMPORAL CONTEXT]:\nToday's date is ${now.toDateString()} (Year: ${now.getFullYear()}). Current timestamp is ${timeString}. You are fully context-aware of the current real-world date and year when answering about current events, releases, news, and box office figures. Ground your answers in live search evidence.`;

  // Combine skill tools and directly requested tools with default autonomous web search
  const defaultTools = (enabledTools.length === 0 && !skill && context?.webSearchDefaultOn !== false) ? ['web_search'] : [];
  const combinedTools = Array.from(
    new Set([...defaultTools, ...(skill?.tools || []), ...(Array.isArray(enabledTools) ? enabledTools : [])]),
  );

  const latestUserMessage = messages[messages.length - 1]?.content || '';
  const geminiTools = buildGeminiToolsConfig(combinedTools);
  const thinkingConfig = buildThinkingConfig({ thinkingLevel, model, query: latestUserMessage });

  const MAX_TOOL_ITERATIONS = 4;
  let iteration = 0;
  let currentContents = [...contents];
  let toolsAllowed = true;
  let hasEmittedText = false;
  const accumulatedSearchResults = [];

  while (iteration <= MAX_TOOL_ITERATIONS) {
    iteration++;
    let pendingFunctionCalls = [];
    let modelTurnParts = [];

    const isFinalSynthesisTurn = !toolsAllowed || iteration >= MAX_TOOL_ITERATIONS;

    // Force model synthesis of all collected findings using mode: 'NONE' on final turn
    const iterationConfig = {
      ...(thinkingConfig ? { thinkingConfig } : {}),
      ...(geminiTools.length > 0 ? { tools: geminiTools } : {}),
      ...(isFinalSynthesisTurn && geminiTools.length > 0
        ? {
            toolConfig: {
              functionCallingConfig: {
                mode: 'NONE',
              },
            },
          }
        : {}),
    };

    const stream = streamContent({
      contents: currentContents,
      model,
      systemInstruction,
      config: iterationConfig,
    });

    for await (const chunk of stream) {
      if (chunk.candidateParts && chunk.candidateParts.length > 0) {
        for (const part of chunk.candidateParts) {
          if (part.functionCall) {
            modelTurnParts.push(part);
          } else if (part.text && part.text.trim()) {
            modelTurnParts.push(part);
          }
        }
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
        hasEmittedText = true;
        yield { text: chunk.text };
      }

      if (chunk.usageMetadata) {
        yield { usageMetadata: chunk.usageMetadata };
      }

      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        pendingFunctionCalls.push(...chunk.functionCalls);
      }
    }

    // If the model produced a direct text response without calling tools, we are done
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

      let result;
      try {
        result = await executeAgentTool(call.name, call.args, context);
      } catch (toolErr) {
        result = { error: toolErr.message || 'Tool execution failed' };
      }

      if (isSearch && Array.isArray(result?.results)) {
        accumulatedSearchResults.push(...result.results);
      }

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
          ...(call.id ? { id: call.id } : {}),
          response: {
            ...result,
            ...(iteration >= MAX_TOOL_ITERATIONS - 1
              ? { note: 'Tool step limit reached. Provide your final answer to the user now using all collected evidence.' }
              : {}),
          },
        },
      });
    }

    // Retain exact model turn parts with thoughtSignature and id
    currentContents.push({
      role: 'model',
      parts: modelTurnParts.length > 0
        ? modelTurnParts
        : pendingFunctionCalls.map((c) => ({
            functionCall: {
              name: c.name,
              args: c.args,
              ...(c.id ? { id: c.id } : {}),
            },
          })),
    });
    currentContents.push({
      role: 'user',
      parts: toolResponseParts,
    });

    // If approaching max iterations, disallow further tool calls so next turn synthesizes
    if (iteration >= MAX_TOOL_ITERATIONS - 1) {
      toolsAllowed = false;
    }
  }

  // Safety fallback if no text was emitted
  if (!hasEmittedText) {
    if (accumulatedSearchResults.length > 0) {
      try {
        const lastUserPrompt = messages[messages.length - 1]?.content || 'the user request';
        const fallbackRes = await generateContent({
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `Based on the following research results, formulate a helpful and clear answer to: "${lastUserPrompt}". If the subject is not released, unavailable, or future-dated, clearly state that based on the evidence.\n\nFindings:\n${accumulatedSearchResults.slice(0, 8).map((r) => `- ${r.title}: ${r.snippet}`).join('\n')}`,
                },
              ],
            },
          ],
          model,
          systemInstruction: CHAT_SYSTEM_PROMPT,
        });

        if (fallbackRes.text && fallbackRes.text.trim()) {
          yield { text: fallbackRes.text.trim() };
          hasEmittedText = true;
        }
      } catch (fallbackErr) {
        logger.warn({ error: fallbackErr.message }, 'Direct synthesis fallback warning');
      }
    }

    if (!hasEmittedText) {
      yield {
        text: 'I completed the research steps above, but was unable to find definitive records for this request. Please check if the subject has a different name, release year, or official title.',
      };
    }
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

import { extractLinkContent, isValidUrl } from './linkExtractor.service.js';
import * as memoryService from './memory.service.js';
import { Project } from '../models/Project.js';
import { Document } from '../models/Document.js';
import { logger } from '../utils/logger.js';

/**
 * Gemini-compatible Function Declarations for NexAI Agent Tools.
 */
export const TOOL_DECLARATIONS = {
  fetch_url: {
    name: 'fetch_url',
    description:
      'Extract and read the clean text content, title, and body of any specific web URL or website link.',
    parameters: {
      type: 'OBJECT',
      properties: {
        url: {
          type: 'STRING',
          description: 'The full HTTP or HTTPS webpage URL to fetch and read',
        },
      },
      required: ['url'],
    },
  },
  workspace_search: {
    name: 'workspace_search',
    description:
      "Search the user's project sources, files, and uploaded documents for relevant technical and domain knowledge.",
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'Keywords or search topic to look for in uploaded project files',
        },
      },
      required: ['query'],
    },
  },
  memory_search: {
    name: 'memory_search',
    description:
      "Search the user's persistent cross-chat memory facts and personal preferences.",
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The query describing the user preference or fact to retrieve',
        },
      },
      required: ['query'],
    },
  },
};

/**
 * Builds the Gemini tools array based on enabled tool identifiers.
 * Supports:
 * - 'web_search': Native Gemini Google Search grounding
 * - 'code_execution': Native Gemini Python code execution
 * - 'fetch_url', 'workspace_search', 'memory_search': NexAI custom tool functions
 *
 * @param {string[]} [enabledToolNames=[]]
 * @returns {Array<Record<string, any>>}
 */
export function buildGeminiToolsConfig(enabledToolNames = []) {
  if (!Array.isArray(enabledToolNames) || enabledToolNames.length === 0) {
    return [];
  }

  const tools = [];
  const functionDeclarations = [];

  for (const name of enabledToolNames) {
    if (name === 'web_search') {
      tools.push({ googleSearch: {} });
    } else if (name === 'code_execution') {
      tools.push({ codeExecution: {} });
    } else if (TOOL_DECLARATIONS[name]) {
      functionDeclarations.push(TOOL_DECLARATIONS[name]);
    }
  }

  if (functionDeclarations.length > 0) {
    tools.push({ functionDeclarations });
  }

  return tools;
}

/**
 * Executes a tool called by the agent model.
 *
 * @param {string} name - Name of the function/tool
 * @param {Record<string, any>} args - Arguments passed by the model
 * @param {Object} context - Execution context { userId, projectId }
 * @returns {Promise<Record<string, any>>}
 */
export async function executeAgentTool(name, args = {}, context = {}) {
  const { userId, projectId } = context;

  logger.info({ tool: name, args, userId }, 'Agent executing tool call');

  try {
    switch (name) {
      case 'fetch_url': {
        const url = args.url?.trim();
        if (!url || !isValidUrl(url)) {
          return {
            error: `Invalid URL provided: "${args.url}". Must be a valid http or https URL.`,
          };
        }
        const scraped = await extractLinkContent(url);
        return {
          url: scraped.url,
          title: scraped.title,
          description: scraped.description,
          content: (scraped.content || '').slice(0, 4000), // bounded for context window
        };
      }

      case 'workspace_search': {
        const query = args.query?.trim() || '';
        if (!query) {
          return { error: 'Search query is required' };
        }

        const matches = [];

        // 1. Search in current project sources if projectId is present
        if (projectId && userId) {
          const project = await Project.findOne({ _id: projectId, userId }).lean();
          if (project?.sources && project.sources.length > 0) {
            for (const source of project.sources) {
              const srcContent = source.content || '';
              if (
                source.name.toLowerCase().includes(query.toLowerCase()) ||
                srcContent.toLowerCase().includes(query.toLowerCase())
              ) {
                // Find matching snippet
                const lowerIdx = srcContent.toLowerCase().indexOf(query.toLowerCase());
                const start = Math.max(0, lowerIdx - 150);
                const snippet = srcContent.slice(start, start + 500);
                matches.push({
                  sourceName: source.name,
                  snippet: snippet.trim() || srcContent.slice(0, 300),
                });
              }
            }
          }
        }

        // 2. Also search in user Documents
        if (userId && matches.length < 3) {
          const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, 'i');
          const docs = await Document.find({
            userId,
            $or: [{ title: regex }, { 'sections.content': regex }],
          })
            .limit(3)
            .lean();

          for (const doc of docs) {
            matches.push({
              sourceName: doc.title,
              snippet: (doc.sections?.[0]?.content || '').slice(0, 300),
            });
          }
        }

        return {
          query,
          matchCount: matches.length,
          results: matches.slice(0, 5),
        };
      }

      case 'memory_search': {
        const query = args.query?.trim() || '';
        if (!userId || !query) {
          return { results: [] };
        }
        const memories = await memoryService.getRelevantMemories({
          userId,
          query,
          limit: 5,
        });
        return {
          query,
          memories: memories.map((m) => m.fact || m),
        };
      }

      default:
        logger.warn({ tool: name }, 'Unknown agent tool requested');
        return { error: `Tool "${name}" is not recognized or supported.` };
    }
  } catch (err) {
    logger.error({ error: err.message, tool: name }, 'Error executing agent tool');
    return {
      error: `Failed to execute tool ${name}: ${err.message}`,
    };
  }
}

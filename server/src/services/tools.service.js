import * as cheerio from 'cheerio';
import { extractLinkContent, isValidUrl } from './linkExtractor.service.js';
import * as memoryService from './memory.service.js';
import { Project } from '../models/Project.js';
import { Document } from '../models/Document.js';
import { logger } from '../utils/logger.js';

/**
 * Searches the web using Bing HTML results with DuckDuckGo and Wikipedia fallback.
 * Works quota-free without external API tokens, extracting real titles, snippets, and decoded URLs.
 *
 * @param {string} query
 * @returns {Promise<{ query: string, resultsCount: number, results: Array<{ title: string, snippet: string, url: string }> }>}
 */
export async function performWebSearch(query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return { query, resultsCount: 0, results: [] };
  }

  // 1. Primary Engine: Bing Web Search
  try {
    const url = `https://www.bing.com/search?q=${encodeURIComponent(cleanQuery)}&setlang=en`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 NexAI/1.0',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);
      const results = [];

      $('li.b_algo').each((_, el) => {
        if (results.length >= 6) return;
        const title = $(el).find('h2').text().trim();
        const snippet = $(el).find('.b_caption p, .b_lineclamp2, .b_snippet, p').first().text().trim();
        const rawHref = $(el).find('h2 a').attr('href') || '';

        let finalUrl = rawHref;
        const match = rawHref.match(/u=a1([A-Za-z0-9_-]+)/);
        if (match) {
          try {
            finalUrl = Buffer.from(
              match[1].replace(/-/g, '+').replace(/_/g, '/'),
              'base64',
            ).toString('utf8');
          } catch {
            finalUrl = rawHref;
          }
        }

        if (title && (snippet || finalUrl)) {
          results.push({
            title,
            snippet: snippet || title,
            url: finalUrl.startsWith('http') ? finalUrl : `https://${finalUrl}`,
          });
        }
      });

      if (results.length > 0) {
        return {
          query: cleanQuery,
          resultsCount: results.length,
          results,
        };
      }
    }
  } catch (bingErr) {
    logger.warn({ error: bingErr.message, query: cleanQuery }, 'Primary web search provider fallback triggered');
  }

  // 2. Secondary Engine: DuckDuckGo HTML
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(ddgUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);
      const results = [];

      $('.result').each((_, el) => {
        if (results.length >= 5) return;
        const title = $(el).find('.result__title').text().trim();
        const snippet = $(el).find('.result__snippet').text().trim();
        const rawUrl = $(el).find('.result__url').text().trim();
        const href = $(el).find('.result__url').attr('href') || $(el).find('.result__title a').attr('href');

        let link = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
        if (href && href.includes('uddg=')) {
          try {
            const match = href.match(/uddg=([^&]+)/);
            if (match && match[1]) {
              link = decodeURIComponent(match[1]);
            }
          } catch {
            // keep link
          }
        }

        if (title && snippet) {
          results.push({
            title,
            snippet,
            url: link,
          });
        }
      });

      if (results.length > 0) {
        return {
          query: cleanQuery,
          resultsCount: results.length,
          results,
        };
      }
    }
  } catch (ddgErr) {
    logger.warn({ error: ddgErr.message, query: cleanQuery }, 'DuckDuckGo search fallback failed');
  }

  // 3. Tertiary Fallback: Wikipedia OpenSearch API (for tech/science/concept lookups)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanQuery)}&limit=4&namespace=0&format=json`;
    const response = await fetch(wikiUrl);
    if (response.ok) {
      const data = await response.json();
      const titles = data[1] || [];
      const snippets = data[2] || [];
      const urls = data[3] || [];
      const results = [];

      for (let i = 0; i < titles.length; i++) {
        if (titles[i]) {
          results.push({
            title: titles[i],
            snippet: snippets[i] || titles[i],
            url: urls[i] || `https://en.wikipedia.org/wiki/${encodeURIComponent(titles[i])}`,
          });
        }
      }

      if (results.length > 0) {
        return {
          query: cleanQuery,
          resultsCount: results.length,
          results,
        };
      }
    }
  } catch {
    // ignore
  }

  return {
    query: cleanQuery,
    resultsCount: 0,
    results: [],
  };
}

/**
 * Gemini-compatible Function Declarations for NexAI Agent Tools.
 */
export const TOOL_DECLARATIONS = {
  web_search: {
    name: 'web_search',
    description:
      'Search the web for up-to-date facts, current events, technical documentation, websites, and news.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: {
          type: 'STRING',
          description: 'The search query or keywords to look up on the web',
        },
      },
      required: ['query'],
    },
  },
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
    if (name === 'code_execution') {
      tools.push({ codeExecution: {} });
    } else if (name === 'google_search') {
      tools.push({ googleSearch: {} });
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
      case 'web_search': {
        const query = args.query?.trim() || '';
        if (!query) {
          return { error: 'Search query is required' };
        }
        return await performWebSearch(query);
      }

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

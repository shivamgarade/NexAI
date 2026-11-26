import * as cheerio from 'cheerio';
import { extractLinkContent, isValidUrl } from './linkExtractor.service.js';
import * as memoryService from './memory.service.js';
import { Project } from '../models/Project.js';
import { Document } from '../models/Document.js';
import { LibraryItem } from '../models/LibraryItem.js';
import { getGeminiClient, getModelName } from '../config/gemini.js';
import { logger } from '../utils/logger.js';

/**
 * Evaluates whether a search result is genuinely relevant to the query keywords.
 * Filters out bot-deflection filler pages (e.g. login pages, unrelated localized portals, tracking hubs).
 *
 * @param {string} query
 * @param {string} title
 * @param {string} snippet
 * @returns {boolean}
 */
export function isResultRelevant(query, title = '', snippet = '', url = '') {
  if (!title && !snippet) return false;

  const textToSearch = `${title} ${snippet} ${url}`.toLowerCase();

  // Known bot-deflection filler domains, VPN ad portals, and crawler traps
  const botDeflectionPatterns = [
    'surfshark',
    'nordvpn',
    'expressvpn',
    'cyberghost',
    'purevpn',
    'ipvanish',
    'privateinternetaccess',
    'khan academy',
    'log into facebook',
    'facebook login',
    'shipmentlink',
    'cargo tracking',
    'unsupported device models youtube',
    'primetime channel subscription',
  ];

  if (botDeflectionPatterns.some((pattern) => textToSearch.includes(pattern))) {
    return false;
  }

  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'of', 'for', 'with', 'by',
    'to', 'is', 'it', 'was', 'are', 'be', 'what', 'who', 'how', 'when', 'where',
    'did', 'does', 'from', 'about', 'some', 'give', 'tell', 'show',
  ]);

  const queryKeywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (queryKeywords.length === 0) {
    return true;
  }

  // At least one significant query keyword must be present in the title, snippet, or url
  const matchingKeywords = queryKeywords.filter((word) => textToSearch.includes(word));
  return matchingKeywords.length > 0;
}

/**
 * Searches the web using a 100% free multi-tiered search waterfall:
 * - Tier 1: Gemini Google Search Grounding (Live Google Search via official @google/genai free tier, 1,500 queries/day)
 * - Tier 2: DuckDuckGo Instant Answer API & DuckDuckGo Lite (Free, high-limit, no bot challenges)
 * - Tier 3: Wikipedia Full Text Search API (Free, high-quality encyclopedia & factual reference)
 * - Tier 4: Bing HTML fallback with relevance gating
 *
 * @param {string} query
 * @returns {Promise<{ query: string, source?: string, resultsCount: number, results: Array<{ title: string, snippet: string, url: string }> }>}
 */
export async function performWebSearch(query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return { query, resultsCount: 0, results: [] };
  }

  // 1. Tier 1: Gemini Google Search Grounding (Live Google Search via @google/genai)
  try {
    const client = getGeminiClient();
    if (client) {
      const modelName = getModelName('flash');
      const response = await client.models.generateContent({
        model: modelName,
        contents: `What are the most accurate, real-time facts and authoritative web sources for: "${cleanQuery}"? Summarize factually and list primary web URLs.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const candidate = response.candidates?.[0];
      const grounding = candidate?.groundingMetadata;
      const chunks = grounding?.groundingChunks || [];
      const results = [];
      const seenUrls = new Set();

      for (const chunk of chunks) {
        if (chunk.web?.uri && !seenUrls.has(chunk.web.uri)) {
          seenUrls.add(chunk.web.uri);
          results.push({
            title: chunk.web.title || cleanQuery,
            snippet: (chunk.web.title ? `${chunk.web.title}: ` : '') + (response.text?.slice(0, 260) || ''),
            url: chunk.web.uri,
          });
        }
      }

      if (results.length > 0) {
        return {
          query: cleanQuery,
          source: 'Google Search (Grounding)',
          resultsCount: results.length,
          results: results.slice(0, 6),
        };
      }
    }
  } catch (groundingErr) {
    logger.warn({ error: groundingErr.message, query: cleanQuery }, 'Gemini Google Grounding search tier bypassed, cascading to free web APIs');
  }

  // Tier 1.5: Google Real-Time Live Feed Search (100% Free, live real-time articles & news, zero 429 quota exhaustion)
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(cleanQuery)}&hl=en-US&gl=US&ceid=US:en`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);
    const rssRes = await fetch(rssUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (rssRes.ok) {
      const xml = await rssRes.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      const googleResults = [];
      $('item').each((_, el) => {
        if (googleResults.length >= 6) return;
        const title = $(el).find('title').text().trim();
        const link = $(el).find('link').text().trim();
        const pubDate = $(el).find('pubDate').text().trim();
        const sourceName = $(el).find('source').text().trim();
        const sourceUrl = $(el).find('source').attr('url') || '';
        const descRaw = $(el).find('description').text();
        const descText = descRaw.replace(/<[^>]+>/g, '').trim();

        // Extract real destination link if available from sourceUrl or use link
        const finalUrl = sourceUrl && isValidUrl(sourceUrl) ? sourceUrl : link;

        if (title && finalUrl && isResultRelevant(cleanQuery, title, descText, finalUrl)) {
          googleResults.push({
            title: sourceName ? `${title.replace(/\s+-\s+.*$/, '')} (${sourceName})` : title,
            snippet: descText ? `${title} — ${descText}` : `${title} (${pubDate})`,
            url: finalUrl,
            publishedAt: pubDate,
            domain: sourceName || (sourceUrl ? new URL(sourceUrl).hostname : 'news.google.com'),
          });
        }
      });

      if (googleResults.length > 0) {
        return {
          query: cleanQuery,
          source: 'Google Live Search',
          resultsCount: googleResults.length,
          results: googleResults,
        };
      }
    }
  } catch (rssErr) {
    logger.warn({ error: rssErr.message, query: cleanQuery }, 'Google Live Search tier bypassed, attempting other search tiers');
  }

  // 2. Tier 2: DuckDuckGo Instant Answer API & DuckDuckGo Lite (100% Free, no JS challenge)
  try {
    const ddgResults = [];

    // 2a. DDG Instant Answer API
    try {
      const iaUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const iaRes = await fetch(iaUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (iaRes.ok) {
        const data = await iaRes.json();
        if (data.AbstractText && data.AbstractURL) {
          ddgResults.push({
            title: data.Heading || cleanQuery,
            snippet: data.AbstractText,
            url: data.AbstractURL,
          });
        }
        if (Array.isArray(data.RelatedTopics)) {
          for (const topic of data.RelatedTopics) {
            if (topic.Text && topic.FirstURL && ddgResults.length < 5) {
              ddgResults.push({
                title: topic.Text.split(' - ')[0] || cleanQuery,
                snippet: topic.Text,
                url: topic.FirstURL,
              });
            }
          }
        }
      }
    } catch {
      // Continue to DDG Lite
    }

    // 2b. DuckDuckGo Lite HTML (lightweight text-only engine, bypasses heavy bot challenges)
    if (ddgResults.length < 3) {
      const liteUrl = 'https://lite.duckduckgo.com/lite/';
      const liteController = new AbortController();
      const liteTimeout = setTimeout(() => liteController.abort(), 5000);

      const liteRes = await fetch(liteUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'text/html',
        },
        body: `q=${encodeURIComponent(cleanQuery)}`,
        signal: liteController.signal,
      });
      clearTimeout(liteTimeout);

      if (liteRes.ok) {
        const html = await liteRes.text();
        const $ = cheerio.load(html);

        $('tr').each((_, row) => {
          if (ddgResults.length >= 6) return;
          const link = $(row).find('a.result-link');
          const snippet = $(row).find('.result-snippet');
          const href = link.attr('href');
          const title = link.text().trim();
          const snipText = snippet.text().trim();

          if (title && href) {
            let finalUrl = href;
            if (href.includes('uddg=')) {
              try {
                const match = href.match(/uddg=([^&]+)/);
                if (match && match[1]) {
                  finalUrl = decodeURIComponent(match[1]);
                }
              } catch {}
            }
            if (finalUrl.startsWith('http') && isResultRelevant(cleanQuery, title, snipText)) {
              ddgResults.push({
                title,
                snippet: snipText || title,
                url: finalUrl,
              });
            }
          }
        });
      }
    }

    if (ddgResults.length > 0) {
      return {
        query: cleanQuery,
        source: 'DuckDuckGo',
        resultsCount: ddgResults.length,
        results: ddgResults.slice(0, 6),
      };
    }
  } catch (ddgErr) {
    logger.warn({ error: ddgErr.message, query: cleanQuery }, 'DuckDuckGo free search tier failed, attempting Wikipedia search');
  }

  // 3. Tier 3: Wikipedia Full Text Search API (Zero quota, high-quality reference data)
  try {
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cleanQuery)}&format=json&utf8=1&srlimit=6`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(wikiUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const searchItems = data?.query?.search || [];
      const results = [];

      for (const item of searchItems) {
        const cleanSnippet = (item.snippet || '')
          .replace(/<span class="searchmatch">/g, '')
          .replace(/<\/span>/g, '')
          .replace(/&quot;/g, '"')
          .replace(/&#039;/g, "'")
          .replace(/&amp;/g, '&');

        results.push({
          title: item.title,
          snippet: cleanSnippet || item.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`,
        });
      }

      if (results.length > 0) {
        return {
          query: cleanQuery,
          source: 'Wikipedia Search',
          resultsCount: results.length,
          results: results.slice(0, 6),
        };
      }
    }
  } catch (wikiErr) {
    logger.warn({ error: wikiErr.message, query: cleanQuery }, 'Wikipedia search fallback failed');
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
  save_to_library: {
    name: 'save_to_library',
    description:
      "Save an important note, document, or research synthesis directly into the user's personal Library.",
    parameters: {
      type: 'OBJECT',
      properties: {
        title: {
          type: 'STRING',
          description: 'Title of the library item',
        },
        content: {
          type: 'STRING',
          description: 'Markdown formatted content of the note or document',
        },
        type: {
          type: 'STRING',
          description: 'Type of item: "note" or "document"',
        },
        tags: {
          type: 'ARRAY',
          items: { type: 'STRING' },
          description: 'Tags for categorization and search',
        },
      },
      required: ['title', 'content'],
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
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');

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
                  type: 'project_source',
                  snippet: snippet.trim() || srcContent.slice(0, 300),
                });
              }
            }
          }
        }

        // 2. Search in user Documents (sections.body)
        if (userId && matches.length < 5) {
          const docs = await Document.find({
            userId,
            $or: [{ title: regex }, { 'sections.body': regex }],
          })
            .limit(3)
            .lean();

          for (const doc of docs) {
            const matchedSection = doc.sections?.find(
              (s) => s.body && regex.test(s.body),
            );
            matches.push({
              sourceName: doc.title,
              type: 'document',
              snippet: (matchedSection?.body || doc.sections?.[0]?.body || '').slice(0, 300),
            });
          }
        }

        // 3. Search in user Library Items (notes, documents, links)
        if (userId && matches.length < 5) {
          const libItems = await LibraryItem.find({
            userId,
            $or: [{ title: regex }, { content: regex }, { summary: regex }],
          })
            .limit(3)
            .lean();

          for (const item of libItems) {
            matches.push({
              sourceName: item.title,
              type: `library_${item.type || 'note'}`,
              snippet: (item.summary || item.content || '').slice(0, 300),
            });
          }
        }

        return {
          query,
          matchCount: matches.length,
          results: matches.slice(0, 6),
        };
      }

      case 'save_to_library': {
        if (!userId) {
          return { error: 'User must be authenticated to save items to library' };
        }
        const { title, content, type = 'note', tags = [] } = args;
        if (!title || !content) {
          return { error: 'Both title and content are required' };
        }
        const item = await LibraryItem.create({
          userId,
          title: title.trim(),
          content: content.trim(),
          summary: content.slice(0, 180).trim() + (content.length > 180 ? '...' : ''),
          type: type === 'document' ? 'document' : 'note',
          tags: Array.isArray(tags) ? tags : ['ai-saved'],
        });
        return {
          success: true,
          message: `Saved "${item.title}" to Library`,
          itemId: item._id,
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

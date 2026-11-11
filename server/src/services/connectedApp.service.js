import { ConnectedApp } from '../models/ConnectedApp.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const SYSTEM_CONNECTED_APPS = [
  {
    appSlug: 'web-search',
    name: 'Live Web Grounding',
    description: 'Autonomous web search engine providing live facts, research, and link reading.',
    icon: 'Globe',
    category: 'Search & Research',
    scopes: ['search:live', 'fetch:links'],
    defaultConnected: true,
  },
  {
    appSlug: 'github',
    name: 'GitHub',
    description: 'Access repositories, inspect code pull requests, and review issues.',
    icon: 'Terminal',
    category: 'Developer',
    scopes: ['repo:read', 'issues:read'],
    defaultConnected: false,
  },
  {
    appSlug: 'google-drive',
    name: 'Google Drive & Docs',
    description: 'Sync documentation, meeting notes, and knowledge base files into AI context.',
    icon: 'Folder',
    category: 'Workspace',
    scopes: ['drive.readonly'],
    defaultConnected: false,
  },
  {
    appSlug: 'notion',
    name: 'Notion Workspace',
    description: 'Query company wikis, product specs, and documentation databases.',
    icon: 'BookOpen',
    category: 'Productivity',
    scopes: ['pages:read', 'databases:read'],
    defaultConnected: false,
  },
  {
    appSlug: 'figma',
    name: 'Figma Diagrams',
    description: 'Generate flowcharts, UI architecture sketches, and review canvas assets.',
    icon: 'PenTool',
    category: 'Design',
    scopes: ['files:read'],
    defaultConnected: false,
  },
];

/**
 * Ensures user has all system connected apps initialized.
 */
export async function getConnectedApps(userId) {
  const existing = await ConnectedApp.find({ userId });
  const existingSlugs = new Set(existing.map((a) => a.appSlug));

  // Initialize any missing default apps
  for (const sysApp of SYSTEM_CONNECTED_APPS) {
    if (!existingSlugs.has(sysApp.appSlug)) {
      await ConnectedApp.create({
        userId,
        appSlug: sysApp.appSlug,
        name: sysApp.name,
        description: sysApp.description,
        icon: sysApp.icon,
        category: sysApp.category,
        scopes: sysApp.scopes,
        isConnected: sysApp.defaultConnected || false,
      });
    }
  }

  return ConnectedApp.find({ userId }).sort({ isConnected: -1, name: 1 });
}

/**
 * Updates an integration app settings or toggle connection state.
 */
export async function updateConnectedApp(userId, appSlug, data) {
  let app = await ConnectedApp.findOne({ userId, appSlug });
  if (!app) {
    const sysTemplate = SYSTEM_CONNECTED_APPS.find((s) => s.appSlug === appSlug);
    if (!sysTemplate) {
      throw new ApiError(404, 'NOT_FOUND', 'Integration app not found');
    }
    app = await ConnectedApp.create({
      userId,
      appSlug,
      name: sysTemplate.name,
      description: sysTemplate.description,
      icon: sysTemplate.icon,
      category: sysTemplate.category,
      scopes: sysTemplate.scopes,
      isConnected: false,
    });
  }

  if (data.isConnected !== undefined) {
    app.isConnected = Boolean(data.isConnected);
    if (app.isConnected) {
      app.lastSyncedAt = new Date();
    }
  }

  if (data.webhookUrl !== undefined) {
    app.credentials.webhookUrl = data.webhookUrl;
  }

  if (data.accountName !== undefined) {
    app.credentials.accountName = data.accountName;
  }

  if (data.apiKey) {
    app.credentials.apiKey = data.apiKey;
    app.isConnected = true;
    app.lastSyncedAt = new Date();
  }

  if (data.settings) {
    app.settings = { ...app.settings, ...data.settings };
  }

  await app.save();
  logger.info({ userId, appSlug, isConnected: app.isConnected }, 'Connected app updated');
  return app;
}

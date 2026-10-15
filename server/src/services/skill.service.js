import { Skill, extractVariables } from '../models/Skill.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const SYSTEM_SKILLS = [
  {
    title: 'Web Deep Researcher',
    slug: 'web-deep-researcher',
    description:
      'Autonomous web research agent that gathers live data, inspects links, and delivers fact-checked findings with citations.',
    icon: 'Search',
    category: 'Research',
    tools: ['web_search', 'fetch_url'],
    instructions:
      'You are an elite Research Agent. Conduct thorough investigations using real-time search and link reading. Validate facts from multiple web sources, highlight discrepancies, and organize your response with an Executive Summary, Key Evidence, and Sources with direct URLs.',
    isSystem: true,
    tags: ['research', 'web', 'facts', 'sources'],
  },
  {
    title: 'Code Architect & Debugger',
    slug: 'code-architect-debugger',
    description:
      'Senior engineer for architectural analysis, complex bug troubleshooting, algorithm optimization, and code execution.',
    icon: 'Code2',
    category: 'Coding',
    tools: ['code_execution', 'web_search'],
    instructions:
      'You are a Principal Software Architect and Debugger. Approach coding problems with rigorous system design principles: isolate root causes, verify logic with code execution where appropriate, and provide battle-tested, modular, and type-safe solutions with edge-case handling.',
    isSystem: true,
    tags: ['code', 'debugging', 'architecture', 'refactor'],
  },
  {
    title: 'Project & Document Analyst',
    slug: 'project-document-analyst',
    description:
      'Deeply queries and synthesizes user project documents, source files, and workspace context into actionable briefs.',
    icon: 'FileText',
    category: 'Analysis',
    tools: ['workspace_search', 'memory_search'],
    instructions:
      'You are a Knowledge Base Analyst. Query the user workspace sources and documents to answer complex domain questions. Ground your analysis strictly in the provided project materials, identifying key themes, discrepancies, and structured conclusions.',
    isSystem: true,
    tags: ['workspace', 'docs', 'analysis', 'knowledge'],
  },
  {
    title: 'Executive Brief & Content Writer',
    slug: 'executive-brief-writer',
    description:
      'Creates high-impact executive summaries, proposals, whitepapers, and technical articles backed by real-time facts.',
    icon: 'PenTool',
    category: 'Writing',
    tools: ['web_search'],
    instructions:
      'You are a Staff Communications & Strategy Specialist. Draft compelling, concise, and structured deliverables (PRDs, memos, briefs, release notes). Ground facts using web search and tailor formatting with clear headers, bullets, and crisp executive takeaways.',
    isSystem: true,
    tags: ['writing', 'executive', 'brief', 'prd'],
  },
  {
    title: 'Database & ERD Architect',
    slug: 'database-erd-architect',
    description:
      'Designs normalized relational database models, entity relationships, indexes, and visual ER diagrams.',
    icon: 'Database',
    category: 'Architecture',
    tools: ['schema_modeling'],
    instructions:
      'You are a Principal Database Architect. Model entity relationship diagrams, database schemas, foreign keys, and indexes.',
    isSystem: true,
    tags: ['database', 'schema', 'erd', 'sql', 'prisma', 'modeling'],
  },
];

/**
 * Seeds or updates system skills in MongoDB on server startup.
 */
export async function ensureSystemSkills() {
  try {
    for (const sysSkill of SYSTEM_SKILLS) {
      await Skill.findOneAndUpdate(
        { slug: sysSkill.slug, isSystem: true },
        { ...sysSkill, userId: null },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }
    logger.info('System skills verified and synchronized');
  } catch (err) {
    logger.warn({ error: err.message }, 'Failed to seed system skills');
  }
}

/**
 * Retrieves skills for the current user (includes both user custom skills and system skills).
 *
 * @param {string} userId
 * @param {object} [filters]
 * @param {string} [filters.category]
 * @param {string} [filters.tool]
 * @param {string} [filters.search]
 * @param {boolean} [filters.isFavorite]
 * @param {boolean} [filters.isSystem]
 * @returns {Promise<Array>}
 */
export async function getSkills(userId, filters = {}) {
  const { category, tool, search, isFavorite, isSystem } = filters;

  // Include user's own skills OR system-wide skills
  const query = {
    $or: [{ userId }, { isSystem: true }],
  };

  if (category && category !== 'All') {
    query.category = category;
  }

  if (tool) {
    query.tools = tool;
  }

  if (typeof isSystem === 'boolean') {
    query.isSystem = isSystem;
    if (isSystem) {
      delete query.$or;
    }
  }

  if (typeof isFavorite === 'boolean') {
    query.isFavorite = isFavorite;
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escaped, 'i');
    query.$and = [
      {
        $or: [
          { title: searchRegex },
          { description: searchRegex },
          { tags: searchRegex },
          { instructions: searchRegex },
        ],
      },
    ];
  }

  return Skill.find(query).sort({ isFavorite: -1, isSystem: -1, createdAt: -1 });
}

/**
 * Retrieves a single skill by ID, allowing user skills or system skills.
 *
 * @param {string} userId
 * @param {string} skillId
 * @returns {Promise<Object>}
 */
export async function getSkillById(userId, skillId) {
  const skill = await Skill.findOne({
    _id: skillId,
    $or: [{ userId }, { isSystem: true }],
  });

  if (!skill) {
    throw new ApiError(404, 'NOT_FOUND', 'Skill not found');
  }

  return skill;
}

/**
 * Creates a new user custom skill.
 *
 * @param {string} userId
 * @param {object} skillData
 * @returns {Promise<Object>}
 */
export async function createSkill(userId, data) {
  const { title, description, icon, instructions, template, tools, category, tags, isFavorite } =
    data;

  const rawText = instructions || template || '';
  const variables = extractVariables(rawText);

  const skill = await Skill.create({
    userId,
    title,
    description: description || '',
    icon: icon || 'Zap',
    instructions: rawText,
    template: rawText,
    variables,
    tools: Array.isArray(tools) ? tools : [],
    category: category || 'General',
    tags: Array.isArray(tags) ? tags : [],
    isFavorite: Boolean(isFavorite),
    isSystem: false,
  });

  return skill;
}

/**
 * Updates a user-owned skill (system skills cannot be modified by standard users).
 *
 * @param {string} userId
 * @param {string} skillId
 * @param {object} updateData
 * @returns {Promise<Object>}
 */
export async function updateSkill(userId, skillId, updateData) {
  const skill = await Skill.findOne({ _id: skillId, userId });
  if (!skill) {
    throw new ApiError(404, 'NOT_FOUND', 'Skill not found or cannot be modified');
  }

  if (updateData.title !== undefined) skill.title = updateData.title;
  if (updateData.description !== undefined) skill.description = updateData.description;
  if (updateData.icon !== undefined) skill.icon = updateData.icon;
  if (updateData.category !== undefined) skill.category = updateData.category;
  if (updateData.tools !== undefined) skill.tools = updateData.tools;
  if (updateData.tags !== undefined) skill.tags = updateData.tags;
  if (updateData.isFavorite !== undefined) skill.isFavorite = updateData.isFavorite;

  if (updateData.instructions !== undefined || updateData.template !== undefined) {
    const rawText = updateData.instructions || updateData.template || '';
    skill.instructions = rawText;
    skill.template = rawText;
    skill.variables = extractVariables(rawText);
  }

  await skill.save();
  return skill;
}

/**
 * Deletes a user-owned skill.
 *
 * @param {string} userId
 * @param {string} skillId
 * @returns {Promise<void>}
 */
export async function deleteSkill(userId, skillId) {
  const result = await Skill.deleteOne({ _id: skillId, userId });
  if (result.deletedCount === 0) {
    throw new ApiError(404, 'NOT_FOUND', 'Skill not found or cannot be deleted');
  }
}

/**
 * Toggles the favorite status of a skill.
 *
 * @param {string} userId
 * @param {string} skillId
 * @returns {Promise<Object>}
 */
export async function toggleFavorite(userId, skillId) {
  const skill = await Skill.findOne({
    _id: skillId,
    $or: [{ userId }, { isSystem: true }],
  });

  if (!skill) {
    throw new ApiError(404, 'NOT_FOUND', 'Skill not found');
  }

  skill.isFavorite = !skill.isFavorite;
  await skill.save();
  return skill;
}

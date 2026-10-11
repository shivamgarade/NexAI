import { Prompt, extractVariables } from '../models/Prompt.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Retrieves prompts for the authenticated user with optional filtering.
 *
 * @param {string} userId
 * @param {object} [filters]
 * @param {string} [filters.tag]
 * @param {string} [filters.search]
 * @param {boolean} [filters.isFavorite]
 * @returns {Promise<Array>}
 */
export async function getPrompts(userId, { tag, search, isFavorite } = {}) {
  const query = { userId };

  if (tag) {
    query.tags = tag;
  }

  if (typeof isFavorite === 'boolean') {
    query.isFavorite = isFavorite;
  }

  if (search) {
    const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchRegex = new RegExp(escaped, 'i');
    query.$or = [
      { title: searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
      { template: searchRegex },
    ];
  }

  return Prompt.find(query).sort({ isFavorite: -1, createdAt: -1 });
}

/**
 * Retrieves a single prompt by ID, ensuring user ownership.
 *
 * @param {string} userId
 * @param {string} promptId
 * @returns {Promise<Object>}
 */
export async function getPromptById(userId, promptId) {
  const prompt = await Prompt.findOne({ _id: promptId, userId });
  if (!prompt) {
    throw new ApiError(404, 'NOT_FOUND', 'Prompt not found');
  }
  return prompt;
}

/**
 * Creates a new prompt template with automatically extracted variables.
 *
 * @param {string} userId
 * @param {object} promptData
 * @returns {Promise<Object>}
 */
export async function createPrompt(userId, { title, description, template, tags, isFavorite }) {
  const variables = extractVariables(template);

  const prompt = await Prompt.create({
    userId,
    title,
    description: description || '',
    template,
    variables,
    tags: tags || [],
    isFavorite: Boolean(isFavorite),
  });

  return prompt;
}

/**
 * Updates an existing prompt, re-extracting variables if the template is modified.
 *
 * @param {string} userId
 * @param {string} promptId
 * @param {object} updateData
 * @returns {Promise<Object>}
 */
export async function updatePrompt(userId, promptId, updateData) {
  const prompt = await Prompt.findOne({ _id: promptId, userId });
  if (!prompt) {
    throw new ApiError(404, 'NOT_FOUND', 'Prompt not found');
  }

  if (updateData.title !== undefined) prompt.title = updateData.title;
  if (updateData.description !== undefined) prompt.description = updateData.description;
  if (updateData.tags !== undefined) prompt.tags = updateData.tags;
  if (updateData.isFavorite !== undefined) prompt.isFavorite = updateData.isFavorite;

  if (updateData.template !== undefined) {
    prompt.template = updateData.template;
    prompt.instructions = updateData.template;
    prompt.variables = extractVariables(updateData.template);
  }

  await prompt.save();
  return prompt;
}

/**
 * Deletes a prompt, strictly verifying ownership.
 *
 * @param {string} userId
 * @param {string} promptId
 * @returns {Promise<Object>}
 */
export async function deletePrompt(userId, promptId) {
  const prompt = await Prompt.findOneAndDelete({ _id: promptId, userId });
  if (!prompt) {
    throw new ApiError(404, 'NOT_FOUND', 'Prompt not found');
  }
  return { message: 'Prompt deleted successfully', id: promptId };
}

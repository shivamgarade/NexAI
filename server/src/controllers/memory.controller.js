import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { memoryService } from '../services/memory.service.js';

/**
 * Returns all active long-term memories for the authenticated user.
 * GET /api/memories
 */
export const getMemories = asyncHandler(async (req, res) => {
  const memories = await memoryService.listUserMemories(req.user._id);
  res.status(200).json({ data: memories });
});

/**
 * Manually adds a persistent memory for the user.
 * POST /api/memories
 */
export const createMemory = asyncHandler(async (req, res) => {
  const { fact, category, pinned, key, scope, projectId } = req.body;
  const memory = await memoryService.createManualMemory(req.user._id, {
    fact,
    category,
    pinned,
    key,
    scope,
    projectId,
  });
  res.status(201).json({ data: memory });
});

/**
 * Updates a user memory.
 * PATCH /api/memories/:id
 */
export const updateMemory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fact, category, pinned, active, key, scope, projectId } = req.body;

  const memory = await memoryService.updateUserMemory(req.user._id, id, {
    fact,
    category,
    pinned,
    active,
    key,
    scope,
    projectId,
  });

  if (!memory) {
    throw new ApiError(404, 'MEMORY_NOT_FOUND', 'Memory record not found');
  }

  res.status(200).json({ data: memory });
});

/**
 * Consolidates, de-duplicates, and resolves contradictions among user memories using AI.
 * POST /api/memories/consolidate
 */
export const consolidateMemories = asyncHandler(async (req, res) => {
  const result = await memoryService.consolidateUserMemories(req.user._id);
  res.status(200).json({ data: result });
});

/**
 * Deletes a single user memory.
 * DELETE /api/memories/:id
 */
export const deleteMemory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const success = await memoryService.deleteUserMemory(req.user._id, id);
  if (!success) {
    throw new ApiError(404, 'MEMORY_NOT_FOUND', 'Memory record not found');
  }
  res.status(200).json({ data: { message: 'Memory deleted successfully' } });
});

/**
 * Clears all memories for the authenticated user.
 * DELETE /api/memories
 */
export const clearMemories = asyncHandler(async (req, res) => {
  const count = await memoryService.clearAllUserMemories(req.user._id);
  res.status(200).json({
    data: {
      message: `Cleared ${count} memories successfully`,
      deletedCount: count,
    },
  });
});

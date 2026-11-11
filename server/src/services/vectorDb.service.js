import { getPineconeIndex } from '../config/pinecone.js';
import { logger } from '../utils/logger.js';

// In-memory fallback store used when Pinecone is not configured or in testing
const inMemoryStore = new Map();

/**
 * Computes cosine similarity between two numeric vectors.
 *
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Value in [-1, 1]
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  const len = Math.min(vecA.length, vecB.length);
  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Checks if a stored metadata record satisfies the requested filter criteria.
 *
 * @param {Record<string, any>} metadata
 * @param {Record<string, any>} [filter]
 * @returns {boolean}
 */
function matchesFilter(metadata, filter) {
  if (!filter) return true;
  for (const [key, expectedValue] of Object.entries(filter)) {
    if (metadata[key] !== expectedValue) {
      return false;
    }
  }
  return true;
}

/**
 * Provider-agnostic Vector Database Service.
 * Implements Pinecone integration with seamless fallback.
 */
export const vectorDbService = {
  /**
   * Upserts a vector embedding with associated metadata.
   *
   * @param {Object} params
   * @param {string} params.id - Vector unique identifier
   * @param {number[]} params.values - Dense float vector
   * @param {{ userId: string, type: 'library' | 'document' | 'prompt', refId: string, [key: string]: any }} params.metadata
   * @returns {Promise<boolean>} Success indicator
   */
  async upsert({ id, values, metadata }) {
    if (!id || !values || !values.length) {
      logger.warn({ id }, 'Attempted to upsert invalid vector');
      return false;
    }

    // Always record to local fallback store
    inMemoryStore.set(id, { id, values, metadata: { ...metadata } });

    const index = getPineconeIndex();
    if (index) {
      try {
        await index.upsert([
          {
            id,
            values,
            metadata,
          },
        ]);
        return true;
      } catch (err) {
        logger.warn(
          { error: err.message, id },
          'Pinecone upsert failed, retained in local fallback',
        );
        return false;
      }
    }

    return true;
  },

  /**
   * Queries vector index for topK nearest neighbors matching the metadata filter.
   *
   * @param {Object} params
   * @param {number[]} params.values - Query vector
   * @param {number} [params.topK=10] - Number of matches to return
   * @param {{ userId: string, type?: string, [key: string]: any }} params.filter - Metadata filter (MUST include userId)
   * @returns {Promise<Array<{ id: string, score: number, metadata: Record<string, any> }>>}
   */
  async query({ values, topK = 10, filter }) {
    if (!values || !values.length) return [];

    const index = getPineconeIndex();
    if (index) {
      try {
        const response = await index.query({
          vector: values,
          topK,
          filter,
          includeMetadata: true,
        });

        if (response.matches && response.matches.length > 0) {
          return response.matches.map((match) => ({
            id: match.id,
            score: match.score ?? 0,
            metadata: match.metadata || {},
          }));
        }
      } catch (err) {
        logger.warn({ error: err.message }, 'Pinecone query failed, using local fallback');
      }
    }

    // Local fallback search using cosine similarity
    const candidates = [];
    for (const item of inMemoryStore.values()) {
      if (matchesFilter(item.metadata, filter)) {
        const score = cosineSimilarity(values, item.values);
        candidates.push({
          id: item.id,
          score,
          metadata: item.metadata,
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, topK);
  },

  /**
   * Removes a vector by its unique identifier.
   *
   * @param {string} id - Vector ID to delete
   * @returns {Promise<boolean>}
   */
  async remove(id) {
    if (!id) return false;
    inMemoryStore.delete(id);

    const index = getPineconeIndex();
    if (index) {
      try {
        await index.deleteOne(id);
        return true;
      } catch (err) {
        logger.warn({ error: err.message, id }, 'Pinecone remove failed');
        return false;
      }
    }

    return true;
  },

  /**
   * Removes multiple vectors by their IDs.
   *
   * @param {string[]} ids
   * @returns {Promise<boolean>}
   */
  async removeMany(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return false;
    let allSuccess = true;
    for (const id of ids) {
      const ok = await this.remove(id);
      if (!ok) allSuccess = false;
    }
    return allSuccess;
  },


  /**
   * Clears the in-memory fallback store (useful for test isolation).
   */
  clearLocalStore() {
    inMemoryStore.clear();
  },

  /**
   * Returns current count of vectors in local in-memory fallback store.
   * @returns {number}
   */
  getLocalStoreSize() {
    return inMemoryStore.size;
  },

  /**
   * Checks if a vector is present in local in-memory store.
   * @param {string} id
   * @returns {boolean}
   */
  hasVector(id) {
    return inMemoryStore.has(id);
  },

  /**
   * Seeds in-memory store with vector embeddings from stored Memory documents.
   * Enables seamless zero-latency retrieval after server reload or restart.
   *
   * @param {Array<any>} memoryDocs
   * @returns {number} Count of vectors loaded
   */
  warmupFromMemories(memoryDocs) {
    if (!Array.isArray(memoryDocs)) return 0;
    let loaded = 0;
    for (const mem of memoryDocs) {
      if (mem && mem.active && mem.embedding && Array.isArray(mem.embedding) && mem.embedding.length > 0) {
        const id = mem.vectorId || `mem_${mem._id.toString()}`;
        inMemoryStore.set(id, {
          id,
          values: mem.embedding,
          metadata: {
            userId: mem.userId?.toString() || '',
            type: 'memory',
            category: mem.category || 'fact',
            refId: mem._id.toString(),
            scope: mem.scope || 'global',
            projectId: mem.projectId ? mem.projectId.toString() : null,
          },
        });
        loaded++;
      }
    }
    return loaded;
  },
};


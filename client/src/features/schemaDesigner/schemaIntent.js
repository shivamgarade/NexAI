/**
 * Utility to detect if a prompt or chat intent is intended for
 * the ER Diagram / Data Modeling Studio (/schema).
 */

// Slash command prefixes that directly trigger schema mode
const SCHEMA_SLASH_COMMANDS = ['/schema', '/erd', '/datamodel', '/database'];

// Regex patterns matching natural language requests for schema / ER diagram / data modeling
const SCHEMA_INTENT_PATTERNS = [
  // "design/create/model/generate/build a database schema / erd / data model for ..."
  /\b(?:design|create|build|generate|model|architect|sketch|draw|show)\s+(?:me\s+)?(?:an?|the)?\s*(?:new\s+)?(?:relational\s+)?(?:database|db|schema|relational\s+model|er\s*diagram|erd|entity\s+relationship|tables?|data\s+model(?:ing)?)\b/i,
  // "database schema for...", "erd for...", "data model for..."
  /\b(?:database\s+schema|er\s*diagram|erd|data\s+model(?:ing)?|entity\s+relationship\s+diagram)\s+(?:for|of|representing|architecture)\b/i,
  // "schema design for..."
  /\b(?:schema|erd)\s+(?:design|architecture|modeling)\b/i,
];

/**
 * Checks if the given user input or selected skill indicates a data modeling intent.
 *
 * @param {string} text - Raw input string from the user
 * @param {object|null} activeSkill - The currently active skill object, if any
 * @returns {{ isMatch: boolean, cleanPrompt: string }}
 */
export function matchSchemaIntent(text = '', activeSkill = null) {
  if (typeof text !== 'string') {
    text = '';
  }
  const trimmed = text.trim();

  // 1. Check if user typed an explicit slash command
  for (const cmd of SCHEMA_SLASH_COMMANDS) {
    if (trimmed.toLowerCase().startsWith(cmd)) {
      const cleanPrompt = trimmed.slice(cmd.length).trim();
      return {
        isMatch: true,
        cleanPrompt: cleanPrompt || 'Design a normalized database schema with entities and relationships',
        reason: 'slash_command',
      };
    }
  }

  // 2. Check if active skill is related to data modeling or database schema
  if (activeSkill) {
    const skillSlug = (activeSkill.slug || '').toLowerCase();
    const skillTitle = (activeSkill.title || '').toLowerCase();
    const isSchemaSkill =
      skillSlug.includes('schema') ||
      skillSlug.includes('erd') ||
      skillSlug.includes('data-model') ||
      skillTitle.includes('schema') ||
      skillTitle.includes('er diagram') ||
      skillTitle.includes('data model');

    if (isSchemaSkill) {
      return {
        isMatch: true,
        cleanPrompt: trimmed,
        reason: 'active_skill',
      };
    }
  }

  // 3. Match natural language patterns
  if (trimmed) {
    for (const pattern of SCHEMA_INTENT_PATTERNS) {
      if (pattern.test(trimmed)) {
        return {
          isMatch: true,
          cleanPrompt: trimmed,
          reason: 'natural_language',
        };
      }
    }
  }

  return {
    isMatch: false,
    cleanPrompt: trimmed,
    reason: null,
  };
}

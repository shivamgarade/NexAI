/**
 * Normalizes corrupted or inline markdown tables before passing to react-markdown.
 * Resolves:
 * - Table rows concatenated onto a single line with `|| |`, `||\s*|`, or double pipes `||`
 * - Missing newlines before/after table structures
 * - Ensures code blocks (```...```) are untouched
 *
 * @param {string} content
 * @returns {string}
 */
export function normalizeTableMarkdown(content) {
  if (!content || typeof content !== 'string') return content;

  // Protect code blocks from transformation
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts
    .map((part, index) => {
      // Odd indices are code blocks
      if (index % 2 === 1) return part;

      let text = part;

      // 1. Convert row separators where rows are joined with 3 or more pipes or `|| |`
      // e.g. `| Row 1 || | Row 2 |` -> `| Row 1 |\n| Row 2 |`
      text = text.replace(/\|\s*\|\s*\|/g, '|\n|');

      // 2. Convert double pipes followed by pipe
      text = text.replace(/\|\|\s*\|/g, '|\n|');
      text = text.replace(/\|\|\s*(?=\|)/g, '|\n');

      // 3. Ensure a blank line before the start of a table if preceded by a non-table line
      text = text.replace(/^([^|\n][^\n]*)\n([ \t]*\|[^\n]+\|)/gm, '$1\n\n$2');

      // 4. Ensure a blank line after the table if followed by a non-table line
      text = text.replace(/^([ \t]*\|[^\n]+\|)\n([^|\n\s][^\n]*)$/gm, '$1\n\n$2');

      return text;
    })
    .join('');
}

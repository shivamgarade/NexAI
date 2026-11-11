import { describe, it, expect } from 'vitest';
import { sanitizeForSpeech, isSpeechSynthesisSupported } from './speechSynthesis';

describe('speechSynthesis utility', () => {
  describe('sanitizeForSpeech', () => {
    it('returns empty string for null, undefined, or empty input', () => {
      expect(sanitizeForSpeech(null)).toBe('');
      expect(sanitizeForSpeech(undefined)).toBe('');
      expect(sanitizeForSpeech('')).toBe('');
    });

    it('strips code blocks cleanly so raw code is not read out loud', () => {
      const raw = 'Here is the function:\n```javascript\nconst a = 10;\nconsole.log(a);\n```\nIt works.';
      const clean = sanitizeForSpeech(raw);
      expect(clean).toContain('Code snippet omitted');
      expect(clean).not.toContain('console.log');
    });

    it('strips markdown bold, italics, backticks, and headings', () => {
      const raw = '# Overview\n\nThis is **essential** and _critical_ with `inlineVariable`.';
      const clean = sanitizeForSpeech(raw);
      expect(clean).toBe('Overview This is essential and critical with inlineVariable.');
    });

    it('strips markdown links keeping link text', () => {
      const raw = 'Visit [NexAI Documentation](https://nexai.app/docs) for more details.';
      const clean = sanitizeForSpeech(raw);
      expect(clean).toBe('Visit NexAI Documentation for more details.');
    });

    it('strips markdown list bullets and numbers', () => {
      const raw = 'Steps:\n* First step\n- Second step\n1. Third step';
      const clean = sanitizeForSpeech(raw);
      expect(clean).toContain('First step');
      expect(clean).not.toContain('*');
      expect(clean).not.toContain('-');
    });
  });

  describe('isSpeechSynthesisSupported', () => {
    it('checks speech synthesis availability without throwing', () => {
      expect(typeof isSpeechSynthesisSupported()).toBe('boolean');
    });
  });
});

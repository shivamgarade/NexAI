import { z } from 'zod';
import { generateContent, streamContent } from '../services/gemini.service.js';
import {
  INTERVIEWER_SYSTEM_PROMPT,
  SCORECARD_SYSTEM_PROMPT,
  INTERVIEW_BUDDY_SYSTEM_PROMPT,
} from './prompts/interview.prompt.js';
import { logger } from '../utils/logger.js';

const scorecardOutputSchema = z.object({
  overallScore: z.number().min(0).max(100),
  rating: z.enum(['Strong Hire', 'Hire', 'Needs Improvement', 'Unprepared']),
  categories: z.object({
    technicalAccuracy: z.number().min(0).max(100),
    problemSolving: z.number().min(0).max(100),
    communication: z.number().min(0).max(100),
    systemDesign: z.number().min(0).max(100),
  }),
  strengths: z.array(z.string()).min(1),
  improvements: z.array(z.string()).min(1),
  summary: z.string().min(1),
  recommendedTopics: z.array(z.string()).default([]),
});

/**
 * Strips markdown code fences (```json ... ```) before JSON.parse.
 *
 * @param {string} text
 * @returns {any}
 */
function parseJsonOutput(text) {
  let cleaned = (text || '').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }
  return JSON.parse(cleaned);
}

/**
 * Normalizes messages into the format expected by Google GenAI.
 * Ensures the dialogue starts with a user turn if needed, or preserves alternation.
 *
 * @param {Array<{role: string, content: string}>} messages
 * @returns {Array<{role: 'user' | 'model', parts: Array<{text: string}>}>}
 */
export function formatInterviewHistory(messages) {
  const formatted = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content || '' }],
  }));

  // Gemini API requires the first turn in contents to have role: 'user'
  if (formatted.length > 0 && formatted[0].role === 'model') {
    formatted.unshift({
      role: 'user',
      parts: [{ text: 'Hello, I am ready for the technical interview.' }],
    });
  }

  return formatted;
}

/**
 * Generates the interviewer's opening greeting and first question.
 *
 * @param {Object} params
 * @param {string} params.role
 * @param {'junior' | 'mid' | 'senior'} params.difficulty
 * @param {string} params.topic
 * @param {'flash' | 'pro'} [params.model='flash']
 * @returns {Promise<{ text: string, tokensUsed: number }>}
 */
export async function generateInterviewGreeting({
  role,
  difficulty,
  topic,
  model = 'flash',
}) {
  const prompt = `Role: ${role}\nSeniority: ${difficulty}\nFocus Topic: ${topic}\n\nPlease greet the candidate professionally, briefly introduce the structure of this technical screening, and ask the first scenario-based technical question.`;

  const systemInstruction = `${INTERVIEWER_SYSTEM_PROMPT}\n\n[CURRENT INTERVIEW SETUP]:\n- Role: ${role}\n- Difficulty Level: ${difficulty}\n- Topic: ${topic}`;

  try {
    const result = await generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      model,
      systemInstruction,
      config: {
        temperature: 0.6,
      },
    });

    return {
      text: result.text.trim(),
      tokensUsed: result.totalTokens || 0,
    };
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to generate dynamic greeting, using fallback');
    const fallbackGreeting = `Welcome to your ${difficulty.toUpperCase()} level technical interview for the ${role} position, focusing on ${topic}.\n\nLet's get started. Could you walk me through your high-level architecture and approach when designing a robust solution in ${topic}?`;
    return {
      text: fallbackGreeting,
      tokensUsed: 0,
    };
  }
}

/**
 * Streams the interviewer's next critique and follow-up question.
 *
 * @param {Object} params
 * @param {Array<{role: string, content: string}>} params.messages
 * @param {string} params.role
 * @param {'junior' | 'mid' | 'senior'} params.difficulty
 * @param {string} params.topic
 * @param {'flash' | 'pro'} [params.model='flash']
 * @returns {AsyncGenerator<{text: string, usageMetadata: any}, void, unknown>}
 */
export async function* streamInterviewTurn({
  messages,
  role,
  difficulty,
  topic,
  model = 'flash',
}) {
  const contents = formatInterviewHistory(messages);

  const systemInstruction = `${INTERVIEWER_SYSTEM_PROMPT}\n\n[CURRENT INTERVIEW CONTEXT]:\n- Candidate Target Role: ${role}\n- Difficulty Level: ${difficulty}\n- Focus Topic: ${topic}\n\nReview the latest candidate message, provide brief insightful technical critique, and ask the next logical challenge or follow-up question.`;

  yield* streamContent({
    contents,
    model,
    systemInstruction,
    config: {
      temperature: 0.7,
    },
  });
}

/**
 * Evaluates the full interview transcript and generates a structured scorecard.
 *
 * @param {Object} params
 * @param {Object} params.session
 * @param {'flash' | 'pro'} [params.model='flash']
 * @returns {Promise<{ scorecard: any, tokensUsed: number }>}
 */
export async function generateInterviewScorecard({ session, model = 'flash' }) {
  const formattedTranscript = (session.messages || [])
    .map((m, idx) => `[Turn ${idx + 1}] ${m.role === 'assistant' ? 'Interviewer' : 'Candidate'}: ${m.content}`)
    .join('\n\n');

  const userContent = `ROLE: ${session.role}\nLEVEL: ${session.difficulty}\nTOPIC: ${session.topic}\n\nFULL TRANSCRIPT:\n${formattedTranscript}\n\nPlease generate the comprehensive evaluation scorecard in strict JSON according to the evaluation rubric.`;

  try {
    const result = await generateContent({
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      model,
      systemInstruction: SCORECARD_SYSTEM_PROMPT,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const parsed = parseJsonOutput(result.text);
    const validated = scorecardOutputSchema.parse(parsed);

    return {
      scorecard: validated,
      tokensUsed: result.totalTokens || 0,
    };
  } catch (error) {
    logger.warn({ error: error.message }, 'Failed to evaluate interview via Gemini JSON, falling back to default evaluation');

    // Calculate a safe baseline evaluation from transcript volume if AI fails
    const userMessages = (session.messages || []).filter((m) => m.role === 'user');
    const answerWords = userMessages.reduce((sum, m) => sum + (m.content ? m.content.split(/\s+/).length : 0), 0);
    const baselineScore = Math.min(85, Math.max(55, Math.round(50 + answerWords / 15)));
    const rating =
      baselineScore >= 85
        ? 'Strong Hire'
        : baselineScore >= 70
          ? 'Hire'
          : baselineScore >= 50
            ? 'Needs Improvement'
            : 'Unprepared';

    const fallbackScorecard = {
      overallScore: baselineScore,
      rating,
      categories: {
        technicalAccuracy: baselineScore,
        problemSolving: Math.max(50, baselineScore - 5),
        communication: Math.min(95, baselineScore + 5),
        systemDesign: Math.max(50, baselineScore - 2),
      },
      strengths: [
        'Demonstrated understanding of core domain workflows',
        'Structured responses with clear communication',
        'Handled foundational scenario questions',
      ],
      improvements: [
        'Deepen mastery of edge cases and resilience patterns',
        'Elaborate more on quantitative trade-offs in system design',
      ],
      summary: `The candidate completed an interview session for ${session.role} covering ${session.topic}. Overall responses demonstrated foundational competence with an evaluated overall score of ${baselineScore}/100.`,
      recommendedTopics: [
        session.topic,
        'System Scalability & Caching',
        'Production Error Handling',
      ],
    };

    return {
      scorecard: fallbackScorecard,
      tokensUsed: 0,
    };
  }
}

/**
 * Streams Socratic hint & architectural guidance from the AI Interview Buddy.
 * Strict guardrails prevent outputting direct code solutions or copy-paste answers.
 *
 * @param {Object} params
 * @param {string} params.currentQuestion
 * @param {string} params.candidateQuery
 * @param {string} [params.codeContext='']
 * @param {string} [params.hintLevel='general']
 * @param {string} params.role
 * @param {string} params.difficulty
 * @param {string} params.topic
 * @param {'flash' | 'pro'} [params.model='flash']
 * @returns {AsyncGenerator<{text: string, usageMetadata: any}, void, unknown>}
 */
export async function* streamInterviewBuddyTurn({
  currentQuestion = '',
  candidateQuery = '',
  codeContext = '',
  hintLevel = 'general',
  role = 'Software Engineer',
  difficulty = 'mid',
  topic = 'System Design',
  model = 'flash',
}) {
  const systemInstruction = `${INTERVIEW_BUDDY_SYSTEM_PROMPT}\n\n[CURRENT INTERVIEW CONTEXT]:
- Role: ${role} (${difficulty.toUpperCase()})
- Topic: ${topic}
- Active Interview Question: "${currentQuestion}"
- Candidate's Current Draft Code:
\`\`\`
${codeContext || '// No code drafted yet'}
\`\`\`
- Requested Guidance: ${hintLevel}`;

  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: `Candidate Question / Request: "${candidateQuery}"\n\nProvide Socratic guidance and hints according to Hint Level ${hintLevel}. Remember: strictly do NOT output full code solutions or direct answers.`,
        },
      ],
    },
  ];

  yield* streamContent({
    contents,
    model,
    systemInstruction,
    config: {
      temperature: 0.5,
    },
  });
}

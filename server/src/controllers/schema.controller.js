import { asyncHandler } from '../utils/asyncHandler.js';
import { generateDatabaseSchema } from '../agents/schema.agent.js';
import { deductCredits } from '../services/credit.service.js';

/**
 * Generate a production-ready ER diagram model in Eraser ER language.
 * Protected by creditCheck & metered atomically.
 * POST /api/schemas/generate
 */
export const generateSchema = asyncHandler(async (req, res) => {
  const {
    prompt,
    currentCode = '',
    model: requestedModel,
    isSimulation = false,
  } = req.body;

  const model = requestedModel || req.user.settings?.defaultModel || 'flash';
  const userId = req.user._id;
  const startTime = Date.now();

  const { code, summary, tokensUsed } = await generateDatabaseSchema({
    prompt,
    currentCode,
    model,
    isSimulation,
  });

  let creditsDeducted = 0;
  let creditsRemaining = req.user.wallet?.creditsRemaining ?? 0;

  if (tokensUsed > 0 && !isSimulation) {
    const deduction = await deductCredits({
      userId,
      tokensUsed,
      feature: 'schema',
      model,
    });
    creditsDeducted = deduction.creditsDeducted;
    creditsRemaining = deduction.creditsRemaining;
  }

  const durationMs = Date.now() - startTime;

  res.status(200).json({
    data: {
      code,
      summary,
      telemetry: {
        tokensUsed,
        creditsDeducted,
        creditsRemaining,
        durationMs,
        model,
      },
    },
  });
});

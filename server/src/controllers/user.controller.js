import { asyncHandler } from '../utils/asyncHandler.js';

export const updateSettings = asyncHandler(async (req, res) => {
  const user = req.user;
  const {
    theme,
    defaultModel,
    webSearchDefaultOn,
    thinkingLevel,
    smartTokenOptimization,
    maxContextTurns,
    conversationWidth,
    contrast,
    screenReaderMode,
    conversationSteps,
    font,
    fontSize,
    themePresetLight,
    themePresetDark,
    customColors,
    interviewGuardrailLevel,
    toolExecutionMode,
    personalization,
  } = req.body;

  if (theme !== undefined) user.settings.theme = theme;
  if (defaultModel !== undefined) user.settings.defaultModel = defaultModel;
  if (webSearchDefaultOn !== undefined) user.settings.webSearchDefaultOn = webSearchDefaultOn;
  if (thinkingLevel !== undefined) user.settings.thinkingLevel = thinkingLevel;
  if (smartTokenOptimization !== undefined) user.settings.smartTokenOptimization = smartTokenOptimization;
  if (maxContextTurns !== undefined) user.settings.maxContextTurns = maxContextTurns;
  if (conversationWidth !== undefined) user.settings.conversationWidth = conversationWidth;
  if (contrast !== undefined) user.settings.contrast = contrast;
  if (screenReaderMode !== undefined) user.settings.screenReaderMode = screenReaderMode;
  if (conversationSteps !== undefined) user.settings.conversationSteps = conversationSteps;
  if (font !== undefined) user.settings.font = font;
  if (fontSize !== undefined) user.settings.fontSize = fontSize;
  if (themePresetLight !== undefined) user.settings.themePresetLight = themePresetLight;
  if (themePresetDark !== undefined) user.settings.themePresetDark = themePresetDark;
  if (customColors !== undefined) {
    user.settings.customColors = { ...(user.settings.customColors || {}), ...customColors };
  }
  if (interviewGuardrailLevel !== undefined) user.settings.interviewGuardrailLevel = interviewGuardrailLevel;
  if (toolExecutionMode !== undefined) user.settings.toolExecutionMode = toolExecutionMode;

  if (personalization !== undefined) {
    if (!user.settings.personalization) {
      user.settings.personalization = {};
    }
    if (personalization.customInstructions !== undefined) {
      user.settings.personalization.customInstructions = personalization.customInstructions;
    }
    if (personalization.responseTone !== undefined) {
      user.settings.personalization.responseTone = personalization.responseTone;
    }
    if (personalization.aiMemoryEnabled !== undefined) {
      user.settings.personalization.aiMemoryEnabled = personalization.aiMemoryEnabled;
    }
  }

  await user.save();

  res.status(200).json({
    data: {
      user: user.toJSON(),
    },
  });
});

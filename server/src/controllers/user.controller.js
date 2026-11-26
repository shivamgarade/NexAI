import { asyncHandler } from '../utils/asyncHandler.js';

export const updateSettings = asyncHandler(async (req, res) => {
  const user = req.user;
  const { theme, defaultModel, webSearchDefaultOn, toolExecutionMode, personalization } = req.body;

  if (theme !== undefined) {
    user.settings.theme = theme;
  }
  if (defaultModel !== undefined) {
    user.settings.defaultModel = defaultModel;
  }
  if (webSearchDefaultOn !== undefined) {
    user.settings.webSearchDefaultOn = webSearchDefaultOn;
  }
  if (toolExecutionMode !== undefined) {
    user.settings.toolExecutionMode = toolExecutionMode;
  }
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

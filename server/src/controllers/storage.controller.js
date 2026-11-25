import { storageService } from '../services/storage.service.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';

export const uploadFile = async (req, res, next) => {
  try {
    const { file, fileName, mimeType, source = 'general' } = req.body;

    if (!file) {
      throw ApiError.badRequest('File payload (base64 string) is required');
    }

    const userId = req.user?._id || req.user?.id;
    const result = await storageService.upload({
      file,
      fileName: fileName || `upload_${Date.now()}`,
      mimeType: mimeType || 'application/octet-stream',
      userId,
      source,
    });

    res.status(201).json({
      success: true,
      data: result,
      meta: {
        provider: result.provider,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error({ err: error.message }, 'File upload error in controller');
    next(error);
  }
};

export const listFiles = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const limit = parseInt(req.query.limit, 10) || 50;
    const skip = parseInt(req.query.skip, 10) || 0;

    const files = await storageService.listUserFiles({ userId, limit, skip });

    res.status(200).json({
      success: true,
      data: files,
      meta: {
        total: files.length,
        limit,
        skip,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getStorageStatus = async (req, res) => {
  const provider = storageService.getProvider();
  res.status(200).json({
    success: true,
    data: {
      provider,
      isCloudConfigured: provider !== 'local',
      supportedProviders: ['imagekit', 'cloudinary', 'local'],
    },
  });
};

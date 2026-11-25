import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import LibraryItem from '../models/LibraryItem.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Ensure local uploads directory exists for fallback
if (!fs.existsSync(UPLOADS_DIR)) {
  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    logger.warn({ err: err.message }, 'Failed to create local uploads directory');
  }
}

class StorageService {
  /**
   * Determine the active storage provider based on configured environment variables
   */
  getProvider() {
    if (process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT) {
      return 'imagekit';
    }
    if (
      process.env.CLOUDINARY_CLOUD_NAME &&
      (process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_UPLOAD_PRESET)
    ) {
      return 'cloudinary';
    }
    return 'local';
  }

  /**
   * Upload to ImageKit REST API (Zero-dependency, 20GB free tier)
   */
  async uploadToImageKit({ base64Data, fileName, folder = '/nexai' }) {
    const endpoint = 'https://upload.imagekit.io/api/v1/files/upload';
    const authHeader = `Basic ${Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64')}`;

    const formData = new URLSearchParams();
    formData.append('file', base64Data);
    formData.append('fileName', fileName || `file_${Date.now()}`);
    formData.append('folder', folder);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ImageKit upload failed (${response.status}): ${errText}`);
    }

    const result = await response.json();
    return {
      url: result.url,
      thumbnailUrl: result.thumbnailUrl || result.url,
      fileId: result.fileId,
      name: result.name,
      size: result.size,
      mimeType: result.mimeType || 'application/octet-stream',
      provider: 'imagekit',
    };
  }

  /**
   * Upload to Cloudinary REST API (Zero-dependency, 25 monthly credits free tier)
   */
  async uploadToCloudinary({ base64Data, fileName, mimeType, folder = 'nexai' }) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

    const payload = {
      file: base64Data.startsWith('data:') ? base64Data : `data:${mimeType || 'application/octet-stream'};base64,${base64Data}`,
      folder,
    };

    if (process.env.CLOUDINARY_UPLOAD_PRESET) {
      payload.upload_preset = process.env.CLOUDINARY_UPLOAD_PRESET;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudinary upload failed (${response.status}): ${errText}`);
    }

    const result = await response.json();
    return {
      url: result.secure_url,
      thumbnailUrl: result.thumbnail_url || result.secure_url,
      fileId: result.public_id,
      name: fileName || result.original_filename || 'uploaded_file',
      size: result.bytes,
      mimeType: mimeType || 'application/octet-stream',
      provider: 'cloudinary',
    };
  }

  /**
   * Local filesystem fallback (Zero setup, ideal for offline/local dev)
   */
  async uploadToLocal({ buffer, fileName, mimeType }) {
    const ext = path.extname(fileName) || '';
    const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);

    await fs.promises.writeFile(filePath, buffer);

    const clientBase = env.CLIENT_URL || 'http://localhost:5173';
    // Return relative or full local URL
    const relativeUrl = `/uploads/${uniqueName}`;

    return {
      url: relativeUrl,
      thumbnailUrl: relativeUrl,
      fileId: uniqueName,
      name: fileName,
      size: buffer.length,
      mimeType: mimeType || 'application/octet-stream',
      provider: 'local',
    };
  }

  /**
   * Universal upload method: automatically chooses ImageKit -> Cloudinary -> Local
   */
  async upload({ file, fileName, mimeType, userId, source = 'general', folder = '/nexai' }) {
    let cleanBase64 = file;
    let buffer;

    if (typeof file === 'string' && file.includes('base64,')) {
      const parts = file.split('base64,');
      cleanBase64 = parts[1];
      buffer = Buffer.from(cleanBase64, 'base64');
    } else if (typeof file === 'string') {
      cleanBase64 = file;
      buffer = Buffer.from(file, 'base64');
    } else if (Buffer.isBuffer(file)) {
      buffer = file;
      cleanBase64 = file.toString('base64');
    } else {
      throw new Error('Invalid file payload: Expected base64 string or Buffer');
    }

    const provider = this.getProvider();
    let uploadResult;

    try {
      if (provider === 'imagekit') {
        uploadResult = await this.uploadToImageKit({
          base64Data: cleanBase64,
          fileName,
          folder,
        });
      } else if (provider === 'cloudinary') {
        uploadResult = await this.uploadToCloudinary({
          base64Data: cleanBase64,
          fileName,
          mimeType,
          folder: folder.replace(/^\//, ''),
        });
      } else {
        uploadResult = await this.uploadToLocal({
          buffer,
          fileName,
          mimeType,
        });
      }
    } catch (err) {
      logger.warn(
        { provider, err: err.message },
        'Cloud upload failed, falling back to local storage',
      );
      uploadResult = await this.uploadToLocal({ buffer, fileName, mimeType });
    }

    // Automatically register as a LibraryItem file asset if userId is provided
    let libraryItem = null;
    if (userId) {
      try {
        libraryItem = await LibraryItem.create({
          userId,
          type: 'file',
          title: fileName || uploadResult.name || 'Uploaded File',
          summary: `Stored via ${uploadResult.provider} (${uploadResult.mimeType}, ${uploadResult.size} bytes)`,
          url: uploadResult.url,
          fileName: uploadResult.name,
          mimeType: uploadResult.mimeType,
          size: uploadResult.size,
          tags: ['file', 'upload', source, uploadResult.provider],
        });
      } catch (dbErr) {
        logger.warn({ err: dbErr.message }, 'Failed to create LibraryItem record for uploaded file');
      }
    }

    return {
      ...uploadResult,
      libraryItemId: libraryItem?._id || null,
    };
  }

  /**
   * List all user's uploaded files (from LibraryItem collection)
   */
  async listUserFiles({ userId, limit = 50, skip = 0 }) {
    if (!userId) return [];
    return LibraryItem.find({ userId, type: 'file' })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }
}

export const storageService = new StorageService();

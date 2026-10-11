import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { ErrorLog } from '../models/ErrorLog.js';
import { env } from '../config/env.js';
import { isDbConnected } from '../config/db.js';

export async function errorHandler(err, req, res, _next) {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected server error occurred';
  let details = null;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = err.message;
  } else if (err.code === 11000) {
    statusCode = 409;
    code = 'DUPLICATE_KEY_ERROR';
    message = 'A resource with that identifier already exists';
  } else if (err.type === 'entity.too.large' || err.status === 413) {
    statusCode = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message =
      'File size is too large (maximum allowed size is 10 MB). Please upload a smaller video clip or compress the file.';
  }

  // Log error
  logger.error(
    {
      statusCode,
      code,
      message: err.message,
      details,
      stack: env.NODE_ENV === 'development' ? err.stack : undefined,
      path: req.originalUrl,
    },
    'Request Error',
  );

  // Write ErrorLog for 500 and above if DB is connected
  if (statusCode >= 500 && isDbConnected()) {
    try {
      await ErrorLog.create({
        route: req.originalUrl,
        method: req.method,
        status: statusCode,
        message: err.message || message,
        stack: err.stack,
        userId: req.user?._id || req.userId || null,
      });
    } catch (logErr) {
      logger.error({ err: logErr.message }, 'Failed to record ErrorLog in database');
    }
  }

  res.status(statusCode).json({
    error: {
      code,
      message,
      details,
    },
  });
}

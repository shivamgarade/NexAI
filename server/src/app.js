import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ApiError } from './utils/ApiError.js';
import apiRoutes from './routes/index.js';
import healthRoutes from './routes/health.routes.js';
import webhookRoutes from './routes/webhook.routes.js';

export const app = express();

// Trust proxy for secure cookies and accurate IP rate-limiting behind reverse proxies (Render, Vercel)
app.set('trust proxy', 1);

// Security and utility middleware
app.use(helmet());
app.use(
  cors({
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  }),
);
app.use(cookieParser());

// Webhook routes require raw body Buffer for HMAC SHA256 signature verification
app.use('/api/webhooks', express.raw({ type: '*/*' }), webhookRoutes);
app.use('/webhooks', express.raw({ type: '*/*' }), webhookRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(requestLogger);

// Health check route (supports both /health and /api/health for Render/Uptime monitors)
app.use('/health', healthRoutes);

// API routes
app.use('/api', apiRoutes);

// 404 handler
app.use((req, res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`));
});

// Centralized error handler
app.use(errorHandler);

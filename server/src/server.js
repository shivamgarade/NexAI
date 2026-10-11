import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import { logger } from './utils/logger.js';

import { systemConfigService } from './services/systemConfig.service.js';
import { ensureSystemSkills } from './services/skill.service.js';

let server;

async function startServer() {
  await connectDB();
  await systemConfigService.getConfig();
  await ensureSystemSkills();

  server = app.listen(env.PORT, () => {
    logger.info(`🚀 NexAI Server running in ${env.NODE_ENV} mode on port ${env.PORT}`);
    logger.info(`Health check available at http://localhost:${env.PORT}/api/health`);
  });
}

async function gracefulShutdown(signal) {
  logger.info(`${signal} received. Initiating graceful shutdown...`);

  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed.');
      await disconnectDB();
      logger.info('Graceful shutdown completed.');
      process.exit(0);
    });

    // Force close after 10 seconds if still open
    setTimeout(() => {
      logger.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  } else {
    await disconnectDB();
    process.exit(0);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer().catch((err) => {
  logger.error({ err }, 'Server failed to start');
  process.exit(1);
});

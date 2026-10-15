import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import adminRoutes from './admin.routes.js';
import chatRoutes from './chat.routes.js';
import libraryRoutes from './library.routes.js';
import projectRoutes from './project.routes.js';
import promptRoutes from './prompt.routes.js';
import skillRoutes from './skill.routes.js';
import interviewRoutes from './interview.routes.js';
import searchRoutes from './search.routes.js';
import walletRoutes from './wallet.routes.js';
import memoryRoutes from './memory.routes.js';
import schemaRoutes from './schema.routes.js';
import scheduleRoutes from './schedule.routes.js';
import connectedAppRoutes from './connectedApp.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
router.use('/chats', chatRoutes);
router.use('/library', libraryRoutes);
router.use('/projects', projectRoutes);
router.use('/prompts', promptRoutes);
router.use('/skills', skillRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/connected-apps', connectedAppRoutes);
router.use('/interview', interviewRoutes);
router.use('/search', searchRoutes);
router.use('/wallet', walletRoutes);
router.use('/memories', memoryRoutes);
router.use('/schemas', schemaRoutes);

export default router;


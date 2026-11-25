import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { uploadFile, listFiles, getStorageStatus } from '../controllers/storage.controller.js';

const router = Router();

router.use(auth);

router.post('/upload', uploadFile);
router.get('/files', listFiles);
router.get('/status', getStorageStatus);

export default router;

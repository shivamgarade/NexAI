import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { getConnectedApps, updateConnectedApp } from '../controllers/connectedApp.controller.js';

const router = Router();

router.use(auth);

router.get('/', getConnectedApps);
router.patch('/:slug', updateConnectedApp);

export default router;

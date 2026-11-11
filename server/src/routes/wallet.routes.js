import { Router } from 'express';
import * as walletController from '../controllers/wallet.controller.js';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createOrderSchema,
  verifyPaymentSchema,
  getTransactionsQuerySchema,
  updateGovernanceModeSchema,
} from '../validators/wallet.validator.js';

const router = Router();

// All wallet endpoints are authenticated and scoped to req.user
router.get('/', auth, walletController.getWallet);
router.patch('/mode', auth, validate({ body: updateGovernanceModeSchema }), walletController.updateGovernanceMode);
router.get('/plans', auth, walletController.getPlans);
router.post('/orders', auth, validate({ body: createOrderSchema }), walletController.createOrder);
router.post('/verify', auth, validate({ body: verifyPaymentSchema }), walletController.verifyPayment);
router.get(
  '/transactions',
  auth,
  validate({ query: getTransactionsQuerySchema }),
  walletController.getTransactions,
);

export default router;

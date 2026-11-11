import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { auth } from '../middleware/auth.js';
import { creditCheck } from '../middleware/creditCheck.js';
import { validate } from '../middleware/validate.js';
import {
  createChatSchema,
  updateChatSchema,
  sendMessageSchema,
  chatIdParamSchema,
} from '../validators/chat.validator.js';
import {
  getChats,
  createChat,
  updateChat,
  deleteChat,
  getMessages,
  sendMessage,
} from '../controllers/chat.controller.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 AI requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many AI requests from this IP, please try again shortly',
      details: null,
    },
  },
});

// All chat endpoints require authenticated user session
router.use(auth);

router.get('/', getChats);
router.post('/', validate({ body: createChatSchema }), createChat);
router.patch('/:id', validate({ params: chatIdParamSchema, body: updateChatSchema }), updateChat);
router.delete('/:id', validate({ params: chatIdParamSchema }), deleteChat);

router.get('/:id/messages', validate({ params: chatIdParamSchema }), getMessages);
router.post(
  '/:id/messages',
  aiLimiter,
  validate({ params: chatIdParamSchema, body: sendMessageSchema }),
  creditCheck,
  sendMessage,
);

export default router;

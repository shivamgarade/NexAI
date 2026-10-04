import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { auth } from '../middleware/auth.js';
import { creditCheck } from '../middleware/creditCheck.js';
import { validate } from '../middleware/validate.js';
import { generateSchemaValidator } from '../validators/schema.validator.js';
import { generateSchema } from '../controllers/schema.controller.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    process.env.NODE_ENV === 'test' ||
    req.body?.isSimulation === true ||
    req.headers?.['x-simulation'] === 'true',
  message: {
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many AI requests from this IP, please try again shortly',
      details: null,
    },
  },
});

// All schema endpoints require authentication
router.use(auth);

router.post(
  '/generate',
  aiLimiter,
  creditCheck,
  validate({ body: generateSchemaValidator }),
  generateSchema,
);

export default router;

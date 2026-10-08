import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { auth } from '../middleware/auth.js';
import { creditCheck } from '../middleware/creditCheck.js';
import { validate } from '../middleware/validate.js';
import {
  startInterviewSchema,
  respondInterviewSchema,
  interviewIdParamSchema,
  interviewTtsSchema,
} from '../validators/interview.validator.js';
import {
  startInterview,
  respondInterview,
  concludeInterview,
  getInterviews,
  getInterviewById,
  synthesizeInterviewSpeech,
} from '../controllers/interview.controller.js';

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

// All interview endpoints require authenticated user session
router.use(auth);

router.get('/', getInterviews);
router.post('/start', aiLimiter, creditCheck, validate({ body: startInterviewSchema }), startInterview);
router.get('/:id', validate({ params: interviewIdParamSchema }), getInterviewById);
router.post(
  '/:id/respond',
  aiLimiter,
  creditCheck,
  validate({ params: interviewIdParamSchema, body: respondInterviewSchema }),
  respondInterview,
);
router.post(
  '/:id/conclude',
  aiLimiter,
  creditCheck,
  validate({ params: interviewIdParamSchema }),
  concludeInterview,
);
router.post(
  '/tts',
  aiLimiter,
  creditCheck,
  validate({ body: interviewTtsSchema }),
  synthesizeInterviewSpeech,
);

export default router;

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { auth } from '../middleware/auth.js';
import { creditCheck } from '../middleware/creditCheck.js';
import { validate } from '../middleware/validate.js';
import {
  suggestLibrarySchema,
  generateDocumentSchema,
  createLibraryItemSchema,
  updateLibraryItemSchema,
  queryLibrarySchema,
  searchLibrarySchema,
} from '../validators/library.validator.js';
import {
  suggestItem,
  generateDocument,
  exportDocumentPdf,
  createItem,
  listItems,
  getItemById,
  updateItem,
  deleteItem,
  searchItems,
  aiWrite,
} from '../controllers/library.controller.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
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

// All library routes require authentication
router.use(auth);

// Suggestion endpoint (metered AI call, does not save to DB)
router.post(
  '/suggest',
  aiLimiter,
  creditCheck,
  validate({ body: suggestLibrarySchema }),
  suggestItem,
);

// Structured Document Generation endpoint (metered AI call, does not save to DB)
router.post(
  '/documents/generate',
  aiLimiter,
  creditCheck,
  validate({ body: generateDocumentSchema }),
  generateDocument,
);

// Inline AI Co-Writer for Notion-style notes
router.post('/ai-write', aiLimiter, creditCheck, aiWrite);

// Styled PDF Export stream endpoint
router.get('/documents/:id/export.pdf', exportDocumentPdf);

// Core CRUD & Search
router.post('/', validate({ body: createLibraryItemSchema }), createItem);
router.get('/', validate({ query: queryLibrarySchema }), listItems);
router.get('/search', validate({ query: searchLibrarySchema }), searchItems);

router.get('/:id', getItemById);
router.patch('/:id', validate({ body: updateLibraryItemSchema }), updateItem);
router.delete('/:id', deleteItem);

export default router;

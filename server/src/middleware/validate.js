import { ApiError } from '../utils/ApiError.js';

/**
 * Creates a middleware that validates request segments against Zod schemas.
 * @param {object} schemas
 * @param {import('zod').ZodSchema} [schemas.body]
 * @param {import('zod').ZodSchema} [schemas.query]
 * @param {import('zod').ZodSchema} [schemas.params]
 */
export function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    try {
      if (body) {
        req.body = body.parse(req.body);
      }
      if (query) {
        req.query = query.parse(req.query);
      }
      if (params) {
        req.params = params.parse(req.params);
      }
      next();
    } catch (error) {
      if (error.errors) {
        const details = error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        const summary = details
          .map((d) => (d.path ? `${d.path}: ${d.message}` : d.message))
          .join(', ');
        const message = summary ? `Request validation failed: ${summary}` : 'Request validation failed';
        return next(new ApiError(400, 'VALIDATION_ERROR', message, details));
      }
      next(error);
    }
  };
}

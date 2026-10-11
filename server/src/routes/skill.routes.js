import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createSkillSchema,
  updateSkillSchema,
  skillQuerySchema,
  skillIdParamSchema,
} from '../validators/skill.validator.js';
import {
  getSkills,
  getSkillById,
  createSkill,
  updateSkill,
  deleteSkill,
  toggleFavorite,
} from '../controllers/skill.controller.js';

const router = Router();

router.use(auth);

router.get('/', validate({ query: skillQuerySchema }), getSkills);
router.post('/', validate({ body: createSkillSchema }), createSkill);
router.get('/:id', validate({ params: skillIdParamSchema }), getSkillById);
router.patch(
  '/:id',
  validate({ params: skillIdParamSchema, body: updateSkillSchema }),
  updateSkill,
);
router.delete('/:id', validate({ params: skillIdParamSchema }), deleteSkill);
router.post('/:id/favorite', validate({ params: skillIdParamSchema }), toggleFavorite);

export default router;

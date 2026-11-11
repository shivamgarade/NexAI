import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createScheduleSchema,
  updateScheduleSchema,
  scheduleIdParamSchema,
} from '../validators/schedule.validator.js';
import {
  getSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  toggleSchedule,
  runScheduleNow,
} from '../controllers/schedule.controller.js';

const router = Router();

router.use(auth);

router.get('/', getSchedules);
router.post('/', validate({ body: createScheduleSchema }), createSchedule);
router.get('/:id', validate({ params: scheduleIdParamSchema }), getScheduleById);
router.patch(
  '/:id',
  validate({ params: scheduleIdParamSchema, body: updateScheduleSchema }),
  updateSchedule,
);
router.delete('/:id', validate({ params: scheduleIdParamSchema }), deleteSchedule);
router.patch('/:id/toggle', validate({ params: scheduleIdParamSchema }), toggleSchedule);
router.post('/:id/run-now', validate({ params: scheduleIdParamSchema }), runScheduleNow);

export default router;

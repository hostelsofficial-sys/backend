import { Router } from 'express';
import { UsersController } from './users.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize, notTerminated } from '../../middleware/auth.middleware';
import { selfVerifySchema, updateProfileSchema } from './users.schema';

const router = Router();
const usersController = new UsersController();

// Student routes
router.post(
  '/student/self-verify',
  authenticate,
  authorize('STUDENT'),
  notTerminated,
  validate(selfVerifySchema),
  (req, res) => usersController.selfVerify(req, res)
);

router.get(
  '/student/profile',
  authenticate,
  authorize('STUDENT'),
  (req, res) => usersController.getMyStudentProfile(req, res)
);

// Manager routes
router.get(
  '/manager/profile',
  authenticate,
  authorize('MANAGER'),
  (req, res) => usersController.getMyManagerProfile(req, res)
);

router.patch(
  '/manager/profile',
  authenticate,
  authorize('MANAGER'),
  notTerminated,
  validate(updateProfileSchema),
  (req, res) => usersController.updateManagerProfile(req, res)
);

// Admin routes
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'SUBADMIN'),
  (req, res) => usersController.getAllUsers(req, res)
);

router.post(
  '/:id/terminate',
  authenticate,
  authorize('ADMIN', 'SUBADMIN'),
  (req, res) => usersController.terminateUser(req, res)
);

//Delete Account for Manager & Student (Self-Delete) :
router.delete(
  '/delete',
  authenticate,
  notTerminated,
  (req, res) => usersController.deleteMyAccount(req, res)
);

export default router;
import { Router } from 'express';
import { BookingsController } from './bookings.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize, notTerminated } from '../../middleware/auth.middleware';
import { handleMulterError, parseFormData } from '../../middleware/upload.middleware';
import { uploadTransactionImage } from '../../config/cloudinary';
import {
  createBookingSchema,
  disapproveBookingSchema,
  leaveHostelSchema,
  kickStudentSchema,
} from './bookings.schema';

const router = Router();
const bookingsController = new BookingsController();

// Student routes
router.post(
  '/',
  authenticate,
  authorize('STUDENT'),
  notTerminated,
  uploadTransactionImage,
  parseFormData,
  (req, res) => bookingsController.create(req, res)
);

router.get(
  '/my',
  authenticate,
  authorize('STUDENT'),
  (req, res) => bookingsController.getMyBookings(req, res)
);

router.post(
  '/leave',
  authenticate,
  authorize('STUDENT'),
  notTerminated,
  validate(leaveHostelSchema),
  (req, res) => bookingsController.leave(req, res)
);

// Manager routes
router.get(
  '/hostel/:hostelId',
  authenticate,
  authorize('MANAGER'),
  (req, res) => bookingsController.getHostelBookings(req, res)
);

router.post(
  '/:id/approve',
  authenticate,
  authorize('MANAGER'),
  notTerminated,
  (req, res) => bookingsController.approve(req, res)
);

router.post(
  '/:id/disapprove',
  authenticate,
  authorize('MANAGER'),
  notTerminated,
  validate(disapproveBookingSchema),
  (req, res) => bookingsController.disapprove(req, res)
);

router.post(
  '/:id/kick',
  authenticate,
  authorize('MANAGER'),
  notTerminated,
  validate(kickStudentSchema),
  (req, res) => bookingsController.kick(req, res)
);

// Admin routes
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'SUBADMIN'),
  (req, res) => bookingsController.getAll(req, res)
);

router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUBADMIN'),
  (req, res) => bookingsController.getById(req, res)
);

export default router;
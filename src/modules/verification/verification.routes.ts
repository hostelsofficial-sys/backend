import { Router } from 'express';
import { VerificationController } from './verification.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize, notTerminated } from '../../middleware/auth.middleware';
import { handleMulterError, parseFormData } from '../../middleware/upload.middleware';
import { uploadVerificationImages } from '../../config/cloudinary';
import { submitVerificationSchema, reviewVerificationSchema } from './verification.schema';

const router = Router();
const verificationController = new VerificationController();

// Manager routes
router.post(
  '/',
  authenticate,
  authorize('MANAGER'),
  notTerminated,
  (req, res, next) => {
    uploadVerificationImages(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  parseFormData,
  validate(submitVerificationSchema),
  (req, res) => verificationController.submit(req, res)
);

router.get(
  '/my',
  authenticate,
  authorize('MANAGER'),
  (req, res) => verificationController.getMyVerifications(req, res)
);

// Admin routes
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'SUBADMIN'),
  (req, res) => verificationController.getAll(req, res)
);

router.get(
  '/:id',
  authenticate,
  authorize('ADMIN', 'SUBADMIN'),
  (req, res) => verificationController.getById(req, res)
);

router.post(
  '/:id/review',
  authenticate,
  authorize('ADMIN', 'SUBADMIN'),
  validate(reviewVerificationSchema),
  (req, res) => verificationController.review(req, res)
);

export default router;
import { Router } from 'express';
import { FeesController } from './fees.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize, notTerminated } from '../../middleware/auth.middleware';
import { handleMulterError, parseFormData } from '../../middleware/upload.middleware';
import { uploadPaymentProof } from '../../config/cloudinary';
import { submitFeeSchema, reviewFeeSchema } from './fees.schema';

const router = Router();
const feesController = new FeesController();

// Manager routes
router.post(
  '/',
  authenticate,
  authorize('MANAGER'),
  notTerminated,
  (req, res, next) => {
    uploadPaymentProof(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  parseFormData,
  validate(submitFeeSchema),
  (req, res) => feesController.submit(req, res)
);

router.get(
  '/my',
  authenticate,
  authorize('MANAGER'),
  (req, res) => feesController.getMyFees(req, res)
);

router.get(
  '/pending-summary',
  authenticate,
  authorize('MANAGER'),
  (req, res) => feesController.getPendingSummary(req, res)
);

// Admin routes
router.get(
  '/',
  authenticate,
  authorize('ADMIN', 'SUBADMIN'),
  (req, res) => feesController.getAll(req, res)
);

router.post(
  '/:id/review',
  authenticate,
  authorize('ADMIN', 'SUBADMIN'),
  validate(reviewFeeSchema),
  (req, res) => feesController.review(req, res)
);

export default router;
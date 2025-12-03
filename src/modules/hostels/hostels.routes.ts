import { Router } from 'express';
import { HostelsController } from './hostels.controller';
import { validate } from '../../middleware/validate.middleware';
import { authenticate, authorize, notTerminated } from '../../middleware/auth.middleware';
import { handleMulterError, parseFormData } from '../../middleware/upload.middleware';
import { uploadHostelImages } from '../../config/cloudinary';
import { createHostelSchema, updateHostelSchema } from './hostels.schema';

const router = Router();
const hostelsController = new HostelsController();

// Public routes
router.get('/search', (req, res) => hostelsController.search(req as any, res));
router.get('/reviews/random', (req, res) => hostelsController.getRandomReviews(req as any, res)); // NEW
router.get('/:id', (req, res) => hostelsController.getById(req as any, res));

// Manager routes
router.post(
  '/',
  authenticate,
  authorize('MANAGER'),
  notTerminated,
  (req, res, next) => {
    uploadHostelImages(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  parseFormData,
  validate(createHostelSchema),
  (req, res) => hostelsController.create(req, res)
);

router.get(
  '/manager/my',
  authenticate,
  authorize('MANAGER'),
  (req, res) => hostelsController.getMyHostels(req, res)
);

router.patch(
  '/:id',
  authenticate,
  authorize('MANAGER'),
  notTerminated,
  (req, res, next) => {
    uploadHostelImages(req, res, (err) => {
      if (err) return handleMulterError(err, req, res, next);
      next();
    });
  },
  parseFormData,
  validate(updateHostelSchema),
  (req, res) => hostelsController.update(req, res)
);

router.delete(
  '/:id',
  authenticate,
  authorize('MANAGER'),
  notTerminated,
  (req, res) => hostelsController.delete(req, res)
);

router.get(
  '/:id/students',
  authenticate,
  authorize('MANAGER'),
  (req, res) => hostelsController.getHostelStudents(req, res)
);

// Admin routes
router.get(
  '/admin/all',
  authenticate,
  authorize('ADMIN', 'SUBADMIN'),
  (req, res) => hostelsController.getAll(req, res)
);

export default router;
import { Response } from 'express';
import { AuthRequest } from '../../types';
import { VerificationService } from './verification.service';

const verificationService = new VerificationService();

export class VerificationController {
  async submit(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get uploaded file URLs from Cloudinary
      const files = req.files as Express.Multer.File[];
      const buildingImages = files?.map((file: any) => file.path) || [];
      
      const data = {
        ...req.body,
        buildingImages,
      };
      
      const result = await verificationService.submitVerification(req.user!.userId, data);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getMyVerifications(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await verificationService.getMyVerifications(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const result = await verificationService.getAllVerifications(status);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await verificationService.getVerificationById(req.params.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async review(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await verificationService.reviewVerification(
        req.params.id,
        req.user!.userId,
        req.body
      );
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
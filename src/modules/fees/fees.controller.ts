import { Response } from 'express';
import { AuthRequest } from '../../types';
import { FeesService } from './fees.service';

const feesService = new FeesService();

export class FeesController {
  async submit(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get uploaded file URL from Cloudinary
      const file = req.file as any;
      const paymentProofImage = file?.path || '';
      
      if (!paymentProofImage) {
        res.status(400).json({ success: false, message: 'Payment proof image is required' });
        return;
      }
      
      const data = {
        ...req.body,
        paymentProofImage,
      };
      
      const result = await feesService.submitMonthlyFee(req.user!.userId, data);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getMyFees(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await feesService.getMyFees(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getPendingSummary(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await feesService.getPendingFeeSummary(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const result = await feesService.getAllFees(status);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async review(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await feesService.reviewFee(req.params.id, req.user!.userId, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
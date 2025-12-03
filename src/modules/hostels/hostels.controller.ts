import { Response } from 'express';
import { AuthRequest } from '../../types';
import { HostelsService } from './hostels.service';

const hostelsService = new HostelsService();

export class HostelsController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get uploaded file URLs from Cloudinary
      const files = req.files as Express.Multer.File[];
      const roomImages = files?.map((file: any) => file.path) || [];
      
      // Merge with body data
      const data = {
        ...req.body,
        roomImages,
      };
      
      const result = await hostelsService.createHostel(req.user!.userId, data);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    try {
      // Get uploaded file URLs from Cloudinary (if any new images)
      const files = req.files as Express.Multer.File[];
      const newImages = files?.map((file: any) => file.path) || [];
      
      // If new images uploaded, use them; otherwise keep existing
      const data = {
        ...req.body,
        ...(newImages.length > 0 && { roomImages: newImages }),
      };
      
      const result = await hostelsService.updateHostel(req.user!.userId, req.params.id, data);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await hostelsService.deleteHostel(req.user!.userId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getMyHostels(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await hostelsService.getMyHostels(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async search(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await hostelsService.searchHostels(req.query as any);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await hostelsService.getHostelById(req.params.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getHostelStudents(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await hostelsService.getHostelStudents(req.user!.userId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await hostelsService.getAllHostels();
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  // NEW: Get random reviews for homepage
  async getRandomReviews(req: AuthRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 4;
      const result = await hostelsService.getRandomReviews(limit);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
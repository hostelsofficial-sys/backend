import { Response } from 'express';
import { ZodError } from 'zod';
import { AuthRequest } from '../../types';
import { BookingsService } from './bookings.service';
import { createBookingSchema } from './bookings.schema';

const bookingsService = new BookingsService();

export class BookingsController {
  async create(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Transaction image is required' });
        return;
      }

      const data = {
        ...req.body,
        transactionImage: req.file.path,
      };

      const validatedData = createBookingSchema.parse(data);

      const result = await bookingsService.createBooking(req.user!.userId, validatedData);
      res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      if (error instanceof ZodError) {
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.flatten().fieldErrors,
        });
        return;
      }
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getManagerBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await bookingsService.getManagerBookings(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getMyBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await bookingsService.getMyBookings(req.user!.userId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getHostelBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await bookingsService.getHostelBookings(req.user!.userId, req.params.hostelId);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async approve(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await bookingsService.approveBooking(req.user!.userId, req.params.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async disapprove(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await bookingsService.disapproveBooking(req.user!.userId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async leave(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await bookingsService.leaveHostel(req.user!.userId, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async kick(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await bookingsService.kickStudent(req.user!.userId, req.params.id, req.body);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const status = req.query.status as string | undefined;
      const result = await bookingsService.getAllBookings(status);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const result = await bookingsService.getBookingById(req.params.id);
      res.json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
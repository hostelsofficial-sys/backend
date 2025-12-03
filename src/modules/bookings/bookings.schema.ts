// src/modules/bookings/bookings.schema.ts
import { z } from 'zod';

export const createBookingSchema = z.object({
  hostelId: z.string(),
  roomType: z.enum(['SHARED', 'PRIVATE', 'SHARED_FULLROOM']),
  transactionImage: z.string().url(),
  transactionDate: z.string(),
  transactionTime: z.string(),
  fromAccount: z.string(),
  toAccount: z.string(),
});

export const disapproveBookingSchema = z.object({
  refundImage: z.string().url(),
  refundDate: z.string(),
  refundTime: z.string(),
});

export const leaveHostelSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  review: z.string().min(1),
  reason: z.string().optional(),
});

export const kickStudentSchema = z.object({
  kickReason: z.enum(['LEFT_HOSTEL', 'VIOLATED_RULES']),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type DisapproveBookingInput = z.infer<typeof disapproveBookingSchema>;
export type LeaveHostelInput = z.infer<typeof leaveHostelSchema>;
export type KickStudentInput = z.infer<typeof kickStudentSchema>;
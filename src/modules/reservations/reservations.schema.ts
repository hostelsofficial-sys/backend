// src/modules/reservations/reservations.schema.ts
import { z } from 'zod';

export const createReservationSchema = z.object({
  hostelId: z.string(),
  roomType: z.enum(['SHARED', 'PRIVATE', 'SHARED_FULLROOM']), // NEW
  message: z.string().optional(),
});

export const reviewReservationSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
  rejectReason: z.string().optional(),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type ReviewReservationInput = z.infer<typeof reviewReservationSchema>;
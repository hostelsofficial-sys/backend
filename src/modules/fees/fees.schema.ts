import { z } from 'zod';

export const submitFeeSchema = z.object({
  hostelId: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Format: YYYY-MM'),
  // paymentProofImage will be handled via file upload
  paymentProofImage: z.string().optional(),
});

export const reviewFeeSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export type SubmitFeeInput = z.infer<typeof submitFeeSchema>;
export type ReviewFeeInput = z.infer<typeof reviewFeeSchema>;
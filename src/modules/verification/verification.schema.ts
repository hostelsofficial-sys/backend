import { z } from 'zod';

const customBankSchema = z.object({
  bankName: z.string().min(1),
  accountNumber: z.string().min(1),
  iban: z.string().optional(),
});

export const submitVerificationSchema = z.object({
  initialHostelNames: z.array(z.string()).min(1),
  ownerName: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  // buildingImages will be handled via file upload
  buildingImages: z.array(z.string()).optional(),
  hostelFor: z.enum(['BOYS', 'GIRLS']),
  easypaisaNumber: z.string().optional(),
  jazzcashNumber: z.string().optional(),
  customBanks: z.array(customBankSchema).optional().default([]),
  acceptedRules: z.preprocess(
    (val) => val === 'true' || val === true,
    z.boolean().refine(val => val === true, {
      message: 'Must accept rules',
    })
  ),
});

export const reviewVerificationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  adminComment: z.string().optional(),
});

export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;
export type ReviewVerificationInput = z.infer<typeof reviewVerificationSchema>;
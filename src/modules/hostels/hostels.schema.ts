// src/modules/hostels/hostels.schema.ts
import { z } from 'zod';

const facilitiesSchema = z.object({
  hotColdWaterBath: z.boolean().default(false),
  drinkingWater: z.boolean().default(false),
  electricityBackup: z.boolean().default(false),
  electricityType: z.enum(['INCLUDED', 'SELF']).default('INCLUDED'),
  electricityRatePerUnit: z.number().nullable().optional(),
  wifiEnabled: z.boolean().default(false),
  wifiPlan: z.string().nullable().optional(),
  wifiMaxUsers: z.number().nullable().optional(),
  wifiAvgSpeed: z.string().nullable().optional(),
  customFacilities: z.array(z.string()).default([]),
});

// Room type configuration schema
const roomTypeConfigSchema = z.object({
  type: z.enum(['SHARED', 'PRIVATE', 'SHARED_FULLROOM']),
  totalRooms: z.coerce.number().int().positive(),
  personsInRoom: z.coerce.number().int().positive(),
  price: z.coerce.number().positive(),
  fullRoomPriceDiscounted: z.coerce.number().nullable().optional(),
  urgentBookingPrice: z.coerce.number().nullable().optional(), // NEW: Urgent booking price
}).refine(data => {
  // fullRoomPriceDiscounted only valid for SHARED_FULLROOM
  if (data.type !== 'SHARED_FULLROOM' && data.fullRoomPriceDiscounted) {
    return false;
  }
  return true;
}, {
  message: 'Discounted full room price only applies to SHARED_FULLROOM type',
});

export const createHostelSchema = z.object({
  hostelName: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  nearbyLocations: z.array(z.string()).default([]),
  hostelFor: z.enum(['BOYS', 'GIRLS']),
  
  // Array of room types (at least one required)
  roomTypes: z.array(roomTypeConfigSchema).min(1, 'At least one room type is required'),
  
  facilities: facilitiesSchema,
  roomImages: z.array(z.string()).optional(),
  rules: z.string().optional(),
  seoKeywords: z.array(z.string()).default([]),
}).refine(data => {
  // Ensure no duplicate room types
  const types = data.roomTypes.map(rt => rt.type);
  return new Set(types).size === types.length;
}, {
  message: 'Each room type can only be added once',
});

export const updateHostelSchema = createHostelSchema.partial();

export const searchHostelsSchema = z.object({
  city: z.string().optional(),
  nearbyLocation: z.string().optional(),
  roomType: z.enum(['SHARED', 'PRIVATE', 'SHARED_FULLROOM']).optional(),
  hostelFor: z.enum(['BOYS', 'GIRLS']).optional(),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
});

export type RoomTypeConfig = z.infer<typeof roomTypeConfigSchema>;
export type CreateHostelInput = z.infer<typeof createHostelSchema>;
export type UpdateHostelInput = z.infer<typeof updateHostelSchema>;
export type SearchHostelsInput = z.infer<typeof searchHostelsSchema>;
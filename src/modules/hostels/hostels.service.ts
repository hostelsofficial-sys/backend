// src/modules/hostels/hostels.service.ts
import { prisma } from '../../config/prisma';
import { CreateHostelInput, UpdateHostelInput, SearchHostelsInput, RoomTypeConfig } from './hostels.schema';

interface RoomTypeConfigDB {
  type: string;
  totalRooms: number;
  availableRooms: number;
  personsInRoom: number;
  price: number;
  fullRoomPriceDiscounted?: number | null;
  urgentBookingPrice?: number | null; // NEW
}

export class HostelsService {
  async createHostel(userId: string, data: CreateHostelInput) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    if (!managerProfile.verified) {
      throw new Error('Manager not verified');
    }

    // Process room types - set availableRooms equal to totalRooms initially
    const roomTypes: RoomTypeConfigDB[] = data.roomTypes.map(rt => ({
      type: rt.type,
      totalRooms: rt.totalRooms,
      availableRooms: rt.totalRooms,
      personsInRoom: rt.personsInRoom,
      price: rt.price,
      fullRoomPriceDiscounted: rt.fullRoomPriceDiscounted || null,
      urgentBookingPrice: rt.urgentBookingPrice || null, // NEW
    }));

    const hostel = await prisma.hostel.create({
      data: {
        managerId: managerProfile.id,
        hostelName: data.hostelName,
        city: data.city,
        address: data.address,
        nearbyLocations: data.nearbyLocations,
        hostelFor: data.hostelFor,
        roomTypes: roomTypes,
        facilities: data.facilities,
        roomImages: data.roomImages || [],
        rules: data.rules,
        seoKeywords: data.seoKeywords,
      },
    });

    return hostel;
  }

  async updateHostel(userId: string, hostelId: string, data: UpdateHostelInput) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    const hostel = await prisma.hostel.findUnique({
      where: { id: hostelId },
    });

    if (!hostel || hostel.managerId !== managerProfile.id) {
      throw new Error('Hostel not found or not authorized');
    }

    // If updating room types, handle availableRooms carefully
    let roomTypesUpdate: RoomTypeConfigDB[] | undefined = undefined;
    
    if (data.roomTypes) {
      const existingRoomTypes = hostel.roomTypes as RoomTypeConfigDB[];
      
      roomTypesUpdate = data.roomTypes.map(newRt => {
        // Find existing room type if it exists
        const existing = existingRoomTypes.find(ert => ert.type === newRt.type);
        
        if (existing) {
          // Calculate the difference in total rooms
          const diff = newRt.totalRooms - existing.totalRooms;
          const newAvailable = Math.max(0, existing.availableRooms + diff);
          
          return {
            type: newRt.type,
            totalRooms: newRt.totalRooms,
            availableRooms: Math.min(newAvailable, newRt.totalRooms),
            personsInRoom: newRt.personsInRoom,
            price: newRt.price,
            fullRoomPriceDiscounted: newRt.fullRoomPriceDiscounted || null,
            urgentBookingPrice: newRt.urgentBookingPrice || null, // NEW
          };
        } else {
          // New room type
          return {
            type: newRt.type,
            totalRooms: newRt.totalRooms,
            availableRooms: newRt.totalRooms,
            personsInRoom: newRt.personsInRoom,
            price: newRt.price,
            fullRoomPriceDiscounted: newRt.fullRoomPriceDiscounted || null,
            urgentBookingPrice: newRt.urgentBookingPrice || null, // NEW
          };
        }
      });
    }

    const updateData: any = { ...data };
    if (roomTypesUpdate) {
      updateData.roomTypes = roomTypesUpdate;
    }
    if (data.facilities) {
      updateData.facilities = data.facilities;
    }

    const updated = await prisma.hostel.update({
      where: { id: hostelId },
      data: updateData,
    });

    return updated;
  }

  async deleteHostel(userId: string, hostelId: string) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    const hostel = await prisma.hostel.findUnique({
      where: { id: hostelId },
    });

    if (!hostel || hostel.managerId !== managerProfile.id) {
      throw new Error('Hostel not found or not authorized');
    }

    await prisma.hostel.delete({
      where: { id: hostelId },
    });

    return { message: 'Hostel deleted' };
  }

  async getMyHostels(userId: string) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    return prisma.hostel.findMany({
      where: { managerId: managerProfile.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchHostels(filters: SearchHostelsInput) {
    const where: any = { isActive: true };

    if (filters.city) {
      where.city = { contains: filters.city, mode: 'insensitive' };
    }

    if (filters.nearbyLocation) {
      where.nearbyLocations = { has: filters.nearbyLocation };
    }

    if (filters.hostelFor) {
      where.hostelFor = filters.hostelFor;
    }

    // Get all hostels first, then filter by room type if needed
    let hostels = await prisma.hostel.findMany({
      where,
      include: {
        manager: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
      orderBy: { averageRating: 'desc' },
    });

    // Filter by room type if specified
    if (filters.roomType) {
      hostels = hostels.filter(hostel => {
        const roomTypes = hostel.roomTypes as RoomTypeConfigDB[];
        return roomTypes.some(rt => rt.type === filters.roomType && rt.availableRooms > 0);
      });
    }

    // Filter by price range if specified
    if (filters.minPrice || filters.maxPrice) {
      hostels = hostels.filter(hostel => {
        const roomTypes = hostel.roomTypes as RoomTypeConfigDB[];
        return roomTypes.some(rt => {
          const price = rt.price;
          if (filters.minPrice && price < filters.minPrice) return false;
          if (filters.maxPrice && price > filters.maxPrice) return false;
          return true;
        });
      });
    }

    return hostels;
  }

  async getHostelById(id: string) {
    const hostel = await prisma.hostel.findUnique({
      where: { id },
      include: {
        manager: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            booking: {
              include: {
                student: {
                  include: {
                    user: {
                      select: { email: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!hostel) {
      throw new Error('Hostel not found');
    }

    // Attach a `user` field to each review so HostelDetail.tsx can show initials/name
    const reviewsWithUser = (hostel.reviews as any[]).map(review => ({
      ...review,
      user: review.booking?.student?.user ?? null,
    }));

    return {
      ...hostel,
      reviews: reviewsWithUser,
    };
  }

  async getHostelStudents(userId: string, hostelId: string) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    const hostel = await prisma.hostel.findUnique({
      where: { id: hostelId },
    });

    if (!hostel || hostel.managerId !== managerProfile.id) {
      throw new Error('Hostel not found or not authorized');
    }

    const activeBookings = await prisma.booking.findMany({
      where: {
        hostelId,
        status: 'APPROVED',
      },
      include: {
        student: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
    });

    return activeBookings.map(b => ({
      bookingId: b.id,
      studentId: b.studentId,
      student: b.student,
      roomType: b.roomType,
      bookingType: b.bookingType,
      urgentLeaveDate: b.urgentLeaveDate,
      joinedAt: b.createdAt,
    }));
  }

  async getAllHostels() {
    return prisma.hostel.findMany({
      include: {
        manager: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Helper method to update room availability
  async updateRoomAvailability(hostelId: string, roomType: string, increment: number) {
    const hostel = await prisma.hostel.findUnique({
      where: { id: hostelId },
    });

    if (!hostel) {
      throw new Error('Hostel not found');
    }

    const roomTypes = hostel.roomTypes as RoomTypeConfigDB[];
    const updatedRoomTypes = roomTypes.map(rt => {
      if (rt.type === roomType) {
        const newAvailable = rt.availableRooms + increment;
        return {
          ...rt,
          availableRooms: Math.max(0, Math.min(newAvailable, rt.totalRooms)),
        };
      }
      return rt;
    });

    await prisma.hostel.update({
      where: { id: hostelId },
      data: { roomTypes: updatedRoomTypes },
    });
  }

  // NEW: Get random reviews for homepage
  async getRandomReviews(limit: number = 4) {
    const totalReviews = await prisma.review.count();

    if (totalReviews === 0) {
      return [];
    }

    const maxSkip = Math.max(0, totalReviews - limit);
    const randomSkip = Math.floor(Math.random() * (maxSkip + 1));

    const reviews = await prisma.review.findMany({
      take: limit,
      skip: randomSkip,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        hostel: {
          select: {
            id: true,
            hostelName: true,
            city: true,
          },
        },
        booking: {
          include: {
            student: {
              include: {
                user: {
                  select: { email: true },
                },
              },
            },
          },
        },
      },
    });

    // Attach a top-level `student` so Home.tsx matches its expected shape
    const reviewsWithStudent = (reviews as any[]).map(review => ({
      ...review,
      student: review.booking?.student ?? null,
    }));

    // Keep the previous randomization behavior
    return reviewsWithStudent.sort(() => Math.random() - 0.5);
  }
}
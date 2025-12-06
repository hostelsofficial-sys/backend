// src/modules/bookings/bookings.service.ts
import { ReservationStatus } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { HostelsService } from '../hostels/hostels.service';
import {
  CreateBookingInput,
  DisapproveBookingInput,
  LeaveHostelInput,
  KickStudentInput,
} from './bookings.schema';

const hostelsService = new HostelsService();

interface RoomTypeConfigDB {
  type: string;
  totalRooms: number;
  availableRooms: number;
  personsInRoom: number;
  price: number;
  fullRoomPriceDiscounted?: number | null;
}

export class BookingsService {
  async createBooking(userId: string, data: CreateBookingInput) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw new Error('Student profile not found');
    }

    if (studentProfile.currentHostelId) {
      throw new Error('Already booked in a hostel');
    }

    const hostel = await prisma.hostel.findUnique({
      where: { id: data.hostelId },
    });

    if (!hostel) {
      throw new Error('Hostel not found');
    }

    if (!hostel.isActive) {
      throw new Error('Hostel is not active');
    }

    // Find the requested room type
    const roomTypes = hostel.roomTypes as RoomTypeConfigDB[];
    const selectedRoomType = roomTypes.find(rt => rt.type === data.roomType);

    if (!selectedRoomType) {
      throw new Error('Room type not available in this hostel');
    }

    if (selectedRoomType.availableRooms <= 0) {
      throw new Error('No rooms available for this room type');
    }

    // Get the price based on room type
    const amount = selectedRoomType.price;

    const booking = await prisma.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          studentId: studentProfile.id,
          hostelId: data.hostelId,
          roomType: data.roomType,
          amount,
          transactionImage: data.transactionImage,
          transactionDate: data.transactionDate,
          transactionTime: data.transactionTime,
          fromAccount: data.fromAccount,
          toAccount: data.toAccount,
        },
      });

      if (data.reservationId) {
        const reservation = await tx.reservation.findUnique({
          where: { id: data.reservationId },
        });

        if (!reservation) {
          throw new Error('Reservation not found');
        }

        if (reservation.studentId !== studentProfile.id) {
          throw new Error('Reservation does not belong to this student');
        }

        if (reservation.status !== 'ACCEPTED') {
          throw new Error('Reservation is not accepted');
        }

        await tx.reservation.update({
          where: { id: data.reservationId },
          data: { status: ReservationStatus.CANCELLED },
        });
      }

      return newBooking;
    });

    return booking;
  }

  async getManagerBookings(userId: string) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    const hostels = await prisma.hostel.findMany({
      where: { managerId: managerProfile.id },
      select: { id: true },
    });

    const hostelIds = hostels.map((h) => h.id);

    return prisma.booking.findMany({
      where: { hostelId: { in: hostelIds } },
      include: {
        student: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        hostel: {
          select: {
            hostelName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMyBookings(userId: string) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw new Error('Student profile not found');
    }

    return prisma.booking.findMany({
      where: { studentId: studentProfile.id },
      include: {
        hostel: {
          select: {
            hostelName: true,
            city: true,
            address: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHostelBookings(userId: string, hostelId: string) {
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

    return prisma.booking.findMany({
      where: { hostelId },
      include: {
        student: {
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

  async approveBooking(userId: string, bookingId: string) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hostel: true },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.hostel.managerId !== managerProfile.id) {
      throw new Error('Not authorized');
    }

    if (booking.status !== 'PENDING') {
      throw new Error('Booking is not pending');
    }

    // Check room availability for the specific room type
    const roomTypes = booking.hostel.roomTypes as RoomTypeConfigDB[];
    const roomType = roomTypes.find(rt => rt.type === booking.roomType);

    if (!roomType || roomType.availableRooms <= 0) {
      throw new Error('No rooms available for this room type');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: { status: 'APPROVED' },
      });

      // Update room availability for the specific room type
      await hostelsService.updateRoomAvailability(booking.hostelId, booking.roomType, -1);

      await tx.studentProfile.update({
        where: { id: booking.studentId },
        data: { currentHostelId: booking.hostelId },
      });

      // Cancel any pending reservations for this student
      await tx.reservation.updateMany({
        where: {
          studentId: booking.studentId,
          status: 'PENDING',
        },
        data: { status: 'CANCELLED' },
      });

      return updatedBooking;
    });

    return result;
  }

  async disapproveBooking(userId: string, bookingId: string, data: DisapproveBookingInput) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hostel: true },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.hostel.managerId !== managerProfile.id) {
      throw new Error('Not authorized');
    }

    if (booking.status !== 'PENDING') {
      throw new Error('Booking is not pending');
    }

    const result = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: 'DISAPPROVED',
        refundImage: data.refundImage,
        refundDate: data.refundDate,
        refundTime: data.refundTime,
      },
    });

    return result;
  }

  async leaveHostel(userId: string, data: LeaveHostelInput) {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!studentProfile) {
      throw new Error('Student profile not found');
    }

    if (!studentProfile.currentHostelId) {
      throw new Error('Not currently in a hostel');
    }

    const activeBooking = await prisma.booking.findFirst({
      where: {
        studentId: studentProfile.id,
        hostelId: studentProfile.currentHostelId,
        status: 'APPROVED',
      },
    });

    if (!activeBooking) {
      throw new Error('No active booking found');
    }

    // 1) Transaction: update booking status + clear student's current hostel
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.update({
        where: { id: activeBooking.id },
        data: {
          status: 'LEFT',
          kickReason: 'LEFT_HOSTEL',
        },
      });

      await tx.studentProfile.update({
        where: { id: studentProfile.id },
        data: { currentHostelId: null },
      });

      return booking;
    });

    // 2) Outside transaction: update room availability
    await hostelsService.updateRoomAvailability(
      studentProfile.currentHostelId!, // old value still in memory
      activeBooking.roomType,
      1
    );

    // 3) Outside transaction: create review
    await prisma.review.create({
      data: {
        bookingId: activeBooking.id,
        hostelId: activeBooking.hostelId,
        rating: data.rating,
        comment: data.review,
      },
    });

    // 4) Outside transaction: recalculate hostel rating & review count
    const agg = await prisma.review.aggregate({
      where: { hostelId: activeBooking.hostelId },
      _avg: { rating: true },
      _count: { id: true },
    });

    await prisma.hostel.update({
      where: { id: activeBooking.hostelId },
      data: {
        averageRating: agg._avg.rating ?? 0,
        reviewCount: agg._count.id,
      },
    });

    return updatedBooking;
  }

  async kickStudent(userId: string, bookingId: string, data: KickStudentInput) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hostel: true, student: true },
    });

    if (!booking) {
      throw new Error('Booking not found');
    }

    if (booking.hostel.managerId !== managerProfile.id) {
      throw new Error('Not authorized');
    }

    if (booking.status !== 'APPROVED') {
      throw new Error('Booking is not active');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: 'LEFT',
          kickReason: data.kickReason,
          kickByManagerId: managerProfile.id,
        },
      });

      // Update room availability for the specific room type
      await hostelsService.updateRoomAvailability(booking.hostelId, booking.roomType, 1);

      await tx.studentProfile.update({
        where: { id: booking.studentId },
        data: { currentHostelId: null },
      });

      await tx.auditLog.create({
        data: {
          action: `STUDENT_KICKED_${data.kickReason}`,
          performedBy: userId,
          targetType: 'Booking',
          targetId: bookingId,
          details: `Student kicked from hostel. Room type: ${booking.roomType}. Reason: ${data.kickReason}`,
        },
      });

      return updatedBooking;
    });

    return result;
  }

  async getAllBookings(status?: string) {
    const where = status ? { status: status as any } : {};

    return prisma.booking.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        hostel: {
          select: {
            hostelName: true,
            manager: {
              include: {
                user: {
                  select: { email: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBookingById(id: string) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        hostel: {
          include: {
            manager: {
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

    if (!booking) {
      throw new Error('Booking not found');
    }

    return booking;
  }
}
import { prisma } from '../../config/prisma';
import { SubmitFeeInput, ReviewFeeInput } from './fees.schema';

const FEE_PER_STUDENT = 100;

export class FeesService {
  async submitMonthlyFee(userId: string, data: SubmitFeeInput) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    const hostel = await prisma.hostel.findUnique({
      where: { id: data.hostelId },
    });

    if (!hostel || hostel.managerId !== managerProfile.id) {
      throw new Error('Hostel not found or not authorized');
    }

    const existingFee = await prisma.monthlyAdminFee.findUnique({
      where: {
        managerId_hostelId_month: {
          managerId: managerProfile.id,
          hostelId: data.hostelId,
          month: data.month,
        },
      },
    });

    if (existingFee) {
      throw new Error('Fee already submitted for this month');
    }

    // Get the start and end dates for the month
    const [year, month] = data.month.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // NEW: Count ONLY REGULAR bookings that were approved during the month
    // and don't count URGENT bookings or bookings that left
    const regularBookings = await prisma.booking.findMany({
      where: {
        hostelId: data.hostelId,
        bookingType: 'REGULAR', // Only regular bookings
        status: 'APPROVED', // Only approved bookings
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
        // Don't count if they left during the same month (but already paid)
        // We count them anyway because manager collected the fee
      },
    });

    const studentCount = regularBookings.length;
    const feeAmount = studentCount * FEE_PER_STUDENT;

    // Calculate total revenue from REGULAR bookings only (excluding URGENT)
    const totalRevenue = await prisma.booking.aggregate({
      where: {
        hostelId: data.hostelId,
        bookingType: 'REGULAR', // Only regular bookings
        status: { in: ['APPROVED', 'LEFT', 'COMPLETED'] },
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const fee = await prisma.monthlyAdminFee.create({
      data: {
        managerId: managerProfile.id,
        hostelId: data.hostelId,
        month: data.month,
        studentCount,
        totalRevenue: totalRevenue._sum.amount || 0,
        feeAmount,
        paymentProofImage: data.paymentProofImage,
        submittedAt: new Date(),
      },
    });

    return fee;
  }

  async getMyFees(userId: string) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    return prisma.monthlyAdminFee.findMany({
      where: { managerId: managerProfile.id },
      include: {
        hostel: {
          select: { hostelName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllFees(status?: string) {
    const where = status ? { status: status as any } : {};

    return prisma.monthlyAdminFee.findMany({
      where,
      include: {
        manager: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
        hostel: {
          select: { hostelName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async reviewFee(feeId: string, reviewerId: string, data: ReviewFeeInput) {
    const fee = await prisma.monthlyAdminFee.findUnique({
      where: { id: feeId },  // FIXED: Changed 'feeId' to 'id: feeId'
    });

    if (!fee) {
      throw new Error('Fee record not found');
    }

    if (fee.status !== 'PENDING') {
      throw new Error('Fee already reviewed');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedFee = await tx.monthlyAdminFee.update({
        where: { id: feeId },  // FIXED: Ensure this uses 'id' not 'feeId'
        data: {
          status: data.status,
          reviewedBy: reviewerId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: `MONTHLY_FEE_${data.status}`,
          performedBy: reviewerId,
          targetType: 'MonthlyAdminFee',
          targetId: feeId,
        },
      });

      return updatedFee;
    });

    return result;
  }

  async getPendingFeeSummary(userId: string) {
    const managerProfile = await prisma.managerProfile.findUnique({
      where: { userId },
      include: { hostels: true },
    });

    if (!managerProfile) {
      throw new Error('Manager profile not found');
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const [year, month] = currentMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const summary = await Promise.all(
      managerProfile.hostels.map(async (hostel) => {
        const existingFee = await prisma.monthlyAdminFee.findUnique({
          where: {
            managerId_hostelId_month: {
              managerId: managerProfile.id,
              hostelId: hostel.id,
              month: currentMonth,
            },
          },
        });

        // NEW: Count ONLY REGULAR bookings that were approved during the month
        const regularStudents = await prisma.booking.count({
          where: {
            hostelId: hostel.id,
            bookingType: 'REGULAR', // Only regular bookings
            status: 'APPROVED',
            createdAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        });

        return {
          hostelId: hostel.id,
          hostelName: hostel.hostelName,
          month: currentMonth,
          activeStudents: regularStudents,
          feeAmount: regularStudents * FEE_PER_STUDENT,
          submitted: !!existingFee,
          status: existingFee?.status || null,
          // Add note about urgent bookings
          note: 'Urgent bookings are not included in admin fee calculation',
        };
      })
    );

    return summary;
  }
}
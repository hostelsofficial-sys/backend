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

    // Get the start and end dates for the month
    const [year, month] = data.month.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Count REGULAR bookings created in this month whose lifecycle
    // includes APPROVED (i.e. current status is APPROVED, LEFT, or COMPLETED)
    // so that students who later leave or complete are still charged.
    const regularBookings = await prisma.booking.findMany({
      where: {
        hostelId: data.hostelId,
        bookingType: 'REGULAR',
        status: {
          in: ['APPROVED', 'LEFT', 'COMPLETED'],
        },
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    const studentCount = regularBookings.length;
    const feeAmount = studentCount * FEE_PER_STUDENT;

    // Calculate total revenue from REGULAR bookings only (excluding URGENT)
    const totalRevenue = await prisma.booking.aggregate({
      where: {
        hostelId: data.hostelId,
        bookingType: 'REGULAR',
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

    // If fee already exists, handle different scenarios
    if (existingFee) {
      // If status is PENDING, don't allow resubmission until reviewed
      if (existingFee.status === 'PENDING') {
        throw new Error('Fee already submitted for this month and pending review');
      }

      // If status is APPROVED but student count is same, no need to resubmit
      if (existingFee.status === 'APPROVED' && existingFee.studentCount === studentCount) {
        throw new Error('Fee already approved for this month with same student count');
      }

      // If REJECTED or APPROVED with new students, allow update/resubmission
      const updatedFee = await prisma.monthlyAdminFee.update({
        where: { id: existingFee.id },
        data: {
          studentCount,
          totalRevenue: totalRevenue._sum.amount || 0,
          feeAmount,
          paymentProofImage: data.paymentProofImage,
          submittedAt: new Date(),
          status: 'PENDING',
          reviewedBy: null, // Clear previous reviewer since it's being resubmitted
        },
      });

      return updatedFee;
    }

    // Create new fee record
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

  /**
   * Call this method when a new REGULAR student booking is approved
   * to check if fee needs to be reset for additional payment.
   * This should be called from the BookingService when approving a booking.
   *
   * @param hostelId - The hostel ID where the booking was approved
   * @param bookingCreatedAt - The creation date of the approved booking
   * @returns Updated fee record if reset, null otherwise
   */
  async checkAndResetFeeForNewStudent(hostelId: string, bookingCreatedAt: Date) {
    const bookingMonth = bookingCreatedAt.toISOString().slice(0, 7);
    const [year, month] = bookingMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Find existing approved fee for this hostel and month
    const existingFee = await prisma.monthlyAdminFee.findFirst({
      where: {
        hostelId,
        month: bookingMonth,
        status: 'APPROVED',
      },
    });

    if (!existingFee) {
      return null; // No approved fee to reset
    }

    // Count current REGULAR bookings for this month
    const currentStudentCount = await prisma.booking.count({
      where: {
        hostelId,
        bookingType: 'REGULAR',
        status: {
          in: ['APPROVED', 'LEFT', 'COMPLETED'],
        },
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    });

    // If student count has increased since fee was approved, reset the fee status
    if (currentStudentCount > existingFee.studentCount) {
      const updatedFee = await prisma.monthlyAdminFee.update({
        where: { id: existingFee.id },
        data: {
          status: 'PENDING', // Reset to pending for additional payment
          reviewedBy: null, // Clear reviewer
        },
      });

      // Log the reset action
      await prisma.auditLog.create({
        data: {
          action: 'MONTHLY_FEE_RESET_NEW_STUDENT',
          performedBy: 'SYSTEM',
          targetType: 'MonthlyAdminFee',
          targetId: existingFee.id,
          details: JSON.stringify({
            previousStudentCount: existingFee.studentCount,
            newStudentCount: currentStudentCount,
            hostelId,
            month: bookingMonth,
          }),
        },
      });

      return updatedFee;
    }

    return null;
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
      where: { id: feeId },
    });

    if (!fee) {
      throw new Error('Fee record not found');
    }

    if (fee.status !== 'PENDING') {
      throw new Error('Fee already reviewed');
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedFee = await tx.monthlyAdminFee.update({
        where: { id: feeId },
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

        // Count REGULAR bookings created in this month
        const regularStudents = await prisma.booking.count({
          where: {
            hostelId: hostel.id,
            bookingType: 'REGULAR',
            status: {
              in: ['APPROVED', 'LEFT', 'COMPLETED'],
            },
            createdAt: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        });

        // Calculate fee details based on current state
        const paidStudentCount = existingFee?.status === 'APPROVED' ? existingFee.studentCount : 0;
        const additionalStudents = Math.max(0, regularStudents - paidStudentCount);
        const needsAdditionalPayment = existingFee?.status === 'APPROVED' && additionalStudents > 0;

        // Determine the effective status to show
        let displayStatus = existingFee?.status || null;
        if (needsAdditionalPayment) {
          displayStatus = 'PENDING'; // Override to show pending if new students joined
        }

        return {
          hostelId: hostel.id,
          hostelName: hostel.hostelName,
          month: currentMonth,
          activeStudents: regularStudents,
          paidStudentCount,
          additionalStudents: needsAdditionalPayment ? additionalStudents : 0,
          feeAmount: regularStudents * FEE_PER_STUDENT,
          additionalFeeAmount: needsAdditionalPayment ? additionalStudents * FEE_PER_STUDENT : 0,
          submitted: !!existingFee && !needsAdditionalPayment,
          status: displayStatus,
          needsAdditionalPayment,
          note: needsAdditionalPayment
            ? `${additionalStudents} new student(s) joined after fee was approved. Please submit updated payment.`
            : 'Urgent bookings are not included in admin fee calculation',
        };
      })
    );

    return summary;
  }
}
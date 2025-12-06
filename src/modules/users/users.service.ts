import { prisma } from '../../config/prisma';
import { SelfVerifyInput, UpdateProfileInput } from './users.schema';

export class UsersService {
  async selfVerifyStudent(userId: string, data: SelfVerifyInput) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!profile) throw new Error('Student profile not found');
    if (profile.selfVerified) throw new Error('Already verified');

    const updated = await prisma.studentProfile.update({
      where: { userId },
      data: {
        ...data,
        selfVerified: true,
      },
    });

    return { verified: true, profile: updated };
  }

  async getStudentProfile(userId: string) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { email: true, role: true, isTerminated: true },
        },
      },
    });

    if (!profile) throw new Error('Profile not found');
    return profile;
  }

  async updateManagerProfile(userId: string, data: UpdateProfileInput) {
    return prisma.managerProfile.update({
      where: { userId },
      data,
    });
  }

  async getManagerProfile(userId: string) {
    const profile = await prisma.managerProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: { email: true, role: true, isTerminated: true },
        },
        hostels: true,
      },
    });

    if (!profile) throw new Error('Profile not found');
    return profile;
  }

  async getAllUsers(role?: string) {
    const where = role ? { role: role as any } : {};

    return prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        role: true,
        isTerminated: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async terminateUser(userId: string, adminId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.role === 'ADMIN') throw new Error('Cannot terminate admin');

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isTerminated: true },
      });

      await tx.auditLog.create({
        data: {
          action: 'TERMINATE_USER',
          performedBy: adminId,
          targetType: 'User',
          targetId: userId,
        },
      });
    });

    return { message: 'User terminated' };
  }

  // ============================================================
  //    FULL HARD DELETE ACCOUNT (Student or Manager)
  // ============================================================
  async deleteMyAccount(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) throw new Error('User not found');
    if (user.role === 'ADMIN') throw new Error('Admins cannot delete themselves');

    await prisma.$transaction(async (tx) => {
      // ---------------------------
      // Delete audit logs
      // ---------------------------
      await tx.auditLog.deleteMany({
        where: {
          OR: [
            { performedBy: userId },
            { targetId: userId },
          ],
        },
      });

      // ---------------------------
      // Delete messages + conversations
      // ---------------------------
      await tx.message.deleteMany({ where: { senderId: userId } });
      await tx.conversation.deleteMany({
        where: {
          OR: [
            { studentId: userId },
            { managerId: userId },
          ],
        },
      });

      // ======================================================
      // STUDENT FULL DELETE
      // ======================================================
      if (user.role === 'STUDENT') {
        const studentProfile = await tx.studentProfile.findUnique({
          where: { userId },
        });

        if (studentProfile) {
          const studentId = studentProfile.id;

          // Find all bookings
          const bookings = await tx.booking.findMany({
            where: { studentId },
          });

          const approved = bookings.filter((b) => b.status === 'APPROVED');
          const bookingIds = bookings.map((b) => b.id);

          // Restore room availability BEFORE deleting hostels
          for (const b of approved) {
            const hostel = await tx.hostel.findUnique({
              where: { id: b.hostelId },
            });

            if (hostel) {
              const updatedRoomTypes = hostel.roomTypes.map((rt: any) =>
                rt.type === b.roomType
                  ? { ...rt, availableRooms: rt.availableRooms + 1 }
                  : rt
              );

              await tx.hostel.update({
                where: { id: hostel.id },
                data: { roomTypes: updatedRoomTypes },
              });
            }
          }

          // Delete reviews
          if (bookingIds.length > 0) {
            await tx.review.deleteMany({
              where: { bookingId: { in: bookingIds } },
            });
          }

          // Delete reports
          await tx.report.deleteMany({
            where: { studentId },
          });

          // Delete reservations
          await tx.reservation.deleteMany({
            where: { studentId },
          });

          // Delete bookings
          await tx.booking.deleteMany({
            where: { studentId },
          });

          // Delete student profile
          await tx.studentProfile.delete({
            where: { id: studentId },
          });
        }
      }

      // ======================================================
      // MANAGER FULL DELETE
      // ======================================================
      if (user.role === 'MANAGER') {
        const managerProfile = await tx.managerProfile.findUnique({
          where: { userId },
          include: { hostels: true },
        });

        if (managerProfile) {
          const managerId = managerProfile.id;
          const hostelIds = managerProfile.hostels.map((h) => h.id);

          // All bookings for these hostels
          const hostelBookings = await tx.booking.findMany({
            where: { hostelId: { in: hostelIds } },
          });

          const bookingIds = hostelBookings.map((b) => b.id);

          // Delete reviews of hostels
          await tx.review.deleteMany({
            where: { hostelId: { in: hostelIds } },
          });

          // Delete reports related to manager / hostels
          await tx.report.deleteMany({
            where: {
              OR: [
                { managerId },
                { bookingId: { in: bookingIds } },
              ],
            },
          });

          // Delete bookings
          await tx.booking.deleteMany({
            where: { hostelId: { in: hostelIds } },
          });

          // Delete reservations
          await tx.reservation.deleteMany({
            where: { hostelId: { in: hostelIds } },
          });

          // Delete admin fees
          await tx.monthlyAdminFee.deleteMany({
            where: { hostelId: { in: hostelIds } },
          });

          // Delete hostels
          await tx.hostel.deleteMany({
            where: { id: { in: hostelIds } },
          });

          // Delete manager profile
          await tx.managerProfile.delete({
            where: { id: managerId },
          });
        }
      }

      // ======================================================
      // Finally delete USER entirely
      // ======================================================
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return { message: 'Account and all related data permanently deleted' };
  }
}

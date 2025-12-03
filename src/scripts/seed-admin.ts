import { prisma } from '../config/prisma';
import { hashPassword } from '../utils/password';

async function seedAdmin() {
  const adminEmail = 'workwithhussnainahmad@gmail.com';
  const adminPassword = 'AbdulHadi343.';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log('Admin already exists');
    return;
  }

  const passwordHash = await hashPassword(adminPassword);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
    },
  });

  console.log('Admin created:', admin.email);
}

seedAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
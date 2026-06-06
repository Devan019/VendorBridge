const { PrismaClient } = require('./src/generated/prisma');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ where: { role: 'VENDOR' } });
  console.log('--- VENDOR USERS ---');
  users.forEach(u => console.log(`User: ${u.email}`));

  const vendors = await prisma.vendor.findMany();
  console.log('\n--- VENDORS ---');
  vendors.forEach(v => console.log(`Vendor: ${v.contact_email} (ID: ${v.id})`));

  const quotations = await prisma.quotation.findMany({
    include: { vendor: true }
  });
  console.log('\n--- QUOTATIONS ---');
  quotations.forEach(q => console.log(`Quotation ${q.id} for Vendor ${q.vendor?.contact_email}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());

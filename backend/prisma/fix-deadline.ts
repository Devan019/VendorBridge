import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/utils/prisma';

async function main() {
  const result = await prisma.rFQ.updateMany({
    data: { deadline: new Date('2027-12-31T23:59:59.000Z') }
  });
  console.log(`✅ Updated ${result.count} RFQ deadline(s) to 2027-12-31`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

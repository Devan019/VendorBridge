import * as dotenv from 'dotenv';
dotenv.config();

import prisma from '../src/utils/prisma';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  console.log("Starting seed...");

  // Clear existing data (optional, but good for a fresh start if requested)
  // Be careful with deleteMany in production, but this is clearly a testing env
  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.pO_Item.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.quotation_Item.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.rFQ_Vendor.deleteMany();
  await prisma.rFQ_Item.deleteMany();
  await prisma.rFQ.deleteMany();
  await prisma.vendorNote.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // 1. Create Users
  // Use scrypt to match auth/service.ts
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync('password123', salt, 64).toString("hex");
  const passwordHash = `scrypt$${salt}$${derived}`;

  
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@vendorbridge.com',
      password_hash: passwordHash,
      first_name: 'Rahul',
      last_name: 'Mehta',
      name: 'Rahul Mehta',
      role: 'ADMIN',
      phone: '9876543210',
    }
  });

  const reviewerUser = await prisma.user.create({
    data: {
      email: 'priya@vendorbridge.com',
      password_hash: passwordHash,
      first_name: 'Priya',
      last_name: 'Shah',
      name: 'Priya Shah',
      role: 'REVIEWER',
    }
  });

  // 2. Create Vendors
  const vendor1 = await prisma.vendor.create({
    data: {
      name: 'Infra Supplies',
      category: 'Furniture',
      gst_number: '22AAAAA0000A1Z5',
      contact_email: 'sales@infrasupplies.com',
      status: 'ACTIVE',
      updated_at: new Date()
    }
  });

  const vendor2 = await prisma.vendor.create({
    data: {
      name: 'TechCore LTD',
      category: 'IT',
      gst_number: '22BBBBB1111B2Z6',
      contact_email: 'sales@techcore.com',
      status: 'ACTIVE',
      updated_at: new Date()
    }
  });

  const vendor3 = await prisma.vendor.create({
    data: {
      name: 'Office Need Co.',
      category: 'Stationery',
      gst_number: '22CCCCC2222C3Z7',
      contact_email: 'sales@officeneed.com',
      status: 'ACTIVE',
      updated_at: new Date()
    }
  });

  // 3. Create RFQ
  const rfq = await prisma.rFQ.create({
    data: {
      reference_number: 'RFQ-2025-001',
      title: 'office furniture procurement q2',
      description: 'Need ergonomic chairs and standing desks.',
      deadline: new Date('2025-06-15'),
      status: 'SENT',
      created_by: adminUser.id,
      items: {
        create: [
          {
            product_name: 'Ergonomic chair',
            description: 'Mesh back, adjustable armrests',
            quantity: 25,
            unit: 'pcs'
          },
          {
            product_name: 'Standing desk',
            description: 'Motorized height adjustable',
            quantity: 10,
            unit: 'pcs'
          }
        ]
      },
      vendors: {
        create: [
          { vendor_id: vendor1.id },
          { vendor_id: vendor2.id },
          { vendor_id: vendor3.id }
        ]
      }
    },
    include: { items: true }
  });

  const rfqItemChair = rfq.items.find((i: any) => i.product_name === 'Ergonomic chair')!;
  const rfqItemDesk = rfq.items.find((i: any) => i.product_name === 'Standing desk')!;

  // 4. Create Quotations
  const q1 = await prisma.quotation.create({
    data: {
      rfq_id: rfq.id,
      vendor_id: vendor1.id,
      status: 'SUBMITTED',
      items: {
        create: [
          { rfq_item_id: rfqItemChair.id, unit_price: 3500, delivery_days: 7 },
          { rfq_item_id: rfqItemDesk.id, unit_price: 8200, delivery_days: 14 }
        ]
      }
    }
  });

  const q2 = await prisma.quotation.create({
    data: {
      rfq_id: rfq.id,
      vendor_id: vendor2.id,
      status: 'SUBMITTED',
      items: {
        create: [
          { rfq_item_id: rfqItemChair.id, unit_price: 3800, delivery_days: 5 },
          { rfq_item_id: rfqItemDesk.id, unit_price: 8500, delivery_days: 10 }
        ]
      }
    }
  });

  // Create an approval workflow for q1 to simulate L2 Review
  await prisma.approval.create({
    data: {
      quotation_id: q1.id,
      approver_id: reviewerUser.id,
      status: 'PENDING',
      level: 2
    }
  });

  // Create a Purchase Order
  const po = await prisma.purchaseOrder.create({
    data: {
      po_number: 'PO-202506-001',
      rfq_id: rfq.id,
      quotation_id: q2.id,
      vendor_id: vendor2.id,
      created_by: adminUser.id,
      status: 'ISSUED',
      gst_rate: 18,
      subtotal: 180000,
      tax_amount: 32400,
      grand_total: 212400,
      issued_at: new Date(),
      items: {
        create: [
          {
            product_name: 'Ergonomic chair',
            quantity: 25,
            unit: 'pcs',
            unit_price: 3800,
            gst_rate: 18,
            tax_amount: 17100,
            total: 112100
          }
        ]
      }
    }
  });

  // Create an Invoice
  await prisma.invoice.create({
    data: {
      invoice_number: 'INV-202506-001',
      po_id: po.id,
      status: 'DRAFT',
      invoice_date: new Date(),
      subtotal: 180000,
      tax_amount: 32400,
      grand_total: 212400
    }
  });

  // Create Activity Logs
  await prisma.activityLog.create({
    data: {
      entity_type: 'RFQ',
      entity_id: rfq.id,
      action: 'CREATED',
      performed_by: adminUser.id
    }
  });

  console.log("Seeding complete! You can login with:");
  console.log("Email: admin@vendorbridge.com");
  console.log("Password: password123");
}

main()
  .catch((e: any) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

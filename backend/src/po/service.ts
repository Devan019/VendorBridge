import PDFDocument from "pdfkit";
import prisma from "../utils/prisma";
import { sendMail } from "../utils/SendMail";
import { POStatus, InvoiceStatus } from "../generated/prisma/enums";
import { logActivity } from "../utils/activityLog";

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePONumber(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PO-${yyyy}${mm}${dd}-${randomStr}`;
}

function generateInvoiceNumber(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${yyyy}${mm}${dd}-${randomStr}`;
}

// ── PO Service ────────────────────────────────────────────────────────────────

export const generatePO = async (
  quotation_id: string,
  created_by: string,
  gst_rate: number = 18,
  notes?: string | null,
  terms?: string | null
) => {
  const quotation = await prisma.quotation.findUnique({
    where: { id: quotation_id },
    include: {
      items: {
        include: { rfq_item: true },
      },
    },
  });

  if (!quotation) {
    throw new Error("Quotation not found");
  }

  let subtotal = 0;
  const poItemsData = quotation.items.map((qItem) => {
    const itemSubtotal = Number(qItem.unit_price) * qItem.rfq_item.quantity;
    subtotal += itemSubtotal;
    const tax_amount = itemSubtotal * (gst_rate / 100);
    const total = itemSubtotal + tax_amount;

    return {
      product_name: qItem.rfq_item.product_name,
      description: qItem.rfq_item.description,
      quantity: qItem.rfq_item.quantity,
      unit: qItem.rfq_item.unit,
      unit_price: qItem.unit_price,
      gst_rate: gst_rate,
      tax_amount: tax_amount,
      total: total,
    };
  });

  const po_tax_amount = subtotal * (gst_rate / 100);
  const grand_total = subtotal + po_tax_amount;

  const po = await prisma.purchaseOrder.create({
    data: {
      po_number: generatePONumber(),
      rfq_id: quotation.rfq_id,
      quotation_id: quotation.id,
      vendor_id: quotation.vendor_id,
      created_by,
      gst_rate,
      subtotal,
      tax_amount: po_tax_amount,
      grand_total,
      notes,
      terms,
      status: POStatus.ISSUED, // Automatically set to issued if auto-generated on approval
      issued_at: new Date(),
      items: {
        create: poItemsData,
      },
    },
    include: { items: true },
  });

  await logActivity("PurchaseOrder", po.id, "CREATED", created_by);

  return po;
};

export const getPOById = async (po_id: string) => {
  return prisma.purchaseOrder.findUnique({
    where: { id: po_id },
    include: {
      items: true,
      quotation: true,
      rfq: true,
      invoices: true,
    },
  });
};

export const updatePOStatus = async (po_id: string, status: POStatus, updated_by?: string) => {
  const updated = await prisma.purchaseOrder.update({
    where: { id: po_id },
    data: {
      status,
      issued_at: status === POStatus.ISSUED ? new Date() : undefined,
    },
  });

  await logActivity("PurchaseOrder", po_id, `STATUS_CHANGED:${status}`, updated_by || "SYSTEM");
  
  return updated;
};

// ── Invoice Service ───────────────────────────────────────────────────────────

export const createInvoice = async (po_id: string, due_date?: Date | null, notes?: string | null) => {
  const po = await prisma.purchaseOrder.findUnique({ where: { id: po_id } });
  if (!po) {
    throw new Error("Purchase Order not found");
  }

  // default due date: +30 days
  const finalDueDate = due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const invoice = await prisma.invoice.create({
    data: {
      invoice_number: generateInvoiceNumber(),
      po_id: po.id,
      due_date: finalDueDate,
      subtotal: po.subtotal,
      tax_amount: po.tax_amount,
      grand_total: po.grand_total,
      notes,
    },
  });

  await logActivity("Invoice", invoice.id, "CREATED", "SYSTEM");

  return invoice;
};

export const getInvoiceById = async (invoice_id: string) => {
  return prisma.invoice.findUnique({
    where: { id: invoice_id },
    include: {
      po: {
        include: {
          items: true,
          quotation: { include: { vendor: true } },
        },
      },
    },
  });
};

export const updateInvoiceStatus = async (invoice_id: string, status: InvoiceStatus, updated_by?: string) => {
  const updated = await prisma.invoice.update({
    where: { id: invoice_id },
    data: {
      status,
      paid_at: status === InvoiceStatus.PAID ? new Date() : undefined,
    },
  });

  await logActivity("Invoice", invoice_id, `STATUS_CHANGED:${status}`, updated_by || "SYSTEM");

  return updated;
};

export const generateInvoicePDF = async (invoice_id: string): Promise<Buffer> => {
  const invoice = await getInvoiceById(invoice_id);
  if (!invoice) throw new Error("Invoice not found");

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Title
      doc.fontSize(20).text("INVOICE", { align: "right" });
      doc.moveDown();

      // Invoice Details
      doc.fontSize(10)
        .text(`Invoice Number: ${invoice.invoice_number}`)
        .text(`Date: ${invoice.invoice_date.toISOString().split("T")[0]}`)
        .text(`Due Date: ${invoice.due_date ? invoice.due_date.toISOString().split("T")[0] : "N/A"}`)
        .text(`PO Number: ${invoice.po.po_number}`);

      doc.moveDown();

      // Vendor Info
      const vendor = invoice.po.quotation.vendor;
      doc.fontSize(12).text("Billed To:");
      doc.fontSize(10)
        .text(vendor.name)
        .text(vendor.contact_email)
        .text(vendor.address || "N/A")
        .text(`GST: ${vendor.gst_number}`);

      doc.moveDown(2);

      // Table Header
      const tableTop = doc.y;
      doc.font("Helvetica-Bold");
      doc.text("Item", 50, tableTop);
      doc.text("Quantity", 250, tableTop, { width: 90, align: "right" });
      doc.text("Unit Price", 340, tableTop, { width: 90, align: "right" });
      doc.text("Total", 430, tableTop, { width: 90, align: "right" });

      doc.moveTo(50, tableTop + 15).lineTo(520, tableTop + 15).stroke();
      doc.font("Helvetica");

      // Table Rows
      let y = tableTop + 25;
      for (const item of invoice.po.items) {
        doc.text(item.product_name, 50, y);
        doc.text(`${item.quantity} ${item.unit}`, 250, y, { width: 90, align: "right" });
        doc.text(`$${Number(item.unit_price).toFixed(2)}`, 340, y, { width: 90, align: "right" });
        doc.text(`$${Number(item.total).toFixed(2)}`, 430, y, { width: 90, align: "right" });
        y += 20;
      }

      doc.moveTo(50, y).lineTo(520, y).stroke();
      y += 15;

      // Totals
      doc.font("Helvetica-Bold");
      doc.text("Subtotal:", 340, y, { width: 90, align: "right" });
      doc.text(`$${Number(invoice.subtotal).toFixed(2)}`, 430, y, { width: 90, align: "right" });
      y += 20;
      doc.text("Tax Amount:", 340, y, { width: 90, align: "right" });
      doc.text(`$${Number(invoice.tax_amount).toFixed(2)}`, 430, y, { width: 90, align: "right" });
      y += 20;
      doc.fontSize(12).text("Grand Total:", 340, y, { width: 90, align: "right" });
      doc.text(`$${Number(invoice.grand_total).toFixed(2)}`, 430, y, { width: 90, align: "right" });

      if (invoice.notes) {
        doc.moveDown(2);
        doc.fontSize(10).font("Helvetica").text("Notes:");
        doc.text(invoice.notes);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

export const sendInvoiceEmail = async (invoice_id: string, options?: { to?: string; subject?: string; message?: string }) => {
  const invoice = await getInvoiceById(invoice_id);
  if (!invoice) throw new Error("Invoice not found");

  const pdfBuffer = await generateInvoicePDF(invoice_id);

  const vendorEmail = options?.to || invoice.po.quotation.vendor.contact_email;
  const subject = options?.subject || `Invoice ${invoice.invoice_number} from VendorBridge`;
  const html = options?.message || `<p>Dear ${invoice.po.quotation.vendor.name},</p><p>Please find attached your invoice ${invoice.invoice_number} for PO ${invoice.po.po_number}.</p>`;

  await sendMail({
    from: process.env.SMTP_USER || "vendorbridge@example.com",
    to: vendorEmail,
    subject,
    html,
    attachments: [
      {
        filename: `${invoice.invoice_number}.pdf`,
        content: pdfBuffer,
      },
    ],
  });

  await prisma.invoice.update({
    where: { id: invoice_id },
    data: {
      email_sent_at: new Date(),
      status: InvoiceStatus.SENT,
    },
  });

  await logActivity("Invoice", invoice_id, "EMAIL_SENT", "SYSTEM");

  return { success: true, message: "Invoice sent successfully" };
};

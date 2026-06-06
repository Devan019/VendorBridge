import { Request, Response } from "express";
import expressAsyncHandler from "../utils/expressAsync";
import { formatResponse } from "../utils/formateResponse";
import {
  generatePO,
  getPOById,
  updatePOStatus,
  createInvoice,
  getInvoiceById,
  updateInvoiceStatus,
  generateInvoicePDF,
  sendInvoiceEmail,
} from "./service";
import {
  createPOSchema,
  updatePOStatusSchema,
  createInvoiceSchema,
  updateInvoiceStatusSchema,
  sendInvoiceEmailSchema,
  listPOQuerySchema,
} from "./zod";
import prisma from "../utils/prisma";
import { POStatus } from "../generated/prisma/enums";

// ── PO Controllers ────────────────────────────────────────────────────────────

export const listPOs = expressAsyncHandler(async (req: Request, res: Response) => {
  const parsed = listPOQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return formatResponse(
      res,
      400,
      "Invalid query parameters",
      false,
      null,
      parsed.error.issues.map((e) => e.message).join(", ")
    );
  }

  const { quotation_id, vendor_id, rfq_id, status, page, limit } = parsed.data;
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const where: any = {};
  if (quotation_id) where.quotation_id = quotation_id;
  if (vendor_id) where.vendor_id = vendor_id;
  if (rfq_id) where.rfq_id = rfq_id;
  if (status) where.status = status;

  const [pos, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        quotation: { select: { vendor: { select: { id: true, name: true } } } },
        invoices: { select: { id: true, invoice_number: true, status: true } },
      },
      orderBy: { created_at: "desc" },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  return formatResponse(res, 200, "Purchase Orders fetched successfully", true, {
    data: pos,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

export const getPO = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const po = await getPOById(id);
  if (!po) {
    return formatResponse(res, 404, "Purchase Order not found", false, null);
  }
  return formatResponse(res, 200, "Purchase Order fetched successfully", true, po);
});

export const manualCreatePO = expressAsyncHandler(async (req: Request, res: Response) => {
  const parsed = createPOSchema.safeParse(req.body);
  if (!parsed.success) {
    return formatResponse(
      res,
      400,
      "Validation failed",
      false,
      null,
      parsed.error.issues.map((e) => e.message).join(", ")
    );
  }

  const { quotation_id, created_by, gst_rate, notes, terms } = parsed.data;

  try {
    const po = await generatePO(quotation_id, created_by, gst_rate, notes, terms);
    return formatResponse(res, 201, "Purchase Order created successfully", true, po);
  } catch (error: any) {
    return formatResponse(res, 400, error.message, false, null);
  }
});

export const updatePO = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updatePOStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return formatResponse(
      res,
      400,
      "Validation failed",
      false,
      null,
      parsed.error.issues.map((e) => e.message).join(", ")
    );
  }

  const po = await updatePOStatus(id, parsed.data.status as POStatus, req.user?.id);
  return formatResponse(res, 200, "Purchase Order updated successfully", true, po);
});

// ── Invoice Controllers ───────────────────────────────────────────────────────

export const listInvoices = expressAsyncHandler(async (req: Request, res: Response) => {
  const invoices = await prisma.invoice.findMany({
    include: {
      po: {
        select: {
          po_number: true,
          quotation: { select: { vendor: { select: { id: true, name: true } } } },
        },
      },
    },
    orderBy: { created_at: "desc" },
  });
  return formatResponse(res, 200, "Invoices fetched successfully", true, invoices);
});

export const getInvoice = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const invoice = await getInvoiceById(id);
  if (!invoice) {
    return formatResponse(res, 404, "Invoice not found", false, null);
  }
  return formatResponse(res, 200, "Invoice fetched successfully", true, invoice);
});

export const generateInvoiceForPO = expressAsyncHandler(async (req: Request, res: Response) => {
  // Can get po_id from params or body. We'll use body based on the schema `createInvoiceSchema`
  // Actually, wait, the router might pass po_id in params depending on `po/route.ts`.
  // Let's rely on the body as defined in Zod schema.
  
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return formatResponse(
      res,
      400,
      "Validation failed",
      false,
      null,
      parsed.error.issues.map((e) => e.message).join(", ")
    );
  }

  const { po_id, due_date, notes } = parsed.data;

  try {
    const parsedDate = due_date ? new Date(due_date) : undefined;
    const invoice = await createInvoice(po_id, parsedDate, notes);
    return formatResponse(res, 201, "Invoice generated successfully", true, invoice);
  } catch (error: any) {
    return formatResponse(res, 400, error.message, false, null);
  }
});

export const updateInvoice = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = updateInvoiceStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return formatResponse(
      res,
      400,
      "Validation failed",
      false,
      null,
      parsed.error.issues.map((e) => e.message).join(", ")
    );
  }

  const invoice = await updateInvoiceStatus(id, parsed.data.status as any, req.user?.id);
  return formatResponse(res, 200, "Invoice updated successfully", true, invoice);
});

export const downloadInvoicePDF = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const pdfBuffer = await generateInvoicePDF(id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=invoice-${id}.pdf`);
    res.send(pdfBuffer);
  } catch (error: any) {
    return formatResponse(res, 400, error.message, false, null);
  }
});

export const emailInvoice = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parsed = sendInvoiceEmailSchema.safeParse(req.body);
  
  let options = undefined;
  if (parsed.success) {
    options = parsed.data;
  }

  try {
    const result = await sendInvoiceEmail(id, options);
    return formatResponse(res, 200, result.message, true, result);
  } catch (error: any) {
    return formatResponse(res, 400, error.message, false, null);
  }
});

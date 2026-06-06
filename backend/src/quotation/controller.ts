import { Request, Response } from 'express';
import { ApprovalStatus, QuotationStatus } from '../generated/prisma/enums';
import prisma from '../utils/prisma';
import expressAsyncHandler from '../utils/expressAsync';
import { formatResponse } from '../utils/formateResponse';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function qs(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return fallback;
}

function parseStatus(raw: string | undefined): QuotationStatus | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase().replace(' ', '_');
  const valid: Record<string, QuotationStatus> = {
    SUBMITTED: QuotationStatus.SUBMITTED,
    UNDER_REVIEW: QuotationStatus.UNDER_REVIEW,
    ACCEPTED: QuotationStatus.ACCEPTED,
    REJECTED: QuotationStatus.REJECTED,
  };
  return valid[upper];
}

/** Reviewer-side transitions only (internal team moves status forward) */
const REVIEWER_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  SUBMITTED: [QuotationStatus.UNDER_REVIEW, QuotationStatus.REJECTED],
  UNDER_REVIEW: [QuotationStatus.ACCEPTED, QuotationStatus.REJECTED],
  ACCEPTED: [],
  REJECTED: [],
};

// ─── Controllers ──────────────────────────────────────────────────────────────

export const listQuotations = expressAsyncHandler(async (req: Request, res: Response) => {
  const rfq_id = qs(req.query.rfq_id);
  const vendor_id = qs(req.query.vendor_id);
  const status = qs(req.query.status);
  const sortBy = qs(req.query.sortBy, 'submitted_at');
  const order = qs(req.query.order, 'desc');
  const page = qs(req.query.page, '1');
  const limit = qs(req.query.limit, '20');

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const allowed = { submitted_at: 1, updated_at: 1, status: 1 };
  const sortField = (allowed as Record<string, number>)[sortBy] ? sortBy : 'submitted_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  const where: Record<string, unknown> = {};
  if (rfq_id) where.rfq_id = rfq_id;

  if (req.user?.role === 'VENDOR') {
    where.vendor = {
      contact_email: { equals: req.user.email, mode: 'insensitive' }
    };
  } else if (vendor_id) {
    where.vendor_id = vendor_id;
  }

  if (status) {
    const parsed = parseStatus(status);
    if (parsed) where.status = parsed;
  }


  const [quotations, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limitNum,
      include: {
        vendor: { select: { id: true, name: true, category: true, gst_number: true } },
        rfq: { select: { id: true, reference_number: true, title: true, deadline: true, status: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.quotation.count({ where }),
  ]);

  const [submittedCount, reviewCount, acceptedCount, rejectedCount] = await Promise.all([
    prisma.quotation.count({ where: { status: 'SUBMITTED' } }),
    prisma.quotation.count({ where: { status: 'UNDER_REVIEW' } }),
    prisma.quotation.count({ where: { status: 'ACCEPTED' } }),
    prisma.quotation.count({ where: { status: 'REJECTED' } }),
  ]);

  const payload = {
    data: quotations,
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    stats: { submitted: submittedCount, under_review: reviewCount, accepted: acceptedCount, rejected: rejectedCount },
  };

  return formatResponse(res, 200, "Quotations fetched", true, payload);
});

export const createQuotation = expressAsyncHandler(async (req: Request, res: Response) => {
  const { rfq_id, vendor_id, notes, items } = req.body as {
    rfq_id?: string;
    vendor_id?: string;
    notes?: string;
    items?: Array<{
      rfq_item_id?: string;
      unit_price?: number;
      delivery_days?: number;
      notes?: string;
    }>;
  };

  const errors: string[] = [];
  if (!rfq_id?.trim()) errors.push('rfq_id is required.');
  if (!vendor_id?.trim()) errors.push('vendor_id is required.');
  if (!Array.isArray(items) || items.length === 0)
    errors.push('items must be a non-empty array.');
  else {
    items.forEach((item, i) => {
      if (!item.rfq_item_id?.trim()) errors.push(`items[${i}].rfq_item_id is required.`);
      if (item.unit_price == null || item.unit_price < 0) errors.push(`items[${i}].unit_price must be >= 0.`);
      if (!item.delivery_days || item.delivery_days < 1) errors.push(`items[${i}].delivery_days must be >= 1.`);
    });
  }
  if (errors.length > 0) { 
    return formatResponse(res, 400, "Validation Error", false, null, errors); 
  }

  const rfq = await prisma.rFQ.findUnique({
    where: { id: rfq_id! },
    include: { items: { select: { id: true } } },
  });
  if (!rfq) { 
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found."); 
  }
  if (rfq.status !== 'SENT') {
    return formatResponse(res, 409, "Conflict", false, null, `Quotations can only be submitted for SENT RFQs. Current status: ${rfq.status}.`);
  }

  // Deadline is informational — the RFQ status (SENT → CLOSED) controls acceptance.
  // Procurement officers can close the RFQ manually when they stop accepting quotes.

  const assignment = await prisma.rFQ_Vendor.findUnique({
    where: { rfq_id_vendor_id: { rfq_id: rfq_id!, vendor_id: vendor_id! } },
  });
  if (!assignment) {
    return formatResponse(res, 403, "Forbidden", false, null, "This vendor is not assigned to the RFQ.");
  }

  const rfqItemIds = new Set(rfq.items.map((i) => i.id));
  const submittedItemIds = items!.map((i) => i.rfq_item_id!);
  const invalidItems = submittedItemIds.filter((id) => !rfqItemIds.has(id));
  if (invalidItems.length > 0) {
    return formatResponse(res, 400, "Validation Error", false, null, `items contain rfq_item_id(s) not belonging to this RFQ: ${invalidItems.join(', ')}.`);
  }

  const existing = await prisma.quotation.findUnique({
    where: { rfq_id_vendor_id: { rfq_id: rfq_id!, vendor_id: vendor_id! } },
  });
  if (existing) {
    return formatResponse(res, 409, "Conflict", false, null, "A quotation for this RFQ from this vendor already exists. Use PATCH to update it.");
  }

  try {
    const quotation = await prisma.quotation.create({
      data: {
        rfq_id: rfq_id!,
        vendor_id: vendor_id!,
        notes: notes?.trim() ?? null,
        status: QuotationStatus.SUBMITTED,
        items: {
          create: items!.map((item) => ({
            rfq_item_id: item.rfq_item_id!,
            unit_price: item.unit_price!,
            delivery_days: Number(item.delivery_days),
            notes: item.notes?.trim() ?? null,
          })),
        },
      },
      include: {
        items: { include: { rfq_item: { select: { id: true, product_name: true, quantity: true, unit: true } } } },
        vendor: { select: { id: true, name: true, category: true } },
        rfq: { select: { id: true, reference_number: true, title: true, deadline: true } },
      },
    });

    return formatResponse(res, 201, "Quotation submitted successfully", true, { data: quotation });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return formatResponse(res, 409, "Conflict", false, null, "A quotation from this vendor for this RFQ already exists.");
    }
    throw err;
  }
});

export const getQuotation = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          rfq_item: { select: { id: true, product_name: true, description: true, quantity: true, unit: true, unit_price: true } },
        },
      },
      vendor: { select: { id: true, name: true, category: true, gst_number: true, contact_email: true, phone: true } },
      rfq: { select: { id: true, reference_number: true, title: true, description: true, deadline: true, status: true } },
      approvals: { include: { approver: { select: { id: true, name: true } } }, orderBy: { decided_at: 'desc' } },
    },
  });

  if (!quotation) { 
    return formatResponse(res, 404, "Not Found", false, null, "Quotation not found."); 
  }
  return formatResponse(res, 200, "Quotation fetched", true, { data: quotation });
});

export const updateQuotation = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { notes, items } = req.body as {
    notes?: string;
    items?: Array<{
      rfq_item_id?: string;
      unit_price?: number;
      delivery_days?: number;
      notes?: string;
    }>;
  };

  const existing = await prisma.quotation.findUnique({
    where: { id },
    include: { rfq: { select: { deadline: true, status: true, items: { select: { id: true } } } } },
  });
  if (!existing) { 
    return formatResponse(res, 404, "Not Found", false, null, "Quotation not found."); 
  }

  if (existing.status !== 'SUBMITTED') {
    return formatResponse(res, 409, "Conflict", false, null, `Quotation cannot be edited in status: ${existing.status}.`);
  }

  if (new Date() > new Date(existing.rfq.deadline)) {
    return formatResponse(res, 409, "Conflict", false, null, "The RFQ deadline has passed. Quotation can no longer be edited.");
  }

  if (Array.isArray(items) && items.length > 0) {
    const errors: string[] = [];
    const rfqItemIds = new Set(existing.rfq.items.map((i) => i.id));
    items.forEach((item, i) => {
      if (!item.rfq_item_id?.trim()) errors.push(`items[${i}].rfq_item_id is required.`);
      else if (!rfqItemIds.has(item.rfq_item_id)) errors.push(`items[${i}].rfq_item_id not in this RFQ.`);
      if (item.unit_price != null && item.unit_price < 0) errors.push(`items[${i}].unit_price must be >= 0.`);
      if (item.delivery_days != null && item.delivery_days < 1) errors.push(`items[${i}].delivery_days must be >= 1.`);
    });
    if (errors.length > 0) { 
      return formatResponse(res, 400, "Validation Error", false, null, errors); 
    }

    await prisma.$transaction([
      prisma.quotation_Item.deleteMany({ where: { quotation_id: id } }),
      prisma.quotation_Item.createMany({
        data: items.map((item) => ({
          quotation_id: id,
          rfq_item_id: item.rfq_item_id!,
          unit_price: item.unit_price!,
          delivery_days: Number(item.delivery_days),
          notes: item.notes?.trim() ?? null,
        })),
      }),
    ]);
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: { notes: notes !== undefined ? (notes.trim() || null) : undefined },
    include: {
      items: { include: { rfq_item: { select: { id: true, product_name: true, quantity: true, unit: true } } } },
      vendor: { select: { id: true, name: true } },
      rfq: { select: { id: true, reference_number: true, title: true, deadline: true } },
    },
  });

  return formatResponse(res, 200, "Quotation updated", true, { data: updated });
});

export const confirmSubmission = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);

  const existing = await prisma.quotation.findUnique({
    where: { id },
    include: { rfq: { select: { deadline: true } } },
  });
  if (!existing) { 
    return formatResponse(res, 404, "Not Found", false, null, "Quotation not found."); 
  }

  if (existing.status !== 'SUBMITTED') {
    return formatResponse(res, 409, "Conflict", false, null, `Quotation is already ${existing.status} — cannot re-submit.`);
  }

  if (new Date() > new Date(existing.rfq.deadline)) {
    return formatResponse(res, 409, "Conflict", false, null, "The RFQ deadline has passed.");
  }

  const itemCount = await prisma.quotation_Item.count({ where: { quotation_id: id } });
  if (itemCount === 0) {
    return formatResponse(res, 400, "Validation Error", false, null, "Quotation must have at least one line item before submission.");
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: { submitted_at: new Date(), status: QuotationStatus.SUBMITTED },
  });

  return formatResponse(res, 200, "Quotation submitted successfully", true, { data: updated });
});

export const updateQuotationStatus = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { status, remarks } = req.body as { status?: string; remarks?: string };

  if (!status) { 
    return formatResponse(res, 400, "Validation Error", false, null, "status is required."); 
  }
  const newStatus = parseStatus(status);
  if (!newStatus) {
    return formatResponse(res, 400, "Validation Error", false, null, "status must be SUBMITTED, UNDER_REVIEW, ACCEPTED, or REJECTED.");
  }

  const existing = await prisma.quotation.findUnique({ where: { id } });
  if (!existing) { 
    return formatResponse(res, 404, "Not Found", false, null, "Quotation not found."); 
  }

  const allowed = REVIEWER_TRANSITIONS[existing.status as QuotationStatus];
  if (!allowed.includes(newStatus)) {
    return formatResponse(res, 409, "Conflict", false, null, `Cannot transition from ${existing.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}.`);
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: { status: newStatus },
    include: {
      vendor: { select: { id: true, name: true, contact_email: true } },
      rfq: { select: { id: true, reference_number: true, title: true } },
    },
  });

  if (newStatus === QuotationStatus.ACCEPTED || newStatus === QuotationStatus.REJECTED) {
    const approverId = String(req.body['approver_id'] ?? '');
    const approverExists = approverId
      ? await prisma.user.findUnique({ where: { id: approverId }, select: { id: true } })
      : null;

    if (approverExists) {
      await prisma.approval.create({
        data: {
          quotation_id: id,
          approver_id: approverId,
          status: newStatus === QuotationStatus.ACCEPTED
                          ? ApprovalStatus.APPROVED
                          : ApprovalStatus.REJECTED,
          remarks: remarks?.trim() ?? null,
          decided_at:   new Date(),
        },
      });
    }
  }

  return formatResponse(res, 200, "Quotation status updated", true, { data: updated });
});

export const deleteQuotation = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);

  const existing = await prisma.quotation.findUnique({
    where: { id },
    include: { rfq: { select: { deadline: true } } },
  });
  if (!existing) { 
    return formatResponse(res, 404, "Not Found", false, null, "Quotation not found."); 
  }

  if (existing.status !== 'SUBMITTED') {
    return formatResponse(res, 409, "Conflict", false, null, "Only SUBMITTED quotations can be withdrawn.");
  }

  if (new Date() > new Date(existing.rfq.deadline)) {
    return formatResponse(res, 409, "Conflict", false, null, "Deadline has passed — quotation cannot be withdrawn.");
  }

  await prisma.quotation.delete({ where: { id } });
  return formatResponse(res, 200, "Quotation withdrawn", true, null);
});

export const listRFQQuotations = expressAsyncHandler(async (req: Request, res: Response) => {
  const rfqId = String(req.params['rfqId']);

  const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { id: true } });
  if (!rfq) { 
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found."); 
  }

  const quotations = await prisma.quotation.findMany({
    where: { rfq_id: rfqId },
    orderBy: { submitted_at: 'desc' },
    include: {
      vendor: { select: { id: true, name: true, category: true, gst_number: true } },
      items: {
        include: {
          rfq_item: { select: { id: true, product_name: true, quantity: true, unit: true } },
        },
      },
      _count: { select: { approvals: true } },
    },
  });

  return formatResponse(res, 200, "RFQ Quotations fetched", true, { data: quotations, total: quotations.length });
});

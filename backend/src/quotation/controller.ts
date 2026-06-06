import { Request, Response } from 'express';
import { QuotationStatus } from '../generated/prisma/enums';
import prisma from '../utils/prisma';

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

/**
 * GET /api/quotations
 * ?rfq_id, vendor_id, status, sortBy, order, page, limit
 */
export async function listQuotations(req: Request, res: Response): Promise<void> {
  try {
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
    if (vendor_id) where.vendor_id = vendor_id;
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

    res.json({
      data: quotations,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      stats: { submitted: submittedCount, under_review: reviewCount, accepted: acceptedCount, rejected: rejectedCount },
    });
  } catch (err) {
    console.error('[listQuotations]', err);
    res.status(500).json({ error: 'Failed to fetch quotations.' });
  }
}

/**
 * POST /api/quotations
 * Vendor submits a quotation for an RFQ.
 * Body: { rfq_id, vendor_id, notes?, items: [{ rfq_item_id, unit_price, delivery_days, notes? }] }
 */
export async function createQuotation(req: Request, res: Response): Promise<void> {
  try {
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

    // Basic validation
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
    if (errors.length > 0) { res.status(400).json({ errors }); return; }

    // Verify RFQ exists and is SENT
    const rfq = await prisma.rFQ.findUnique({
      where: { id: rfq_id! },
      include: { items: { select: { id: true } } },
    });
    if (!rfq) { res.status(404).json({ error: 'RFQ not found.' }); return; }
    if (rfq.status !== 'SENT') {
      res.status(409).json({ error: `Quotations can only be submitted for SENT RFQs. Current status: ${rfq.status}.` });
      return;
    }

    // Deadline check
    if (new Date() > new Date(rfq.deadline)) {
      res.status(409).json({ error: 'The RFQ deadline has passed. Quotations are no longer accepted.' });
      return;
    }

    // Verify vendor is assigned to this RFQ
    const assignment = await prisma.rFQ_Vendor.findUnique({
      where: { rfq_id_vendor_id: { rfq_id: rfq_id!, vendor_id: vendor_id! } },
    });
    if (!assignment) {
      res.status(403).json({ error: 'This vendor is not assigned to the RFQ.' });
      return;
    }

    // Verify all rfq_item_ids belong to this RFQ
    const rfqItemIds = new Set(rfq.items.map((i) => i.id));
    const submittedItemIds = items!.map((i) => i.rfq_item_id!);
    const invalidItems = submittedItemIds.filter((id) => !rfqItemIds.has(id));
    if (invalidItems.length > 0) {
      res.status(400).json({ error: `items contain rfq_item_id(s) not belonging to this RFQ: ${invalidItems.join(', ')}.` });
      return;
    }

    // Check for duplicate submission
    const existing = await prisma.quotation.findUnique({
      where: { rfq_id_vendor_id: { rfq_id: rfq_id!, vendor_id: vendor_id! } },
    });
    if (existing) {
      res.status(409).json({ error: 'A quotation for this RFQ from this vendor already exists. Use PATCH to update it.' });
      return;
    }

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

    res.status(201).json({ data: quotation });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'A quotation from this vendor for this RFQ already exists.' });
      return;
    }
    console.error('[createQuotation]', err);
    res.status(500).json({ error: 'Failed to submit quotation.' });
  }
}

/**
 * GET /api/quotations/:id
 */
export async function getQuotation(req: Request, res: Response): Promise<void> {
  try {
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

    if (!quotation) { res.status(404).json({ error: 'Quotation not found.' }); return; }
    res.json({ data: quotation });
  } catch (err) {
    console.error('[getQuotation]', err);
    res.status(500).json({ error: 'Failed to fetch quotation.' });
  }
}

/**
 * PATCH /api/quotations/:id
 * Vendor edits their quotation — only allowed before deadline and when SUBMITTED.
 * Body: { notes?, items: [{ rfq_item_id, unit_price, delivery_days, notes? }] }
 */
export async function updateQuotation(req: Request, res: Response): Promise<void> {
  try {
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
    if (!existing) { res.status(404).json({ error: 'Quotation not found.' }); return; }

    // Only SUBMITTED quotations can be edited by the vendor
    if (existing.status !== 'SUBMITTED') {
      res.status(409).json({ error: `Quotation cannot be edited in status: ${existing.status}.` });
      return;
    }

    // Deadline guard
    if (new Date() > new Date(existing.rfq.deadline)) {
      res.status(409).json({ error: 'The RFQ deadline has passed. Quotation can no longer be edited.' });
      return;
    }

    // Validate new items if provided
    if (Array.isArray(items) && items.length > 0) {
      const errors: string[] = [];
      const rfqItemIds = new Set(existing.rfq.items.map((i) => i.id));
      items.forEach((item, i) => {
        if (!item.rfq_item_id?.trim()) errors.push(`items[${i}].rfq_item_id is required.`);
        else if (!rfqItemIds.has(item.rfq_item_id)) errors.push(`items[${i}].rfq_item_id not in this RFQ.`);
        if (item.unit_price != null && item.unit_price < 0) errors.push(`items[${i}].unit_price must be >= 0.`);
        if (item.delivery_days != null && item.delivery_days < 1) errors.push(`items[${i}].delivery_days must be >= 1.`);
      });
      if (errors.length > 0) { res.status(400).json({ errors }); return; }

      // Replace all items atomically
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

    // Update top-level fields
    const updated = await prisma.quotation.update({
      where: { id },
      data: { notes: notes !== undefined ? (notes.trim() || null) : undefined },
      include: {
        items: { include: { rfq_item: { select: { id: true, product_name: true, quantity: true, unit: true } } } },
        vendor: { select: { id: true, name: true } },
        rfq: { select: { id: true, reference_number: true, title: true, deadline: true } },
      },
    });

    res.json({ data: updated });
  } catch (err) {
    console.error('[updateQuotation]', err);
    res.status(500).json({ error: 'Failed to update quotation.' });
  }
}

/**
 * POST /api/quotations/:id/submit
 * Vendor explicitly confirms submission (re-submits after editing).
 * Resets status back to SUBMITTED from any editable state.
 */
export async function confirmSubmission(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);

    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: { rfq: { select: { deadline: true } } },
    });
    if (!existing) { res.status(404).json({ error: 'Quotation not found.' }); return; }

    if (existing.status !== 'SUBMITTED') {
      res.status(409).json({ error: `Quotation is already ${existing.status} — cannot re-submit.` });
      return;
    }

    if (new Date() > new Date(existing.rfq.deadline)) {
      res.status(409).json({ error: 'The RFQ deadline has passed.' });
      return;
    }

    // Check quotation has at least one item
    const itemCount = await prisma.quotation_Item.count({ where: { quotation_id: id } });
    if (itemCount === 0) {
      res.status(400).json({ error: 'Quotation must have at least one line item before submission.' });
      return;
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: { submitted_at: new Date(), status: QuotationStatus.SUBMITTED },
    });

    res.json({ message: 'Quotation submitted successfully.', data: updated });
  } catch (err) {
    console.error('[confirmSubmission]', err);
    res.status(500).json({ error: 'Failed to confirm submission.' });
  }
}

/**
 * PATCH /api/quotations/:id/status
 * Reviewer updates status: SUBMITTED→UNDER_REVIEW→ACCEPTED|REJECTED
 * Body: { status, remarks? }
 */
export async function updateQuotationStatus(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);
    const { status, remarks } = req.body as { status?: string; remarks?: string };

    if (!status) { res.status(400).json({ error: 'status is required.' }); return; }
    const newStatus = parseStatus(status);
    if (!newStatus) {
      res.status(400).json({ error: 'status must be SUBMITTED, UNDER_REVIEW, ACCEPTED, or REJECTED.' });
      return;
    }

    const existing = await prisma.quotation.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Quotation not found.' }); return; }

    const allowed = REVIEWER_TRANSITIONS[existing.status as QuotationStatus];
    if (!allowed.includes(newStatus)) {
      res.status(409).json({
        error: `Cannot transition from ${existing.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}.`,
      });
      return;
    }

    const updated = await prisma.quotation.update({
      where: { id },
      data: { status: newStatus },
      include: {
        vendor: { select: { id: true, name: true, contact_email: true } },
        rfq: { select: { id: true, reference_number: true, title: true } },
      },
    });

    // Persist an approval record for ACCEPTED / REJECTED
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
            status: newStatus,
            remarks: remarks?.trim() ?? null,
          },
        });
      }
    }

    res.json({ data: updated });
  } catch (err) {
    console.error('[updateQuotationStatus]', err);
    res.status(500).json({ error: 'Failed to update quotation status.' });
  }
}

/**
 * DELETE /api/quotations/:id
 * Vendor withdraws their quotation — only if SUBMITTED and before deadline.
 */
export async function deleteQuotation(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);

    const existing = await prisma.quotation.findUnique({
      where: { id },
      include: { rfq: { select: { deadline: true } } },
    });
    if (!existing) { res.status(404).json({ error: 'Quotation not found.' }); return; }

    if (existing.status !== 'SUBMITTED') {
      res.status(409).json({ error: 'Only SUBMITTED quotations can be withdrawn.' });
      return;
    }

    if (new Date() > new Date(existing.rfq.deadline)) {
      res.status(409).json({ error: 'Deadline has passed — quotation cannot be withdrawn.' });
      return;
    }

    await prisma.quotation.delete({ where: { id } });
    res.json({ message: 'Quotation withdrawn.' });
  } catch (err) {
    console.error('[deleteQuotation]', err);
    res.status(500).json({ error: 'Failed to withdraw quotation.' });
  }
}

/**
 * GET /api/rfqs/:rfqId/quotations
 * All quotations for a specific RFQ (reviewer view).
 */
export async function listRFQQuotations(req: Request, res: Response): Promise<void> {
  try {
    const rfqId = String(req.params['rfqId']);

    const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { id: true } });
    if (!rfq) { res.status(404).json({ error: 'RFQ not found.' }); return; }

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

    res.json({ data: quotations, total: quotations.length });
  } catch (err) {
    console.error('[listRFQQuotations]', err);
    res.status(500).json({ error: 'Failed to fetch RFQ quotations.' });
  }
}

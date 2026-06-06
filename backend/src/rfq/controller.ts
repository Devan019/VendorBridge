import { Request, Response } from 'express';
import { RFQStatus } from '../generated/prisma/enums';
import prisma from '../lib/prisma';
import fs from 'fs';
import path from 'path';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a plain string from Express query (which can be string | string[] | ...) */
function qs(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return fallback;
}

/** Generate a unique RFQ reference number: RFQ-YYYYMMDD-XXXXXX */
async function generateRefNumber(): Promise<string> {
  const today = new Date();
  const datePart = today
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, ''); // "20260606"

  const count = await prisma.rFQ.count();
  const seq = String(count + 1).padStart(4, '0');
  return `RFQ-${datePart}-${seq}`;
}

function parseRFQStatus(raw: string | undefined): RFQStatus | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (['DRAFT', 'SENT', 'CLOSED'].includes(upper)) return upper as RFQStatus;
  return undefined;
}

/** Valid status transitions */
const TRANSITIONS: Record<RFQStatus, RFQStatus[]> = {
  DRAFT:  ['SENT'],
  SENT:   ['CLOSED'],
  CLOSED: [],
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/rfqs
 * ?search, status, created_by, sortBy, order, page, limit
 */
export async function listRFQs(req: Request, res: Response): Promise<void> {
  try {
    const search     = qs(req.query.search);
    const status     = qs(req.query.status);
    const created_by = qs(req.query.created_by);
    const sortBy     = qs(req.query.sortBy, 'created_at');
    const order      = qs(req.query.order, 'desc');
    const page       = qs(req.query.page, '1');
    const limit      = qs(req.query.limit, '20');

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const allowed = { title: 1, status: 1, deadline: 1, created_at: 1, reference_number: 1 };
    const sortField = (allowed as Record<string, number>)[sortBy] ? sortBy : 'created_at';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (search.trim()) {
      where.OR = [
        { title:            { contains: search.trim(), mode: 'insensitive' } },
        { reference_number: { contains: search.trim(), mode: 'insensitive' } },
        { description:      { contains: search.trim(), mode: 'insensitive' } },
      ];
    }
    if (status) {
      const parsed = parseRFQStatus(status);
      if (parsed) where.status = parsed;
    }
    if (created_by) where.created_by = created_by;

    const [rfqs, total] = await Promise.all([
      prisma.rFQ.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limitNum,
        select: {
          id: true, reference_number: true, title: true, description: true,
          deadline: true, status: true, created_at: true, updated_at: true,
          creator: { select: { id: true, name: true, email: true } },
          _count: { select: { items: true, vendors: true, rfqAttachments: true, quotations: true } },
        },
      }),
      prisma.rFQ.count({ where }),
    ]);

    const [draftCount, sentCount, closedCount] = await Promise.all([
      prisma.rFQ.count({ where: { status: 'DRAFT' } }),
      prisma.rFQ.count({ where: { status: 'SENT' } }),
      prisma.rFQ.count({ where: { status: 'CLOSED' } }),
    ]);

    res.json({
      data: rfqs,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
      stats: { total: draftCount + sentCount + closedCount, draft: draftCount, sent: sentCount, closed: closedCount },
    });
  } catch (err) {
    console.error('[listRFQs]', err);
    res.status(500).json({ error: 'Failed to fetch RFQs.' });
  }
}

/**
 * POST /api/rfqs
 * Body: { title, description, deadline, created_by, items[], vendor_ids[] }
 * items: [{ product_name, description?, quantity, unit, unit_price? }]
 */
export async function createRFQ(req: Request, res: Response): Promise<void> {
  try {
    const { title, description, deadline, created_by, items, vendor_ids, status } = req.body as {
      title?: string;
      description?: string;
      deadline?: string;
      created_by?: string;
      items?: Array<{
        product_name?: string;
        description?: string;
        quantity?: number;
        unit?: string;
        unit_price?: number;
      }>;
      vendor_ids?: string[];
      status?: string;
    };

    // Validation
    const errors: string[] = [];
    if (!title?.trim())       errors.push('title is required.');
    if (!description?.trim()) errors.push('description is required.');
    if (!deadline)            errors.push('deadline is required.');
    else if (isNaN(Date.parse(deadline))) errors.push('deadline must be a valid date.');
    if (!created_by?.trim())  errors.push('created_by (user id) is required.');

    if (Array.isArray(items) && items.length > 0) {
      items.forEach((item, i) => {
        if (!item.product_name?.trim()) errors.push(`items[${i}].product_name is required.`);
        if (!item.quantity || item.quantity < 1) errors.push(`items[${i}].quantity must be >= 1.`);
        if (!item.unit?.trim()) errors.push(`items[${i}].unit is required.`);
      });
    }

    if (errors.length > 0) { res.status(400).json({ errors }); return; }

    // Verify creator exists
    const user = await prisma.user.findUnique({ where: { id: created_by! }, select: { id: true } });
    if (!user) { res.status(404).json({ error: 'creator user not found.' }); return; }

    // Verify vendor IDs
    if (Array.isArray(vendor_ids) && vendor_ids.length > 0) {
      const found = await prisma.vendor.count({ where: { id: { in: vendor_ids } } });
      if (found !== vendor_ids.length) {
        res.status(404).json({ error: 'One or more vendor_ids not found.' }); return;
      }
    }

    const reference_number = await generateRefNumber();
    const parsedStatus = parseRFQStatus(status) ?? RFQStatus.DRAFT;

    const rfq = await prisma.rFQ.create({
      data: {
        reference_number,
        title:       title!.trim(),
        description: description!.trim(),
        deadline:    new Date(deadline!),
        status:      parsedStatus,
        created_by:  created_by!,
        items: {
          create: (items ?? []).map((item) => ({
            product_name: item.product_name!.trim(),
            description:  item.description?.trim() ?? null,
            quantity:     Number(item.quantity),
            unit:         item.unit!.trim(),
            unit_price:   item.unit_price != null ? item.unit_price : null,
          })),
        },
        vendors: {
          create: (vendor_ids ?? []).map((vid) => ({ vendor_id: vid })),
        },
      },
      include: {
        items:    true,
        vendors:  { include: { vendor: { select: { id: true, name: true, category: true, status: true } } } },
        creator:  { select: { id: true, name: true, email: true } },
        _count:   { select: { rfqAttachments: true, quotations: true } },
      },
    });

    res.status(201).json({ data: rfq });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'Reference number conflict — please retry.' }); return;
    }
    console.error('[createRFQ]', err);
    res.status(500).json({ error: 'Failed to create RFQ.' });
  }
}

/**
 * GET /api/rfqs/:id
 */
export async function getRFQ(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);

    const rfq = await prisma.rFQ.findUnique({
      where: { id },
      include: {
        items:       true,
        rfqAttachments: true,
        vendors:     { include: { vendor: { select: { id: true, name: true, category: true, gst_number: true, contact_email: true, status: true } } } },
        creator:     { select: { id: true, name: true, email: true } },
        _count:      { select: { quotations: true } },
      },
    });

    if (!rfq) { res.status(404).json({ error: 'RFQ not found.' }); return; }
    res.json({ data: rfq });
  } catch (err) {
    console.error('[getRFQ]', err);
    res.status(500).json({ error: 'Failed to fetch RFQ.' });
  }
}

/**
 * PATCH /api/rfqs/:id
 * Updates editable fields — only allowed when status = DRAFT
 */
export async function updateRFQ(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);
    const { title, description, deadline } = req.body as {
      title?: string; description?: string; deadline?: string;
    };

    const existing = await prisma.rFQ.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'RFQ not found.' }); return; }
    if (existing.status !== 'DRAFT') {
      res.status(409).json({ error: 'Only DRAFT RFQs can be edited.' }); return;
    }

    const errors: string[] = [];
    if (deadline !== undefined && isNaN(Date.parse(deadline)))
      errors.push('deadline must be a valid date.');
    if (errors.length > 0) { res.status(400).json({ errors }); return; }

    const data: Record<string, unknown> = {};
    if (title       !== undefined) data.title       = title.trim();
    if (description !== undefined) data.description = description.trim();
    if (deadline    !== undefined) data.deadline    = new Date(deadline);

    const updated = await prisma.rFQ.update({ where: { id }, data });
    res.json({ data: updated });
  } catch (err) {
    console.error('[updateRFQ]', err);
    res.status(500).json({ error: 'Failed to update RFQ.' });
  }
}

/**
 * PATCH /api/rfqs/:id/status
 * Body: { status: "SENT" | "CLOSED" }
 * Enforces valid transitions: DRAFT→SENT, SENT→CLOSED
 */
export async function updateRFQStatus(req: Request, res: Response): Promise<void> {
  try {
    const id     = String(req.params['id']);
    const { status } = req.body as { status?: string };

    if (!status) { res.status(400).json({ error: 'status is required.' }); return; }
    const newStatus = parseRFQStatus(status);
    if (!newStatus) { res.status(400).json({ error: 'status must be DRAFT, SENT, or CLOSED.' }); return; }

    const existing = await prisma.rFQ.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'RFQ not found.' }); return; }

    const allowed = TRANSITIONS[existing.status as RFQStatus];
    if (!allowed.includes(newStatus)) {
      res.status(409).json({
        error: `Cannot transition from ${existing.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}.`,
      });
      return;
    }

    const updated = await prisma.rFQ.update({ where: { id }, data: { status: newStatus } });
    res.json({ data: updated });
  } catch (err) {
    console.error('[updateRFQStatus]', err);
    res.status(500).json({ error: 'Failed to update RFQ status.' });
  }
}

/**
 * DELETE /api/rfqs/:id
 * Hard delete — only DRAFT RFQs can be deleted
 */
export async function deleteRFQ(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);

    const existing = await prisma.rFQ.findUnique({
      where: { id },
      include: { rfqAttachments: { select: { path: true } } },
    });
    if (!existing) { res.status(404).json({ error: 'RFQ not found.' }); return; }
    if (existing.status !== 'DRAFT') {
      res.status(409).json({ error: 'Only DRAFT RFQs can be deleted.' }); return;
    }

    // Remove uploaded files from disk before DB delete
    for (const att of existing.rfqAttachments) {
      if (fs.existsSync(att.path)) fs.unlinkSync(att.path);
    }

    await prisma.rFQ.delete({ where: { id } });
    res.json({ message: 'RFQ deleted.' });
  } catch (err) {
    console.error('[deleteRFQ]', err);
    res.status(500).json({ error: 'Failed to delete RFQ.' });
  }
}

// ─── Line Items ───────────────────────────────────────────────────────────────

/**
 * POST /api/rfqs/:id/items
 * Add a line item to a DRAFT RFQ
 */
export async function addItem(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);
    const { product_name, description, quantity, unit, unit_price } = req.body as {
      product_name?: string; description?: string;
      quantity?: number; unit?: string; unit_price?: number;
    };

    const rfq = await prisma.rFQ.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!rfq) { res.status(404).json({ error: 'RFQ not found.' }); return; }
    if (rfq.status !== 'DRAFT') { res.status(409).json({ error: 'Items can only be added to DRAFT RFQs.' }); return; }

    const errors: string[] = [];
    if (!product_name?.trim()) errors.push('product_name is required.');
    if (!quantity || Number(quantity) < 1) errors.push('quantity must be >= 1.');
    if (!unit?.trim()) errors.push('unit is required.');
    if (errors.length > 0) { res.status(400).json({ errors }); return; }

    const item = await prisma.rFQ_Item.create({
      data: {
        rfq_id:       id,
        product_name: product_name!.trim(),
        description:  description?.trim() ?? null,
        quantity:     Number(quantity),
        unit:         unit!.trim(),
        unit_price:   unit_price != null ? unit_price : null,
      },
    });

    res.status(201).json({ data: item });
  } catch (err) {
    console.error('[addItem]', err);
    res.status(500).json({ error: 'Failed to add item.' });
  }
}

/**
 * PATCH /api/rfqs/:id/items/:itemId
 */
export async function updateItem(req: Request, res: Response): Promise<void> {
  try {
    const rfqId  = String(req.params['id']);
    const itemId = String(req.params['itemId']);
    const { product_name, description, quantity, unit, unit_price } = req.body as {
      product_name?: string; description?: string;
      quantity?: number; unit?: string; unit_price?: number;
    };

    const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { status: true } });
    if (!rfq) { res.status(404).json({ error: 'RFQ not found.' }); return; }
    if (rfq.status !== 'DRAFT') { res.status(409).json({ error: 'Items can only be edited on DRAFT RFQs.' }); return; }

    const item = await prisma.rFQ_Item.findFirst({ where: { id: itemId, rfq_id: rfqId } });
    if (!item) { res.status(404).json({ error: 'Item not found.' }); return; }

    const data: Record<string, unknown> = {};
    if (product_name !== undefined) data.product_name = product_name.trim();
    if (description  !== undefined) data.description  = description.trim() || null;
    if (quantity     !== undefined) data.quantity     = Number(quantity);
    if (unit         !== undefined) data.unit         = unit.trim();
    if (unit_price   !== undefined) data.unit_price   = unit_price;

    const updated = await prisma.rFQ_Item.update({ where: { id: itemId }, data });
    res.json({ data: updated });
  } catch (err) {
    console.error('[updateItem]', err);
    res.status(500).json({ error: 'Failed to update item.' });
  }
}

/**
 * DELETE /api/rfqs/:id/items/:itemId
 */
export async function deleteItem(req: Request, res: Response): Promise<void> {
  try {
    const rfqId  = String(req.params['id']);
    const itemId = String(req.params['itemId']);

    const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { status: true } });
    if (!rfq) { res.status(404).json({ error: 'RFQ not found.' }); return; }
    if (rfq.status !== 'DRAFT') { res.status(409).json({ error: 'Items can only be removed from DRAFT RFQs.' }); return; }

    const item = await prisma.rFQ_Item.findFirst({ where: { id: itemId, rfq_id: rfqId } });
    if (!item) { res.status(404).json({ error: 'Item not found.' }); return; }

    await prisma.rFQ_Item.delete({ where: { id: itemId } });
    res.json({ message: 'Item removed.' });
  } catch (err) {
    console.error('[deleteItem]', err);
    res.status(500).json({ error: 'Failed to delete item.' });
  }
}

// ─── Vendor Assignment ────────────────────────────────────────────────────────

/**
 * POST /api/rfqs/:id/vendors
 * Body: { vendor_ids: string[] }
 */
export async function assignVendors(req: Request, res: Response): Promise<void> {
  try {
    const rfqId = String(req.params['id']);
    const { vendor_ids } = req.body as { vendor_ids?: string[] };

    if (!Array.isArray(vendor_ids) || vendor_ids.length === 0) {
      res.status(400).json({ error: 'vendor_ids must be a non-empty array.' }); return;
    }

    const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { id: true, status: true } });
    if (!rfq) { res.status(404).json({ error: 'RFQ not found.' }); return; }
    if (rfq.status === 'CLOSED') { res.status(409).json({ error: 'Cannot assign vendors to a CLOSED RFQ.' }); return; }

    const found = await prisma.vendor.count({ where: { id: { in: vendor_ids } } });
    if (found !== vendor_ids.length) {
      res.status(404).json({ error: 'One or more vendor_ids not found.' }); return;
    }

    // Upsert — skip already-assigned vendors
    await prisma.rFQ_Vendor.createMany({
      data: vendor_ids.map((vid) => ({ rfq_id: rfqId, vendor_id: vid })),
      skipDuplicates: true,
    });

    const updated = await prisma.rFQ.findUnique({
      where: { id: rfqId },
      include: { vendors: { include: { vendor: { select: { id: true, name: true, category: true, status: true } } } } },
    });

    res.json({ data: updated });
  } catch (err) {
    console.error('[assignVendors]', err);
    res.status(500).json({ error: 'Failed to assign vendors.' });
  }
}

/**
 * DELETE /api/rfqs/:id/vendors/:vendorId
 */
export async function removeVendor(req: Request, res: Response): Promise<void> {
  try {
    const rfqId    = String(req.params['id']);
    const vendorId = String(req.params['vendorId']);

    const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { status: true } });
    if (!rfq) { res.status(404).json({ error: 'RFQ not found.' }); return; }
    if (rfq.status === 'CLOSED') { res.status(409).json({ error: 'Cannot modify vendors on a CLOSED RFQ.' }); return; }

    const link = await prisma.rFQ_Vendor.findUnique({
      where: { rfq_id_vendor_id: { rfq_id: rfqId, vendor_id: vendorId } },
    });
    if (!link) { res.status(404).json({ error: 'Vendor not assigned to this RFQ.' }); return; }

    await prisma.rFQ_Vendor.delete({
      where: { rfq_id_vendor_id: { rfq_id: rfqId, vendor_id: vendorId } },
    });

    res.json({ message: 'Vendor removed from RFQ.' });
  } catch (err) {
    console.error('[removeVendor]', err);
    res.status(500).json({ error: 'Failed to remove vendor.' });
  }
}

// ─── Attachments ──────────────────────────────────────────────────────────────

/**
 * POST /api/rfqs/:id/attachments
 * Multipart — field name: "file" (single file per request)
 */
export async function uploadAttachment(req: Request, res: Response): Promise<void> {
  try {
    const rfqId = String(req.params['id']);

    const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { id: true, status: true } });
    if (!rfq) {
      // Remove uploaded file if RFQ doesn't exist
      if (req.file) fs.unlinkSync(req.file.path);
      res.status(404).json({ error: 'RFQ not found.' }); return;
    }

    if (!req.file) { res.status(400).json({ error: 'No file uploaded. Use field name "file".' }); return; }

    const attachment = await prisma.rFQ_Attachment.create({
      data: {
        rfq_id:        rfqId,
        filename:      req.file.filename,
        original_name: req.file.originalname,
        mime_type:     req.file.mimetype,
        size_bytes:    req.file.size,
        path:          req.file.path,
      },
    });

    res.status(201).json({ data: attachment });
  } catch (err) {
    console.error('[uploadAttachment]', err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to save attachment.' });
  }
}

/**
 * DELETE /api/rfqs/:id/attachments/:attachmentId
 */
export async function deleteAttachment(req: Request, res: Response): Promise<void> {
  try {
    const rfqId        = String(req.params['id']);
    const attachmentId = String(req.params['attachmentId']);

    const attachment = await prisma.rFQ_Attachment.findFirst({
      where: { id: attachmentId, rfq_id: rfqId },
    });
    if (!attachment) { res.status(404).json({ error: 'Attachment not found.' }); return; }

    // Delete file from disk
    if (fs.existsSync(attachment.path)) fs.unlinkSync(attachment.path);

    await prisma.rFQ_Attachment.delete({ where: { id: attachmentId } });
    res.json({ message: 'Attachment deleted.' });
  } catch (err) {
    console.error('[deleteAttachment]', err);
    res.status(500).json({ error: 'Failed to delete attachment.' });
  }
}

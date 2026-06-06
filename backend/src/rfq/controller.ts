import { Request, Response } from 'express';
import { RFQStatus } from '../generated/prisma/enums';
import prisma from '../utils/prisma';
import { logActivity } from '../utils/activityLog';
import { uploadBufferToS3, deleteFileFromS3 } from '../utils/s3';
import { S3_PUBLIC_BUCKET } from '../env_var';
import expressAsyncHandler from '../utils/expressAsync';
import { formatResponse } from '../utils/formateResponse';

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
  DRAFT: ['SENT'],
  SENT: ['CLOSED'],
  CLOSED: [],
};

// ─── Controllers ──────────────────────────────────────────────────────────────

export const listRFQs = expressAsyncHandler(async (req: Request, res: Response) => {
  const search = qs(req.query.search);
  const status = qs(req.query.status);
  const created_by = qs(req.query.created_by);
  const sortBy = qs(req.query.sortBy, 'created_at');
  const order = qs(req.query.order, 'desc');
  const page = qs(req.query.page, '1');
  const limit = qs(req.query.limit, '20');

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const allowed = { title: 1, status: 1, deadline: 1, created_at: 1, reference_number: 1 };
  const sortField = (allowed as Record<string, number>)[sortBy] ? sortBy : 'created_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  const where: Record<string, unknown> = {};
  if (search.trim()) {
    where.OR = [
      { title: { contains: search.trim(), mode: 'insensitive' } },
      { reference_number: { contains: search.trim(), mode: 'insensitive' } },
      { description: { contains: search.trim(), mode: 'insensitive' } },
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

  const payload = {
    data: rfqs,
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    stats: { total: draftCount + sentCount + closedCount, draft: draftCount, sent: sentCount, closed: closedCount },
  };

  return formatResponse(res, 200, "RFQs fetched successfully", true, payload);
});

export const createRFQ = expressAsyncHandler(async (req: Request, res: Response) => {
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

  const errors: string[] = [];
  if (!title?.trim()) errors.push('title is required.');
  if (!description?.trim()) errors.push('description is required.');
  if (!deadline) errors.push('deadline is required.');
  else if (isNaN(Date.parse(deadline))) errors.push('deadline must be a valid date.');
  if (!created_by?.trim()) errors.push('created_by (user id) is required.');

  if (Array.isArray(items) && items.length > 0) {
    items.forEach((item, i) => {
      if (!item.product_name?.trim()) errors.push(`items[${i}].product_name is required.`);
      if (!item.quantity || item.quantity < 1) errors.push(`items[${i}].quantity must be >= 1.`);
      if (!item.unit?.trim()) errors.push(`items[${i}].unit is required.`);
    });
  }

  if (errors.length > 0) {
    return formatResponse(res, 400, "Validation Error", false, null, errors);
  }

  const user = await prisma.user.findUnique({ where: { id: created_by! }, select: { id: true } });
  if (!user) {
    return formatResponse(res, 404, "Not Found", false, null, "creator user not found.");
  }

  if (Array.isArray(vendor_ids) && vendor_ids.length > 0) {
    const found = await prisma.vendor.count({ where: { id: { in: vendor_ids } } });
    if (found !== vendor_ids.length) {
      return formatResponse(res, 404, "Not Found", false, null, "One or more vendor_ids not found.");
    }
  }

  const reference_number = await generateRefNumber();
  const parsedStatus = parseRFQStatus(status) ?? RFQStatus.DRAFT;

  try {
    const rfq = await prisma.rFQ.create({
      data: {
        reference_number,
        title: title!.trim(),
        description: description!.trim(),
        deadline: new Date(deadline!),
        status: parsedStatus,
        created_by: created_by!,
        items: {
          create: (items ?? []).map((item) => ({
            product_name: item.product_name!.trim(),
            description: item.description?.trim() ?? null,
            quantity: Number(item.quantity),
            unit: item.unit!.trim(),
            unit_price: item.unit_price != null ? item.unit_price : null,
          })),
        },
        vendors: {
          create: (vendor_ids ?? []).map((vid) => ({ vendor_id: vid })),
        },
      },
      include: {
        items: true,
        vendors: { include: { vendor: { select: { id: true, name: true, category: true, status: true } } } },
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { rfqAttachments: true, quotations: true } },
      },
    });

    await logActivity('RFQ', rfq.id, 'CREATED', rfq.created_by);

    return formatResponse(res, 201, "RFQ created successfully", true, { data: rfq });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return formatResponse(res, 409, "Conflict", false, null, "Reference number conflict — please retry.");
    }
    throw err;
  }
});

export const getRFQ = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);

  const rfq = await prisma.rFQ.findUnique({
    where: { id },
    include: {
      items: true,
      rfqAttachments: true,
      vendors: { include: { vendor: { select: { id: true, name: true, category: true, gst_number: true, contact_email: true, status: true } } } },
      creator: { select: { id: true, name: true, email: true } },
      _count: { select: { quotations: true } },
    },
  });

  if (!rfq) {
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found.");
  }
  return formatResponse(res, 200, "RFQ fetched successfully", true, { data: rfq });
});

export const updateRFQ = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { title, description, deadline } = req.body as {
    title?: string; description?: string; deadline?: string;
  };

  const existing = await prisma.rFQ.findUnique({ where: { id } });
  if (!existing) {
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found.");
  }
  if (existing.status !== 'DRAFT') {
    return formatResponse(res, 409, "Conflict", false, null, "Only DRAFT RFQs can be edited.");
  }

  const errors: string[] = [];
  if (deadline !== undefined && isNaN(Date.parse(deadline)))
    errors.push('deadline must be a valid date.');
  if (errors.length > 0) {
    return formatResponse(res, 400, "Validation Error", false, null, errors);
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title.trim();
  if (description !== undefined) data.description = description.trim();
  if (deadline !== undefined) data.deadline = new Date(deadline);

  const updated = await prisma.rFQ.update({ where: { id }, data });
  await logActivity('RFQ', updated.id, 'UPDATED', req.user?.id || existing.created_by);
  return formatResponse(res, 200, "RFQ updated successfully", true, { data: updated });
});

export const updateRFQStatus = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { status } = req.body as { status?: string };

  if (!status) {
    return formatResponse(res, 400, "Validation Error", false, null, "status is required.");
  }
  const newStatus = parseRFQStatus(status);
  if (!newStatus) {
    return formatResponse(res, 400, "Validation Error", false, null, "status must be DRAFT, SENT, or CLOSED.");
  }

  const existing = await prisma.rFQ.findUnique({ where: { id } });
  if (!existing) {
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found.");
  }

  const allowed = TRANSITIONS[existing.status as RFQStatus];
  if (!allowed.includes(newStatus)) {
    return formatResponse(res, 409, "Conflict", false, null, `Cannot transition from ${existing.status} to ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}.`);
  }

  const updated = await prisma.rFQ.update({ where: { id }, data: { status: newStatus } });
  await logActivity('RFQ', updated.id, `STATUS_CHANGED:${newStatus}`, req.user?.id || existing.created_by);
  return formatResponse(res, 200, "RFQ status updated", true, { data: updated });
});

export const deleteRFQ = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);

  const existing = await prisma.rFQ.findUnique({
    where: { id },
    include: { rfqAttachments: { select: { path: true } } },
  });
  if (!existing) {
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found.");
  }
  if (existing.status !== 'DRAFT') {
    return formatResponse(res, 409, "Conflict", false, null, "Only DRAFT RFQs can be deleted.");
  }

  for (const att of existing.rfqAttachments) {
    await deleteFileFromS3(att.path, S3_PUBLIC_BUCKET || 'public');
  }

  await prisma.rFQ.delete({ where: { id } });
  await logActivity('RFQ', id, 'DELETED', req.user?.id || existing.created_by);
  return formatResponse(res, 200, "RFQ deleted", true, null);
});

// ─── Line Items ───────────────────────────────────────────────────────────────

export const addItem = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { product_name, description, quantity, unit, unit_price } = req.body as {
    product_name?: string; description?: string;
    quantity?: number; unit?: string; unit_price?: number;
  };

  const rfq = await prisma.rFQ.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!rfq) {
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found.");
  }
  if (rfq.status !== 'DRAFT') {
    return formatResponse(res, 409, "Conflict", false, null, "Items can only be added to DRAFT RFQs.");
  }

  const errors: string[] = [];
  if (!product_name?.trim()) errors.push('product_name is required.');
  if (!quantity || Number(quantity) < 1) errors.push('quantity must be >= 1.');
  if (!unit?.trim()) errors.push('unit is required.');
  if (errors.length > 0) {
    return formatResponse(res, 400, "Validation Error", false, null, errors);
  }

  const item = await prisma.rFQ_Item.create({
    data: {
      rfq_id: id,
      product_name: product_name!.trim(),
      description: description?.trim() ?? null,
      quantity: Number(quantity),
      unit: unit!.trim(),
      unit_price: unit_price != null ? unit_price : null,
    },
  });

  return formatResponse(res, 201, "Item added successfully", true, { data: item });
});

export const updateItem = expressAsyncHandler(async (req: Request, res: Response) => {
  const rfqId = String(req.params['id']);
  const itemId = String(req.params['itemId']);
  const { product_name, description, quantity, unit, unit_price } = req.body as {
    product_name?: string; description?: string;
    quantity?: number; unit?: string; unit_price?: number;
  };

  const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { status: true } });
  if (!rfq) {
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found.");
  }
  if (rfq.status !== 'DRAFT') {
    return formatResponse(res, 409, "Conflict", false, null, "Items can only be edited on DRAFT RFQs.");
  }

  const item = await prisma.rFQ_Item.findFirst({ where: { id: itemId, rfq_id: rfqId } });
  if (!item) {
    return formatResponse(res, 404, "Not Found", false, null, "Item not found.");
  }

  const data: Record<string, unknown> = {};
  if (product_name !== undefined) data.product_name = product_name.trim();
  if (description !== undefined) data.description = description.trim() || null;
  if (quantity !== undefined) data.quantity = Number(quantity);
  if (unit !== undefined) data.unit = unit.trim();
  if (unit_price !== undefined) data.unit_price = unit_price;

  const updated = await prisma.rFQ_Item.update({ where: { id: itemId }, data });
  return formatResponse(res, 200, "Item updated", true, { data: updated });
});

export const deleteItem = expressAsyncHandler(async (req: Request, res: Response) => {
  const rfqId = String(req.params['id']);
  const itemId = String(req.params['itemId']);

  const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { status: true } });
  if (!rfq) {
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found.");
  }
  if (rfq.status !== 'DRAFT') {
    return formatResponse(res, 409, "Conflict", false, null, "Items can only be removed from DRAFT RFQs.");
  }

  const item = await prisma.rFQ_Item.findFirst({ where: { id: itemId, rfq_id: rfqId } });
  if (!item) {
    return formatResponse(res, 404, "Not Found", false, null, "Item not found.");
  }

  await prisma.rFQ_Item.delete({ where: { id: itemId } });
  return formatResponse(res, 200, "Item removed", true, null);
});

// ─── Vendor Assignment ────────────────────────────────────────────────────────

export const assignVendors = expressAsyncHandler(async (req: Request, res: Response) => {
  const rfqId = String(req.params['id']);
  const { vendor_ids } = req.body as { vendor_ids?: string[] };

  if (!Array.isArray(vendor_ids) || vendor_ids.length === 0) {
    return formatResponse(res, 400, "Validation Error", false, null, "vendor_ids must be a non-empty array.");
  }

  const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { id: true, status: true } });
  if (!rfq) {
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found.");
  }
  if (rfq.status === 'CLOSED') {
    return formatResponse(res, 409, "Conflict", false, null, "Cannot assign vendors to a CLOSED RFQ.");
  }

  const found = await prisma.vendor.count({ where: { id: { in: vendor_ids } } });
  if (found !== vendor_ids.length) {
    return formatResponse(res, 404, "Not Found", false, null, "One or more vendor_ids not found.");
  }

  await prisma.rFQ_Vendor.createMany({
    data: vendor_ids.map((vid) => ({ rfq_id: rfqId, vendor_id: vid })),
    skipDuplicates: true,
  });

  const updated = await prisma.rFQ.findUnique({
    where: { id: rfqId },
    include: { vendors: { include: { vendor: { select: { id: true, name: true, category: true, status: true } } } } },
  });

  return formatResponse(res, 200, "Vendors assigned", true, { data: updated });
});

export const removeVendor = expressAsyncHandler(async (req: Request, res: Response) => {
  const rfqId = String(req.params['id']);
  const vendorId = String(req.params['vendorId']);

  const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { status: true } });
  if (!rfq) {
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found.");
  }
  if (rfq.status === 'CLOSED') {
    return formatResponse(res, 409, "Conflict", false, null, "Cannot modify vendors on a CLOSED RFQ.");
  }

  const link = await prisma.rFQ_Vendor.findUnique({
    where: { rfq_id_vendor_id: { rfq_id: rfqId, vendor_id: vendorId } },
  });
  if (!link) {
    return formatResponse(res, 404, "Not Found", false, null, "Vendor not assigned to this RFQ.");
  }

  await prisma.rFQ_Vendor.delete({
    where: { rfq_id_vendor_id: { rfq_id: rfqId, vendor_id: vendorId } },
  });

  return formatResponse(res, 200, "Vendor removed from RFQ", true, null);
});

// ─── Attachments ──────────────────────────────────────────────────────────────

export const uploadAttachment = expressAsyncHandler(async (req: Request, res: Response) => {
  const rfqId = String(req.params['id']);

  const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { id: true, status: true } });
  if (!rfq) {
    return formatResponse(res, 404, "Not Found", false, null, "RFQ not found.");
  }

  if (!req.file) {
    return formatResponse(res, 400, "Validation Error", false, null, 'No file uploaded. Use field name "file".');
  }

  const uploaded = await uploadBufferToS3({
    prefix: `rfq-attachments/${rfqId}`,
    buffer: req.file.buffer,
    contentType: req.file.mimetype,
    Bucket: S3_PUBLIC_BUCKET || 'public',
  });

  if (!uploaded?.Key) {
    return formatResponse(res, 500, "Server Error", false, null, "Failed to upload attachment to S3.");
  }

  const attachment = await prisma.rFQ_Attachment.create({
    data: {
      rfq_id: rfqId,
      filename: req.file.originalname,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      size_bytes: req.file.size,
      path: uploaded.Key,
    },
  });

  return formatResponse(res, 201, "Attachment uploaded", true, { data: attachment });
});

export const deleteAttachment = expressAsyncHandler(async (req: Request, res: Response) => {
  const rfqId = String(req.params['id']);
  const attachmentId = String(req.params['attachmentId']);

  const attachment = await prisma.rFQ_Attachment.findFirst({
    where: { id: attachmentId, rfq_id: rfqId },
  });
  if (!attachment) {
    return formatResponse(res, 404, "Not Found", false, null, "Attachment not found.");
  }

  await deleteFileFromS3(attachment.path, S3_PUBLIC_BUCKET || 'public');

  await prisma.rFQ_Attachment.delete({ where: { id: attachmentId } });
  return formatResponse(res, 200, "Attachment deleted", true, null);
});

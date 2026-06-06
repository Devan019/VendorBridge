import { Request, Response } from 'express';
import { VendorStatus } from '../generated/prisma/enums';
import prisma from '../utils/prisma';
import expressAsyncHandler from '../utils/expressAsync';
import { formatResponse } from '../utils/formateResponse';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function isValidGST(gst: string): boolean {
  return GST_REGEX.test(gst.toUpperCase());
}

function parseStatus(raw: string | undefined): VendorStatus | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  if (['ACTIVE', 'INACTIVE', 'BLACKLISTED'].includes(upper)) {
    return upper as VendorStatus;
  }
  return undefined;
}

function qs(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return fallback;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export const listVendors = expressAsyncHandler(async (req: Request, res: Response) => {
  const search = qs(req.query.search);
  const status = qs(req.query.status);
  const category = qs(req.query.category);
  const sortBy = qs(req.query.sortBy, 'created_at');
  const order = qs(req.query.order, 'desc');
  const page = qs(req.query.page, '1');
  const limit = qs(req.query.limit, '20');

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const allowedSortFields: Record<string, boolean> = {
    name: true, category: true, status: true, created_at: true, updated_at: true,
  };
  const sortField = allowedSortFields[sortBy] ? sortBy : 'created_at';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  const where: Record<string, unknown> = {};

  if (search.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: 'insensitive' } },
      { contact_email: { contains: search.trim(), mode: 'insensitive' } },
      { gst_number: { contains: search.trim(), mode: 'insensitive' } },
      { category: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }
  if (status) {
    const parsed = parseStatus(status);
    if (parsed) where.status = parsed;
  }
  if (category) {
    where.category = { contains: category, mode: 'insensitive' };
  }

  const [vendors, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: limitNum,
      select: {
        id: true, name: true, category: true, tags: true,
        gst_number: true, contact_email: true, phone: true,
        status: true, created_at: true, updated_at: true,
        _count: { select: { quotations: true, rfqs: true } },
      },
    }),
    prisma.vendor.count({ where }),
  ]);

  const [activeCount, inactiveCount, blacklistedCount] = await Promise.all([
    prisma.vendor.count({ where: { status: 'ACTIVE' } }),
    prisma.vendor.count({ where: { status: 'INACTIVE' } }),
    prisma.vendor.count({ where: { status: 'BLACKLISTED' } }),
  ]);

  const payload = {
    data: vendors,
    pagination: {
      total, page: pageNum, limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
    stats: {
      total: activeCount + inactiveCount + blacklistedCount,
      active: activeCount, inactive: inactiveCount, blacklisted: blacklistedCount,
    },
  };

  return formatResponse(res, 200, "Vendors fetched successfully", true, payload);
});

export const createVendor = expressAsyncHandler(async (req: Request, res: Response) => {
  const {
    name, category, gst_number, contact_email,
    phone, address, tags, status,
  } = req.body as {
    name?: string; category?: string; gst_number?: string;
    contact_email?: string; phone?: string; address?: string;
    tags?: string[]; status?: string;
  };

  const errors: string[] = [];
  if (!name?.trim()) errors.push('name is required.');
  if (!category?.trim()) errors.push('category is required.');
  if (!gst_number?.trim()) errors.push('gst_number is required.');
  else if (!isValidGST(gst_number))
    errors.push('gst_number is not a valid Indian GST number (e.g. 22AAAAA0000A1Z5).');
  if (!contact_email?.trim()) errors.push('contact_email is required.');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))
    errors.push('contact_email is not valid.');

  if (errors.length > 0) { 
    return formatResponse(res, 400, "Validation Error", false, null, errors); 
  }

  const parsedStatus = parseStatus(status) ?? VendorStatus.ACTIVE;

  try {
    const vendor = await prisma.vendor.create({
      data: {
        name: name!.trim(),
        category: category!.trim(),
        gst_number: gst_number!.toUpperCase().trim(),
        contact_email: contact_email!.trim().toLowerCase(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        tags: Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
        status: parsedStatus,
        updated_at: new Date(),
      },
    });

    return formatResponse(res, 201, "Vendor created successfully", true, { data: vendor });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return formatResponse(res, 409, "Conflict Error", false, null, "A vendor with this GST number already exists.");
    }
    throw err;
  }
});

export const getVendor = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      vendorNotes: {
        orderBy: { created_at: 'desc' },
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { quotations: true, rfqs: true } },
    },
  });

  if (!vendor) { 
    return formatResponse(res, 404, "Not Found", false, null, "Vendor not found."); 
  }
  
  return formatResponse(res, 200, "Vendor fetched successfully", true, { data: vendor });
});

export const updateVendor = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const {
    name, category, gst_number, contact_email,
    phone, address, tags, status,
  } = req.body as {
    name?: string; category?: string; gst_number?: string;
    contact_email?: string; phone?: string; address?: string;
    tags?: string[]; status?: string;
  };

  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) { 
    return formatResponse(res, 404, "Not Found", false, null, "Vendor not found."); 
  }

  const errors: string[] = [];
  if (gst_number !== undefined && !isValidGST(gst_number))
    errors.push('gst_number is not a valid Indian GST number.');
  if (contact_email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))
    errors.push('contact_email is not valid.');
  if (status !== undefined && parseStatus(status) === undefined)
    errors.push('status must be ACTIVE, INACTIVE, or BLACKLISTED.');
  
  if (errors.length > 0) { 
    return formatResponse(res, 400, "Validation Error", false, null, errors); 
  }

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (category !== undefined) data.category = category.trim();
  if (gst_number !== undefined) data.gst_number = gst_number.toUpperCase().trim();
  if (contact_email !== undefined) data.contact_email = contact_email.trim().toLowerCase();
  if (phone !== undefined) data.phone = phone.trim() || null;
  if (address !== undefined) data.address = address.trim() || null;
  if (tags !== undefined) data.tags = tags.map((t) => t.trim()).filter(Boolean);
  if (status !== undefined) data.status = parseStatus(status);
  data.updated_at = new Date();

  try {
    const updated = await prisma.vendor.update({ where: { id }, data });
    return formatResponse(res, 200, "Vendor updated successfully", true, { data: updated });
  } catch (err: any) {
    if (err.code === 'P2002') {
      return formatResponse(res, 409, "Conflict Error", false, null, "A vendor with this GST number already exists.");
    }
    throw err;
  }
});

export const deleteVendor = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const hard = qs(req.query.hard) === 'true';

  const existing = await prisma.vendor.findUnique({ where: { id } });
  if (!existing) { 
    return formatResponse(res, 404, "Not Found", false, null, "Vendor not found."); 
  }

  if (hard) {
    await prisma.vendor.delete({ where: { id } });
    return formatResponse(res, 200, "Vendor permanently deleted", true, null);
  } else {
    const updated = await prisma.vendor.update({
      where: { id },
      data: { status: VendorStatus.INACTIVE },
    });
    return formatResponse(res, 200, "Vendor deactivated", true, { data: updated });
  }
});

export const getVendorHistory = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);

  const vendor = await prisma.vendor.findUnique({ where: { id }, select: { id: true } });
  if (!vendor) { 
    return formatResponse(res, 404, "Not Found", false, null, "Vendor not found."); 
  }

  const notes = await prisma.vendorNote.findMany({
    where: { vendor_id: id },
    orderBy: { created_at: 'desc' },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return formatResponse(res, 200, "Vendor history fetched", true, { data: notes });
});

export const addVendorNote = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { content } = req.body as { content?: string };
  const author_id = req.user?.id;

  if (!content?.trim()) { 
    return formatResponse(res, 400, "Validation Error", false, null, "content is required."); 
  }

  const vendor = await prisma.vendor.findUnique({ where: { id }, select: { id: true } });
  if (!vendor) { 
    return formatResponse(res, 404, "Not Found", false, null, "Vendor not found."); 
  }

  const note = await prisma.vendorNote.create({
    data: {
      vendor_id: id,
      content: content.trim(),
      author_id: author_id ?? null,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return formatResponse(res, 201, "Note added successfully", true, { data: note });
});

export const listCategories = expressAsyncHandler(async (_req: Request, res: Response) => {
  const rows = await prisma.vendor.findMany({
    distinct: ['category'],
    select: { category: true },
    orderBy: { category: 'asc' },
  });
  return formatResponse(res, 200, "Categories fetched successfully", true, { data: rows.map((r) => r.category) });
});

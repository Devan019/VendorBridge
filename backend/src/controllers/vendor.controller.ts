import { Request, Response } from 'express';
import { VendorStatus } from '../generated/prisma/enums';
import prisma from '../lib/prisma';

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

/** Express 5 types query values as string | string[] | ParsedQs | ParsedQs[].
 *  This helper always returns a plain string (first value if array). */
function qs(val: unknown, fallback = ''): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && typeof val[0] === 'string') return val[0];
  return fallback;
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/vendors
 * Query params: search, status, category, sortBy, order, page, limit
 */
export async function listVendors(req: Request, res: Response): Promise<void> {
  try {
    const search   = qs(req.query.search);
    const status   = qs(req.query.status);
    const category = qs(req.query.category);
    const sortBy   = qs(req.query.sortBy, 'created_at');
    const order    = qs(req.query.order,  'desc');
    const page     = qs(req.query.page,   '1');
    const limit    = qs(req.query.limit,  '20');

    const pageNum  = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip     = (pageNum - 1) * limitNum;

    const allowedSortFields: Record<string, boolean> = {
      name: true, category: true, status: true, created_at: true, updated_at: true,
    };
    const sortField = allowedSortFields[sortBy] ? sortBy : 'created_at';
    const sortOrder = order === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};

    if (search.trim()) {
      where.OR = [
        { name:          { contains: search.trim(), mode: 'insensitive' } },
        { contact_email: { contains: search.trim(), mode: 'insensitive' } },
        { gst_number:    { contains: search.trim(), mode: 'insensitive' } },
        { category:      { contains: search.trim(), mode: 'insensitive' } },
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

    res.json({
      data: vendors,
      pagination: {
        total, page: pageNum, limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      stats: {
        total: activeCount + inactiveCount + blacklistedCount,
        active: activeCount, inactive: inactiveCount, blacklisted: blacklistedCount,
      },
    });
  } catch (err) {
    console.error('[listVendors]', err);
    res.status(500).json({ error: 'Failed to fetch vendors.' });
  }
}

/**
 * POST /api/vendors
 */
export async function createVendor(req: Request, res: Response): Promise<void> {
  try {
    const {
      name, category, gst_number, contact_email,
      phone, address, tags, status,
    } = req.body as {
      name?: string; category?: string; gst_number?: string;
      contact_email?: string; phone?: string; address?: string;
      tags?: string[]; status?: string;
    };

    const errors: string[] = [];
    if (!name?.trim())          errors.push('name is required.');
    if (!category?.trim())      errors.push('category is required.');
    if (!gst_number?.trim())    errors.push('gst_number is required.');
    else if (!isValidGST(gst_number))
      errors.push('gst_number is not a valid Indian GST number (e.g. 22AAAAA0000A1Z5).');
    if (!contact_email?.trim()) errors.push('contact_email is required.');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))
      errors.push('contact_email is not valid.');

    if (errors.length > 0) { res.status(400).json({ errors }); return; }

    const parsedStatus = parseStatus(status) ?? VendorStatus.ACTIVE;

    const vendor = await prisma.vendor.create({
      data: {
        name:          name!.trim(),
        category:      category!.trim(),
        gst_number:    gst_number!.toUpperCase().trim(),
        contact_email: contact_email!.trim().toLowerCase(),
        phone:    phone?.trim()   || null,
        address:  address?.trim() || null,
        tags:     Array.isArray(tags) ? tags.map((t) => t.trim()).filter(Boolean) : [],
        status:   parsedStatus,
      },
    });

    res.status(201).json({ data: vendor });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'A vendor with this GST number already exists.' });
      return;
    }
    console.error('[createVendor]', err);
    res.status(500).json({ error: 'Failed to create vendor.' });
  }
}

/**
 * GET /api/vendors/:id
 */
export async function getVendor(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);

    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { created_at: 'desc' },
          include: { author: { select: { id: true, name: true, email: true } } },
        },
        _count: { select: { quotations: true, rfqs: true } },
      },
    });

    if (!vendor) { res.status(404).json({ error: 'Vendor not found.' }); return; }
    res.json({ data: vendor });
  } catch (err) {
    console.error('[getVendor]', err);
    res.status(500).json({ error: 'Failed to fetch vendor.' });
  }
}

/**
 * PATCH /api/vendors/:id
 */
export async function updateVendor(req: Request, res: Response): Promise<void> {
  try {
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
    if (!existing) { res.status(404).json({ error: 'Vendor not found.' }); return; }

    const errors: string[] = [];
    if (gst_number !== undefined && !isValidGST(gst_number))
      errors.push('gst_number is not a valid Indian GST number.');
    if (contact_email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))
      errors.push('contact_email is not valid.');
    if (status !== undefined && parseStatus(status) === undefined)
      errors.push('status must be ACTIVE, INACTIVE, or BLACKLISTED.');
    if (errors.length > 0) { res.status(400).json({ errors }); return; }

    const data: Record<string, unknown> = {};
    if (name          !== undefined) data.name          = name.trim();
    if (category      !== undefined) data.category      = category.trim();
    if (gst_number    !== undefined) data.gst_number    = gst_number.toUpperCase().trim();
    if (contact_email !== undefined) data.contact_email = contact_email.trim().toLowerCase();
    if (phone         !== undefined) data.phone         = phone.trim()   || null;
    if (address       !== undefined) data.address       = address.trim() || null;
    if (tags          !== undefined) data.tags          = tags.map((t) => t.trim()).filter(Boolean);
    if (status        !== undefined) data.status        = parseStatus(status);

    const updated = await prisma.vendor.update({ where: { id }, data });
    res.json({ data: updated });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === 'P2002') {
      res.status(409).json({ error: 'A vendor with this GST number already exists.' });
      return;
    }
    console.error('[updateVendor]', err);
    res.status(500).json({ error: 'Failed to update vendor.' });
  }
}

/**
 * DELETE /api/vendors/:id
 * Soft-delete by default (status → INACTIVE). Hard delete via ?hard=true.
 */
export async function deleteVendor(req: Request, res: Response): Promise<void> {
  try {
    const id   = String(req.params['id']);
    const hard = qs(req.query.hard) === 'true';

    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ error: 'Vendor not found.' }); return; }

    if (hard) {
      await prisma.vendor.delete({ where: { id } });
      res.json({ message: 'Vendor permanently deleted.' });
    } else {
      const updated = await prisma.vendor.update({
        where: { id },
        data:  { status: VendorStatus.INACTIVE },
      });
      res.json({ message: 'Vendor deactivated.', data: updated });
    }
  } catch (err) {
    console.error('[deleteVendor]', err);
    res.status(500).json({ error: 'Failed to delete vendor.' });
  }
}

/**
 * GET /api/vendors/:id/history
 */
export async function getVendorHistory(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);

    const vendor = await prisma.vendor.findUnique({ where: { id }, select: { id: true } });
    if (!vendor) { res.status(404).json({ error: 'Vendor not found.' }); return; }

    const notes = await prisma.vendorNote.findMany({
      where:   { vendor_id: id },
      orderBy: { created_at: 'desc' },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    res.json({ data: notes });
  } catch (err) {
    console.error('[getVendorHistory]', err);
    res.status(500).json({ error: 'Failed to fetch vendor history.' });
  }
}

/**
 * POST /api/vendors/:id/notes
 * Body: { content, author_id? }
 */
export async function addVendorNote(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params['id']);
    const { content, author_id } = req.body as { content?: string; author_id?: string };

    if (!content?.trim()) { res.status(400).json({ error: 'content is required.' }); return; }

    const vendor = await prisma.vendor.findUnique({ where: { id }, select: { id: true } });
    if (!vendor) { res.status(404).json({ error: 'Vendor not found.' }); return; }

    const note = await prisma.vendorNote.create({
      data: {
        vendor_id: id,
        content:   content.trim(),
        author_id: author_id ?? null,
      },
      include: { author: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json({ data: note });
  } catch (err) {
    console.error('[addVendorNote]', err);
    res.status(500).json({ error: 'Failed to add note.' });
  }
}

/**
 * GET /api/vendors/categories
 * Returns distinct category values for filter dropdowns.
 */
export async function listCategories(_req: Request, res: Response): Promise<void> {
  try {
    const rows = await prisma.vendor.findMany({
      distinct: ['category'],
      select:   { category: true },
      orderBy:  { category: 'asc' },
    });
    res.json({ data: rows.map((r) => r.category) });
  } catch (err) {
    console.error('[listCategories]', err);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
}

import { z } from "zod";

// ── Create PO manually (or auto-called post-approval) ─────────────────────────
export const createPOSchema = z.object({
  quotation_id: z.string().trim().min(1, "quotation_id is required"),
  created_by:   z.string().trim().min(1, "created_by is required"),
  gst_rate:     z.number().min(0).max(100).optional().default(18),
  notes:        z.string().trim().optional().nullable(),
  terms:        z.string().trim().optional().nullable(),
});

// ── Update PO status ──────────────────────────────────────────────────────────
export const updatePOStatusSchema = z.object({
  status: z.enum(["DRAFT", "ISSUED", "PAID", "OVERDUE", "CANCELLED"]),
});

// ── Create Invoice from PO ────────────────────────────────────────────────────
export const createInvoiceSchema = z.object({
  po_id:    z.string().trim().min(1, "po_id is required"),
  due_date: z.string().optional().nullable(),   // ISO date string, defaults to +30 days
  notes:    z.string().trim().optional().nullable(),
});

// ── Update Invoice status ─────────────────────────────────────────────────────
export const updateInvoiceStatusSchema = z.object({
  status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]),
});

// ── Send invoice email ─────────────────────────────────────────────────────────
export const sendInvoiceEmailSchema = z.object({
  to:      z.string().trim().email("to must be a valid email"),
  subject: z.string().trim().optional(),
  message: z.string().trim().optional(),
});

// ── List query params ─────────────────────────────────────────────────────────
export const listPOQuerySchema = z.object({
  quotation_id: z.string().trim().optional(),
  vendor_id:    z.string().trim().optional(),
  rfq_id:       z.string().trim().optional(),
  status:       z.enum(["DRAFT", "ISSUED", "PAID", "OVERDUE", "CANCELLED"]).optional(),
  page:         z.string().regex(/^\d+$/).optional().default("1"),
  limit:        z.string().regex(/^\d+$/).optional().default("20"),
});

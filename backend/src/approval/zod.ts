import { z } from "zod";

// ── Initiate approval request ──────────────────────────────────────────────────
export const createApprovalSchema = z.object({
  quotation_id: z.string().trim().min(1, "quotation_id is required"),
  approver_id:  z.string().trim().min(1, "approver_id is required"),
  level:        z.number().int().min(1).max(10).optional().default(1),
});

// ── Approve / Reject ───────────────────────────────────────────────────────────
export const decideApprovalSchema = z.object({
  remarks: z.string().trim().min(1, "remarks are mandatory for this action"),
});

// ── Escalate to next level ─────────────────────────────────────────────────────
export const escalateApprovalSchema = z.object({
  next_approver_id: z.string().trim().min(1, "next_approver_id is required"),
  remarks:          z.string().trim().min(1, "remarks are required to escalate"),
});

// ── List query params ──────────────────────────────────────────────────────────
export const listApprovalQuerySchema = z.object({
  quotation_id: z.string().trim().optional(),
  approver_id:  z.string().trim().optional(),
  status:       z.enum(["PENDING", "APPROVED", "REJECTED", "ESCALATED"]).optional(),
  level:        z.string().regex(/^\d+$/).optional(),
  page:         z.string().regex(/^\d+$/).optional().default("1"),
  limit:        z.string().regex(/^\d+$/).optional().default("20"),
});

export type CreateApprovalInput   = z.infer<typeof createApprovalSchema>;
export type DecideApprovalInput   = z.infer<typeof decideApprovalSchema>;
export type EscalateApprovalInput = z.infer<typeof escalateApprovalSchema>;

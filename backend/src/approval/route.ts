import { Router } from "express";
import {
  listApprovals,
  createApproval,
  getApproval,
  approveApproval,
  rejectApproval,
  escalateApproval,
  getApprovalTimeline,
} from "./controller";

const router = Router({ mergeParams: true });

// ── Approval CRUD ─────────────────────────────────────────────────────────────
// GET  /api/approvals              → list with ?quotation_id, approver_id, status, level
// POST /api/approvals              → initiate approval request
// GET  /api/approvals/:id          → single approval detail
// PATCH /api/approvals/:id/approve → approve (body: { remarks })
// PATCH /api/approvals/:id/reject  → reject  (body: { remarks })
// POST  /api/approvals/:id/escalate → escalate (body: { next_approver_id, remarks })
//
// Nested (mounted by app.ts):
// GET /api/quotations/:quotationId/approvals → timeline

router.get("/", listApprovals);
router.post("/", createApproval);

router.get("/:id", getApproval);
router.patch("/:id/approve", approveApproval);
router.patch("/:id/reject", rejectApproval);
router.post("/:id/escalate", escalateApproval);

// Nested timeline route (used when mounted under /api/quotations/:quotationId)
router.get("/quotation/:quotationId", getApprovalTimeline);

export { getApprovalTimeline };
export default router;

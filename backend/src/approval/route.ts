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
import { isAuthenticated, isAuthorized } from "../middleware";

const router = Router({ mergeParams: true });

router.use(isAuthenticated);

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
router.post("/", isAuthorized(['ADMIN', 'PROCUREMENT_OFFICER']), createApproval);

router.get("/:id", getApproval);
router.patch("/:id/approve", isAuthorized(['ADMIN', 'MANAGER']), approveApproval);
router.patch("/:id/reject", isAuthorized(['ADMIN', 'MANAGER']), rejectApproval);
router.post("/:id/escalate", isAuthorized(['ADMIN', 'MANAGER']), escalateApproval);

// Nested timeline route (used when mounted under /api/quotations/:quotationId)
router.get("/quotation/:quotationId", getApprovalTimeline);

export { getApprovalTimeline };
export default router;

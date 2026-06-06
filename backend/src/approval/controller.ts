import { Request, Response } from "express";
import expressAsyncHandler from "../utils/expressAsync";
import { formatResponse } from "../utils/formateResponse";
import { ApprovalStatus, QuotationStatus } from "../generated/prisma/enums";
import prisma from "../lib/prisma";
import {
  createApprovalSchema,
  decideApprovalSchema,
  escalateApprovalSchema,
  listApprovalQuerySchema,
} from "./zod";

// ─── Notification helper ───────────────────────────────────────────────────────

async function notify(
  user_id: string,
  type: string,
  title: string,
  message: string,
  entity_type: string,
  entity_id: string,
) {
  await prisma.notification.create({
    data: { user_id, type, title, message, entity_type, entity_id },
  });
}

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/approvals
 * ?quotation_id, approver_id, status, level, page, limit
 */
export const listApprovals = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const parsed = listApprovalQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return formatResponse(res, 400, "Invalid query", false, null,
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "));
    }
    const { quotation_id, approver_id, status, level, page, limit } = parsed.data;

    const pageNum  = Math.max(1, parseInt(page!, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit!, 10)));

    const where: Record<string, unknown> = {};
    if (quotation_id) where.quotation_id = quotation_id;
    if (approver_id)  where.approver_id  = approver_id;
    if (status)       where.status       = status as ApprovalStatus;
    if (level)        where.level        = parseInt(level, 10);

    const [approvals, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        orderBy: [{ level: "asc" }, { created_at: "asc" }],
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          approver:  { select: { id: true, name: true, email: true, role: true } },
          quotation: {
            select: {
              id: true, status: true, submitted_at: true,
              rfq:    { select: { id: true, reference_number: true, title: true } },
              vendor: { select: { id: true, name: true, category: true } },
            },
          },
        },
      }),
      prisma.approval.count({ where }),
    ]);

    return formatResponse(res, 200, "Approvals fetched", true, {
      data: approvals,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  },
);

/**
 * POST /api/approvals
 * Initiate an approval request for a quotation.
 * Body: { quotation_id, approver_id, level? }
 */
export const createApproval = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const parsed = createApprovalSchema.safeParse(req.body);
    if (!parsed.success) {
      return formatResponse(res, 400, "Validation failed", false, null,
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "));
    }
    const { quotation_id, approver_id, level } = parsed.data;

    // Verify quotation exists and is in a reviewable state
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotation_id },
      include: {
        rfq:    { select: { id: true, reference_number: true, title: true } },
        vendor: { select: { id: true, name: true } },
      },
    });
    if (!quotation) return formatResponse(res, 404, "Quotation not found", false, null);
    if (quotation.status === QuotationStatus.REJECTED) {
      return formatResponse(res, 409, "Cannot request approval for a REJECTED quotation", false, null);
    }

    // Verify approver exists
    const approver = await prisma.user.findUnique({
      where: { id: approver_id },
      select: { id: true, name: true, email: true },
    });
    if (!approver) return formatResponse(res, 404, "Approver user not found", false, null);

    // Guard: no duplicate PENDING approval for the same level on the same quotation
    const duplicate = await prisma.approval.findFirst({
      where: { quotation_id, level, status: ApprovalStatus.PENDING },
    });
    if (duplicate) {
      return formatResponse(res, 409,
        `A PENDING approval already exists for level ${level} on this quotation`, false, null);
    }

    const approval = await prisma.approval.create({
      data: { quotation_id, approver_id, level: level! },
      include: {
        approver:  { select: { id: true, name: true, email: true } },
        quotation: { select: { id: true, status: true, rfq: { select: { reference_number: true, title: true } } } },
      },
    });

    // Notify the assigned approver
    await notify(
      approver_id,
      "APPROVAL_REQUESTED",
      "Approval Requested",
      `You have been assigned to review quotation for RFQ: ${quotation.rfq.title} (${quotation.rfq.reference_number}) — Level ${level}`,
      "Approval",
      approval.id,
    );

    return formatResponse(res, 201, "Approval request created", true, approval);
  },
);

/**
 * GET /api/approvals/:id
 */
export const getApproval = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params["id"]);

    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        approver:  { select: { id: true, name: true, email: true, role: true } },
        quotation: {
          include: {
            rfq:    { select: { id: true, reference_number: true, title: true, deadline: true, status: true } },
            vendor: { select: { id: true, name: true, category: true, gst_number: true } },
            items:  { include: { rfq_item: { select: { product_name: true, quantity: true, unit: true } } } },
          },
        },
      },
    });

    if (!approval) return formatResponse(res, 404, "Approval not found", false, null);
    return formatResponse(res, 200, "Approval fetched", true, approval);
  },
);

/**
 * GET /api/quotations/:quotationId/approvals
 * Full approval timeline for a quotation — sorted by level asc, created_at asc.
 */
export const getApprovalTimeline = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const quotationId = String(req.params["quotationId"]);

    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      select: { id: true, status: true,
        rfq:    { select: { reference_number: true, title: true } },
        vendor: { select: { name: true } },
      },
    });
    if (!quotation) return formatResponse(res, 404, "Quotation not found", false, null);

    const approvals = await prisma.approval.findMany({
      where: { quotation_id: quotationId },
      orderBy: [{ level: "asc" }, { created_at: "asc" }],
      include: {
        approver: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    // Summarise: current level, overall result
    const pendingLevels  = approvals.filter((a) => a.status === "PENDING").map((a) => a.level);
    const currentLevel   = pendingLevels.length > 0 ? Math.min(...pendingLevels) : null;
    const anyRejected    = approvals.some((a) => a.status === "REJECTED");
    const allApproved    = approvals.length > 0 && approvals.every((a) => a.status === "APPROVED");

    return formatResponse(res, 200, "Approval timeline fetched", true, {
      quotation,
      timeline: approvals,
      summary: {
        total_levels:   approvals.length > 0 ? Math.max(...approvals.map((a) => a.level)) : 0,
        current_level:  currentLevel,
        overall_status: anyRejected ? "REJECTED" : allApproved ? "APPROVED" : "PENDING",
      },
    });
  },
);

/**
 * PATCH /api/approvals/:id/approve
 * Body: { remarks }
 */
export const approveApproval = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params["id"]);

    const parsed = decideApprovalSchema.safeParse(req.body);
    if (!parsed.success) {
      return formatResponse(res, 400, "Validation failed", false, null,
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "));
    }
    const { remarks } = parsed.data;

    const existing = await prisma.approval.findUnique({
      where: { id },
      include: {
        quotation: {
          include: {
            rfq:    { select: { id: true, reference_number: true, title: true, created_by: true } },
            vendor: { select: { id: true, name: true } },
          },
        },
        approver: { select: { name: true } },
      },
    });
    if (!existing) return formatResponse(res, 404, "Approval not found", false, null);
    if (existing.status !== "PENDING") {
      return formatResponse(res, 409, `Approval is already ${existing.status}`, false, null);
    }

    const updated = await prisma.approval.update({
      where: { id },
      data: { status: ApprovalStatus.APPROVED, remarks, decided_at: new Date() },
    });

    // Check if there is a next-level PENDING approval on this quotation
    const nextLevel = await prisma.approval.findFirst({
      where: {
        quotation_id: existing.quotation_id,
        level:  existing.level + 1,
        status: ApprovalStatus.PENDING,
      },
      include: { approver: { select: { id: true, name: true } } },
    });

    if (nextLevel) {
      // Notify next-level approver
      await notify(
        nextLevel.approver_id,
        "APPROVAL_REQUESTED",
        "Approval Escalated to You",
        `Level ${existing.level} approved. Your review is needed for RFQ: ${existing.quotation.rfq.title}`,
        "Approval",
        nextLevel.id,
      );
    } else {
      // All levels done — mark quotation ACCEPTED and notify RFQ creator
      await prisma.quotation.update({
        where: { id: existing.quotation_id },
        data:  { status: QuotationStatus.ACCEPTED },
      });
      await notify(
        existing.quotation.rfq.created_by,
        "APPROVED",
        "Quotation Approved",
        `Quotation from ${existing.quotation.vendor.name} for RFQ ${existing.quotation.rfq.reference_number} has been fully approved.`,
        "Quotation",
        existing.quotation_id,
      );
    }

    return formatResponse(res, 200, "Approval approved", true, updated);
  },
);

/**
 * PATCH /api/approvals/:id/reject
 * Body: { remarks }
 */
export const rejectApproval = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params["id"]);

    const parsed = decideApprovalSchema.safeParse(req.body);
    if (!parsed.success) {
      return formatResponse(res, 400, "Validation failed", false, null,
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "));
    }
    const { remarks } = parsed.data;

    const existing = await prisma.approval.findUnique({
      where: { id },
      include: {
        quotation: {
          include: {
            rfq:    { select: { id: true, reference_number: true, title: true, created_by: true } },
            vendor: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!existing) return formatResponse(res, 404, "Approval not found", false, null);
    if (existing.status !== "PENDING") {
      return formatResponse(res, 409, `Approval is already ${existing.status}`, false, null);
    }

    await prisma.$transaction(async (tx) => {
      // Mark this approval as rejected
      await tx.approval.update({
        where: { id },
        data: { status: ApprovalStatus.REJECTED, remarks, decided_at: new Date() },
      });

      // Cancel any pending higher-level approvals on the same quotation
      await tx.approval.updateMany({
        where: {
          quotation_id: existing.quotation_id,
          level:  { gt: existing.level },
          status: ApprovalStatus.PENDING,
        },
        data: { status: ApprovalStatus.REJECTED, remarks: "Cancelled due to rejection at lower level" },
      });

      // Mark quotation REJECTED
      await tx.quotation.update({
        where: { id: existing.quotation_id },
        data:  { status: QuotationStatus.REJECTED },
      });
    });

    // Notify RFQ creator
    await notify(
      existing.quotation.rfq.created_by,
      "REJECTED",
      "Quotation Rejected",
      `Quotation from ${existing.quotation.vendor.name} for RFQ ${existing.quotation.rfq.reference_number} was rejected at level ${existing.level}. Reason: ${remarks}`,
      "Quotation",
      existing.quotation_id,
    );

    const updated = await prisma.approval.findUnique({ where: { id } });
    return formatResponse(res, 200, "Approval rejected", true, updated);
  },
);

/**
 * POST /api/approvals/:id/escalate
 * Mark current approval as ESCALATED and create a new one at the next level.
 * Body: { next_approver_id, remarks }
 */
export const escalateApproval = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params["id"]);

    const parsed = escalateApprovalSchema.safeParse(req.body);
    if (!parsed.success) {
      return formatResponse(res, 400, "Validation failed", false, null,
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "));
    }
    const { next_approver_id, remarks } = parsed.data;

    const existing = await prisma.approval.findUnique({
      where: { id },
      include: {
        quotation: {
          include: {
            rfq: { select: { reference_number: true, title: true } },
          },
        },
      },
    });
    if (!existing) return formatResponse(res, 404, "Approval not found", false, null);
    if (existing.status !== "PENDING") {
      return formatResponse(res, 409, `Only PENDING approvals can be escalated`, false, null);
    }

    // Verify next approver exists
    const nextApprover = await prisma.user.findUnique({
      where: { id: next_approver_id },
      select: { id: true, name: true },
    });
    if (!nextApprover) return formatResponse(res, 404, "Next approver user not found", false, null);

    const nextLevel = existing.level + 1;

    const [escalated, nextApproval] = await prisma.$transaction([
      // Mark current as ESCALATED
      prisma.approval.update({
        where: { id },
        data: { status: ApprovalStatus.ESCALATED, remarks, decided_at: new Date() },
      }),
      // Create next-level approval
      prisma.approval.create({
        data: {
          quotation_id: existing.quotation_id,
          approver_id:  next_approver_id,
          level:        nextLevel,
          status:       ApprovalStatus.PENDING,
        },
      }),
    ]);

    // Notify next approver
    await notify(
      next_approver_id,
      "ESCALATED",
      "Approval Escalated to You",
      `An approval has been escalated to you at level ${nextLevel} for RFQ: ${existing.quotation.rfq.title} (${existing.quotation.rfq.reference_number})`,
      "Approval",
      nextApproval.id,
    );

    return formatResponse(res, 200, "Approval escalated", true, { escalated, next_approval: nextApproval });
  },
);

import { Request, Response } from "express";
import expressAsyncHandler from "../utils/expressAsync";
import { formatResponse } from "../utils/formateResponse";
import { comparisonQuerySchema, selectQuotationSchema } from "./zod";
import prisma from "../lib/prisma";
import { QuotationStatus } from "../generated/prisma/enums";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LineItemComparison {
  rfq_item_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  budget_unit_price: string | null; // from RFQ_Item.unit_price
  vendors: Array<{
    quotation_id: string;
    vendor_id: string;
    vendor_name: string;
    unit_price: string;
    total_price: string;       // unit_price × quantity
    delivery_days: number;
    notes: string | null;
    is_lowest_price: boolean;
    is_fastest_delivery: boolean;
  }>;
}

interface VendorSummary {
  quotation_id: string;
  vendor_id: string;
  vendor_name: string;
  vendor_category: string;
  vendor_gst: string;
  status: string;
  submitted_at: Date;
  notes: string | null;
  total_price: number;          // sum of (unit_price × quantity) across all items
  avg_unit_price: number;
  max_delivery_days: number;
  items_count: number;
  approval_count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const toNum = (d: { toString(): string } | null | undefined): number =>
  d == null ? 0 : Number(d.toString());

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/rfqs/:rfqId/compare
 * Returns a full side-by-side comparison of all quotations for an RFQ.
 *
 * Response shape:
 * {
 *   rfq: { ... },
 *   vendors: VendorSummary[],          ← sortable summary row per vendor
 *   line_items: LineItemComparison[],  ← per-item breakdown across vendors
 *   highlights: {
 *     lowest_total_price: { quotation_id, vendor_name, amount },
 *     fastest_delivery:   { quotation_id, vendor_name, days },
 *   }
 * }
 */
export const compareQuotations = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const rfqId = String(req.params["rfqId"]);

    // ── Parse & validate query ────────────────────────────────────────────────
    const parsed = comparisonQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return formatResponse(res, 400, "Invalid query parameters", false, null,
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "));
    }
    const { sortBy, order, status } = parsed.data;

    // ── Fetch RFQ ─────────────────────────────────────────────────────────────
    const rfq = await prisma.rFQ.findUnique({
      where: { id: rfqId },
      include: {
        items: {
          orderBy: { product_name: "asc" },
          select: {
            id: true,
            product_name: true,
            quantity: true,
            unit: true,
            unit_price: true,
            description: true,
          },
        },
        creator: { select: { id: true, name: true, email: true } },
        _count: { select: { vendors: true, quotations: true } },
      },
    });

    if (!rfq) {
      return formatResponse(res, 404, "RFQ not found", false, null);
    }

    // ── Fetch all quotations for this RFQ ──────────────────────────────────────
    const quotationWhere: Record<string, unknown> = { rfq_id: rfqId };
    if (status) quotationWhere.status = status;

    const quotations = await prisma.quotation.findMany({
      where: quotationWhere,
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            category: true,
            gst_number: true,
            contact_email: true,
            phone: true,
            status: true,
          },
        },
        items: {
          include: {
            rfq_item: {
              select: { id: true, product_name: true, quantity: true, unit: true, unit_price: true },
            },
          },
        },
        approvals: { select: { id: true, status: true, remarks: true, decided_at: true } },
        _count: { select: { approvals: true } },
      },
    });

    if (quotations.length === 0) {
      return formatResponse(res, 200, "No quotations found for this RFQ", true, {
        rfq: { id: rfq.id, reference_number: rfq.reference_number, title: rfq.title, status: rfq.status },
        vendors: [],
        line_items: [],
        highlights: null,
      });
    }

    // ── Build VendorSummary[] ─────────────────────────────────────────────────
    const vendorSummaries: VendorSummary[] = quotations.map((q) => {
      let totalPrice = 0;
      let totalUnitPrice = 0;
      let maxDeliveryDays = 0;

      for (const item of q.items) {
        const qty = item.rfq_item.quantity;
        const unitPrice = toNum(item.unit_price);
        totalPrice += unitPrice * qty;
        totalUnitPrice += unitPrice;
        if (item.delivery_days > maxDeliveryDays) maxDeliveryDays = item.delivery_days;
      }

      const avgUnitPrice = q.items.length > 0 ? totalUnitPrice / q.items.length : 0;

      return {
        quotation_id:      q.id,
        vendor_id:         q.vendor.id,
        vendor_name:       q.vendor.name,
        vendor_category:   q.vendor.category,
        vendor_gst:        q.vendor.gst_number,
        status:            q.status,
        submitted_at:      q.submitted_at,
        notes:             q.notes,
        total_price:       Number(totalPrice.toFixed(2)),
        avg_unit_price:    Number(avgUnitPrice.toFixed(2)),
        max_delivery_days: maxDeliveryDays,
        items_count:       q.items.length,
        approval_count:    q._count.approvals,
      };
    });

    // ── Sort vendor summaries ─────────────────────────────────────────────────
    const sortedSummaries = [...vendorSummaries].sort((a, b) => {
      let diff = 0;
      switch (sortBy) {
        case "total_price":      diff = a.total_price      - b.total_price;      break;
        case "avg_unit_price":   diff = a.avg_unit_price   - b.avg_unit_price;   break;
        case "max_delivery_days":diff = a.max_delivery_days- b.max_delivery_days;break;
        case "vendor_name":      diff = a.vendor_name.localeCompare(b.vendor_name); break;
        case "submitted_at":     diff = a.submitted_at.getTime() - b.submitted_at.getTime(); break;
        default:                 diff = a.total_price - b.total_price;
      }
      return order === "asc" ? diff : -diff;
    });

    // ── Build LineItemComparison[] ─────────────────────────────────────────────
    const lineItems: LineItemComparison[] = rfq.items.map((rfqItem) => {
      // Collect all vendor bids for this line item
      const vendorBids = quotations
        .map((q) => {
          const qi = q.items.find((i) => i.rfq_item_id === rfqItem.id);
          if (!qi) return null;
          const unitPrice = toNum(qi.unit_price);
          const totalPrice = unitPrice * rfqItem.quantity;
          return {
            quotation_id:   q.id,
            vendor_id:      q.vendor.id,
            vendor_name:    q.vendor.name,
            unit_price:     unitPrice.toFixed(2),
            total_price:    totalPrice.toFixed(2),
            delivery_days:  qi.delivery_days,
            notes:          qi.notes,
            _unitPrice:     unitPrice,
            _deliveryDays:  qi.delivery_days,
          };
        })
        .filter((b): b is NonNullable<typeof b> => b !== null);

      // Find best values for highlighting
      const lowestUnitPrice   = Math.min(...vendorBids.map((b) => b._unitPrice));
      const fastestDelivery   = Math.min(...vendorBids.map((b) => b._deliveryDays));

      return {
        rfq_item_id:        rfqItem.id,
        product_name:       rfqItem.product_name,
        quantity:           rfqItem.quantity,
        unit:               rfqItem.unit,
        budget_unit_price:  rfqItem.unit_price ? toNum(rfqItem.unit_price).toFixed(2) : null,
        vendors: vendorBids.map(({ _unitPrice, _deliveryDays, ...b }) => ({
          ...b,
          is_lowest_price:      _unitPrice === lowestUnitPrice,
          is_fastest_delivery:  _deliveryDays === fastestDelivery,
        })),
      };
    });

    // ── Global highlights ──────────────────────────────────────────────────────
    const lowestTotal   = sortedSummaries.reduce((min, s) =>
      s.total_price < min.total_price ? s : min, sortedSummaries[0]);
    const fastestVendor = sortedSummaries.reduce((min, s) =>
      s.max_delivery_days < min.max_delivery_days ? s : min, sortedSummaries[0]);

    const highlights = {
      lowest_total_price: {
        quotation_id: lowestTotal.quotation_id,
        vendor_name:  lowestTotal.vendor_name,
        amount:       lowestTotal.total_price,
      },
      fastest_delivery: {
        quotation_id: fastestVendor.quotation_id,
        vendor_name:  fastestVendor.vendor_name,
        days:         fastestVendor.max_delivery_days,
      },
    };

    return formatResponse(res, 200, "Comparison fetched successfully", true, {
      rfq: {
        id:               rfq.id,
        reference_number: rfq.reference_number,
        title:            rfq.title,
        description:      rfq.description,
        deadline:         rfq.deadline,
        status:           rfq.status,
        creator:          rfq.creator,
        total_items:      rfq.items.length,
        total_vendors:    rfq._count.vendors,
        total_quotations: rfq._count.quotations,
      },
      vendors:    sortedSummaries,
      line_items: lineItems,
      highlights,
    });
  }
);

/**
 * POST /api/rfqs/:rfqId/compare/select
 * One-click: accept one quotation, reject all others for this RFQ.
 *
 * Body: { quotation_id, approver_id, remarks? }
 */
export const selectQuotation = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const rfqId = String(req.params["rfqId"]);

    // ── Validate body ────────────────────────────────────────────────────────
    const parsed = selectQuotationSchema.safeParse(req.body);
    if (!parsed.success) {
      return formatResponse(res, 400, "Validation failed", false, null,
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "));
    }
    const { quotation_id, approver_id, remarks } = parsed.data;

    // ── Verify RFQ ──────────────────────────────────────────────────────────
    const rfq = await prisma.rFQ.findUnique({ where: { id: rfqId }, select: { id: true, status: true } });
    if (!rfq) return formatResponse(res, 404, "RFQ not found", false, null);
    if (rfq.status === "DRAFT") {
      return formatResponse(res, 409, "Cannot select a quotation on a DRAFT RFQ", false, null);
    }

    // ── Verify target quotation belongs to this RFQ ──────────────────────────
    const target = await prisma.quotation.findFirst({
      where: { id: quotation_id, rfq_id: rfqId },
      select: { id: true, status: true },
    });
    if (!target) {
      return formatResponse(res, 404, "Quotation not found on this RFQ", false, null);
    }
    if (target.status === QuotationStatus.REJECTED) {
      return formatResponse(res, 409, "Cannot select a REJECTED quotation", false, null);
    }

    // ── Verify approver ──────────────────────────────────────────────────────
    const approver = await prisma.user.findUnique({
      where: { id: approver_id },
      select: { id: true },
    });
    if (!approver) return formatResponse(res, 404, "Approver user not found", false, null);

    // ── All sibling quotations on this RFQ ───────────────────────────────────
    const siblings = await prisma.quotation.findMany({
      where: { rfq_id: rfqId },
      select: { id: true, status: true },
    });

    // ── Atomic transaction: accept selected, reject others ───────────────────
    await prisma.$transaction(async (tx) => {
      for (const sibling of siblings) {
        if (sibling.id === quotation_id) {
          // Accept selected quotation
          await tx.quotation.update({
            where: { id: sibling.id },
            data:  { status: QuotationStatus.ACCEPTED },
          });
          await tx.approval.create({
            data: {
              quotation_id: sibling.id,
              approver_id,
              status:  QuotationStatus.ACCEPTED,
              remarks: remarks ?? null,
            },
          });
        } else if (
          sibling.status !== QuotationStatus.ACCEPTED &&
          sibling.status !== QuotationStatus.REJECTED
        ) {
          // Reject all other non-terminal quotations
          await tx.quotation.update({
            where: { id: sibling.id },
            data:  { status: QuotationStatus.REJECTED },
          });
          await tx.approval.create({
            data: {
              quotation_id: sibling.id,
              approver_id,
              status:  QuotationStatus.REJECTED,
              remarks: "Not selected during comparison",
            },
          });
        }
      }
    });

    // ── Return the accepted quotation with full details ─────────────────────
    const accepted = await prisma.quotation.findUnique({
      where: { id: quotation_id },
      include: {
        vendor: { select: { id: true, name: true, category: true, gst_number: true } },
        rfq:    { select: { id: true, reference_number: true, title: true } },
        items:  { include: { rfq_item: { select: { product_name: true, quantity: true, unit: true } } } },
      },
    });

    return formatResponse(res, 200, "Quotation accepted and others rejected", true, accepted);
  }
);

import { z } from "zod";

export const comparisonQuerySchema = z.object({
  sortBy: z
    .enum(["total_price", "avg_unit_price", "max_delivery_days", "vendor_name", "submitted_at"])
    .optional()
    .default("total_price"),
  order: z.enum(["asc", "desc"]).optional().default("asc"),
  status: z
    .enum(["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED"])
    .optional(),
});

export const selectQuotationSchema = z.object({
  quotation_id: z.string().trim().min(1, "quotation_id is required"),
  approver_id: z.string().trim().min(1, "approver_id is required"),
  remarks: z.string().trim().optional().nullable(),
});

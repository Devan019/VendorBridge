import { z } from "zod";

export const quotationStatusSchema = z.enum(["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "REJECTED"]);

export const createQuotationSchema = z.object({
  rfq_id: z.string().trim().min(1, "rfq_id is required"),
  vendor_id: z.string().trim().min(1, "vendor_id is required"),
  status: quotationStatusSchema.optional(),
});
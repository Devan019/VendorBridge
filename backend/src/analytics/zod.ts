import { z } from "zod";

export const dateRangeQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export const vendorPerformanceQuerySchema = z.object({
  vendor_id: z.string().trim().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export const exportAnalyticsQuerySchema = z.object({
  type: z.enum(["procurement", "vendors", "spending", "trends"]),
  format: z.enum(["csv", "pdf"]).optional().default("csv"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  vendor_id: z.string().trim().optional(),
});

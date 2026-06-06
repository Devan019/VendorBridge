import { z } from "zod";

export const rfqStatusSchema = z.enum(["DRAFT", "SENT", "CLOSED"]);

export const rfqItemSchema = z.object({
  product_name: z.string().trim().min(1, "product_name is required"),
  description: z.string().trim().optional().nullable(),
  quantity: z.number().int().positive(),
  unit: z.string().trim().min(1, "unit is required"),
  unit_price: z.number().optional().nullable(),
});

export const createRFQSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  description: z.string().trim().min(1, "description is required"),
  deadline: z.string().min(1, "deadline is required"),
  created_by: z.string().trim().min(1, "created_by is required"),
  items: z.array(rfqItemSchema).optional(),
  vendor_ids: z.array(z.string().trim()).optional(),
  status: rfqStatusSchema.optional(),
});
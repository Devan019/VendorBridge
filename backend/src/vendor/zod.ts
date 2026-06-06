import { z } from "zod";

export const vendorStatusSchema = z.enum(["ACTIVE", "INACTIVE", "BLACKLISTED"]);

export const createVendorSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  category: z.string().trim().min(1, "category is required"),
  gst_number: z.string().trim().min(1, "gst_number is required"),
  contact_email: z.string().trim().email("contact_email is invalid"),
  phone: z.string().trim().optional().nullable(),
  address: z.string().trim().optional().nullable(),
  tags: z.array(z.string().trim()).optional(),
  status: vendorStatusSchema.optional(),
});

export const updateVendorSchema = createVendorSchema.partial();
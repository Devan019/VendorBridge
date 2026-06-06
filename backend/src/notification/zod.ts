import { z } from "zod";

export const listNotificationQuerySchema = z.object({
  user_id:     z.string().trim().min(1, "user_id is required"),
  type:        z.string().trim().optional(),
  read:        z.enum(["true", "false"]).optional(),
  entity_type: z.string().trim().optional(),
  page:        z.string().regex(/^\d+$/).optional().default("1"),
  limit:       z.string().regex(/^\d+$/).optional().default("30"),
});

export const createNotificationSchema = z.object({
  user_id: z.string().trim().min(1, "user_id is required"),
  type: z.string().trim().optional().default("INFO"),
  title: z.string().trim().min(1, "title is required"),
  message: z.string().trim().min(1, "message is required"),
  entity_type: z.string().trim().optional(),
  entity_id: z.string().trim().optional(),
});

export const listLogsQuerySchema = z.object({
  entity_type: z.string().trim().optional(),
  entity_id: z.string().trim().optional(),
  performed_by: z.string().trim().optional(),
  action: z.string().trim().optional(),
  page: z.string().regex(/^\d+$/).optional().default("1"),
  limit: z.string().regex(/^\d+$/).optional().default("30"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export const exportLogsQuerySchema = z.object({
  entity_type: z.string().trim().optional(),
  entity_id: z.string().trim().optional(),
  performed_by: z.string().trim().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  format: z.enum(["csv", "json"]).optional().default("csv"),
});

import { z } from "zod";

export const listNotificationQuerySchema = z.object({
  user_id:     z.string().trim().min(1, "user_id is required"),
  type:        z.string().trim().optional(),
  read:        z.enum(["true", "false"]).optional(),
  entity_type: z.string().trim().optional(),
  page:        z.string().regex(/^\d+$/).optional().default("1"),
  limit:       z.string().regex(/^\d+$/).optional().default("30"),
});

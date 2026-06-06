import { Request, Response } from "express";
import expressAsyncHandler from "../utils/expressAsync";
import { formatResponse } from "../utils/formateResponse";
import prisma from "../lib/prisma";
import { listNotificationQuerySchema } from "./zod";

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/notifications
 * ?user_id (required), type, read, entity_type, page, limit
 */
export const listNotifications = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const parsed = listNotificationQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return formatResponse(res, 400, "Invalid query", false, null,
        parsed.error.issues.map((e: { message: string }) => e.message).join(", "));
    }
    const { user_id, type, read, entity_type, page, limit } = parsed.data;

    const pageNum  = Math.max(1, parseInt(page!, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit!, 10)));

    const where: Record<string, unknown> = { user_id };
    if (type)        where.type        = type;
    if (entity_type) where.entity_type = entity_type;
    if (read !== undefined) where.read = read === "true";

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip:  (pageNum - 1) * limitNum,
        take:  limitNum,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { user_id, read: false } }),
    ]);

    return formatResponse(res, 200, "Notifications fetched", true, {
      data: notifications,
      unread_count: unreadCount,
      pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  },
);

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read.
 */
export const markAsRead = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params["id"]);

    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) return formatResponse(res, 404, "Notification not found", false, null);

    const updated = await prisma.notification.update({
      where: { id },
      data:  { read: true },
    });

    return formatResponse(res, 200, "Notification marked as read", true, updated);
  },
);

/**
 * PATCH /api/notifications/read-all
 * Mark ALL notifications for a user as read.
 * Body or query: { user_id }
 */
export const markAllAsRead = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user_id = String(req.body?.user_id ?? req.query?.user_id ?? "");
    if (!user_id.trim()) {
      return formatResponse(res, 400, "user_id is required", false, null);
    }

    const user = await prisma.user.findUnique({ where: { id: user_id }, select: { id: true } });
    if (!user) return formatResponse(res, 404, "User not found", false, null);

    const { count } = await prisma.notification.updateMany({
      where: { user_id, read: false },
      data:  { read: true },
    });

    return formatResponse(res, 200, `${count} notification(s) marked as read`, true, { count });
  },
);

/**
 * DELETE /api/notifications/:id
 * Delete a single notification.
 */
export const deleteNotification = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const id = String(req.params["id"]);

    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) return formatResponse(res, 404, "Notification not found", false, null);

    await prisma.notification.delete({ where: { id } });
    return formatResponse(res, 200, "Notification deleted", true, null);
  },
);

/**
 * DELETE /api/notifications
 * Delete all read notifications for a user.
 * Body or query: { user_id }
 */
export const clearReadNotifications = expressAsyncHandler(
  async (req: Request, res: Response) => {
    const user_id = String(req.body?.user_id ?? req.query?.user_id ?? "");
    if (!user_id.trim()) {
      return formatResponse(res, 400, "user_id is required", false, null);
    }

    const { count } = await prisma.notification.deleteMany({
      where: { user_id, read: true },
    });

    return formatResponse(res, 200, `${count} read notification(s) cleared`, true, { count });
  },
);

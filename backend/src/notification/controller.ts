import { Request, Response } from "express";
import expressAsyncHandler from "../utils/expressAsync";
import { formatResponse } from "../utils/formateResponse";
import prisma from "../utils/prisma";
import { listNotificationQuerySchema, listLogsQuerySchema, exportLogsQuerySchema } from "./zod";

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

// ─── Activity Logs Controllers ───────────────────────────────────────────────

export const listLogs = expressAsyncHandler(async (req: Request, res: Response) => {
  const parsed = listLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return formatResponse(
      res,
      400,
      "Invalid query",
      false,
      null,
      parsed.error.issues.map((e: { message: string }) => e.message).join(", ")
    );
  }

  const { entity_type, entity_id, performed_by, action, page, limit, start_date, end_date } = parsed.data;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const where: any = {};
  if (entity_type) where.entity_type = entity_type;
  if (entity_id) where.entity_id = entity_id;
  if (performed_by) where.performed_by = performed_by;
  if (action) where.action = action;

  if (start_date || end_date) {
    where.timestamp = {};
    if (start_date) where.timestamp.gte = new Date(start_date);
    if (end_date) where.timestamp.lte = new Date(end_date);
  }

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return formatResponse(res, 200, "Activity logs fetched", true, {
    data: logs,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

export const exportLogs = expressAsyncHandler(async (req: Request, res: Response) => {
  const parsed = exportLogsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return formatResponse(
      res,
      400,
      "Invalid query",
      false,
      null,
      parsed.error.issues.map((e: { message: string }) => e.message).join(", ")
    );
  }

  const { entity_type, entity_id, performed_by, start_date, end_date, format } = parsed.data;

  const where: any = {};
  if (entity_type) where.entity_type = entity_type;
  if (entity_id) where.entity_id = entity_id;
  if (performed_by) where.performed_by = performed_by;

  if (start_date || end_date) {
    where.timestamp = {};
    if (start_date) where.timestamp.gte = new Date(start_date);
    if (end_date) where.timestamp.lte = new Date(end_date);
  }

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    include: {
      user: { select: { name: true, email: true } },
    },
  });

  if (format === "csv") {
    let csv = "ID,Entity Type,Entity ID,Action,Performed By,Email,Timestamp\n";
    logs.forEach((log) => {
      csv += `${log.id},${log.entity_type},${log.entity_id},${log.action},"${log.user?.name || "System"}","${log.user?.email || ""}","${log.timestamp.toISOString()}"\n`;
    });
    
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=activity_logs.csv");
    res.send(csv);
  } else {
    // JSON
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", "attachment; filename=activity_logs.json");
    return formatResponse(res, 200, "Activity logs exported", true, { data: logs });
  }
});

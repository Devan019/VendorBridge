import { Router } from "express";
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  listLogs,
  exportLogs,
} from "./controller";

const router = Router();
const logRouter = Router();

// GET    /api/notifications              ?user_id, type, read, entity_type, page, limit
// PATCH  /api/notifications/read-all     mark all read for a user
// DELETE /api/notifications              clear all read notifications for a user
// PATCH  /api/notifications/:id/read     mark single as read
// DELETE /api/notifications/:id          delete single

router.get("/", listNotifications);
router.patch("/read-all", markAllAsRead);     // must be BEFORE /:id routes
router.delete("/", clearReadNotifications);

router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

// ── Activity Logs Routes ──────────────────────────────────────────────────────

logRouter.get("/", listLogs);
logRouter.get("/export", exportLogs);

export { router as default, logRouter };

import { Router } from "express";
import { isAuthenticated, isAuthorized } from "../middleware";
import { UserRole } from "../generated/prisma/enums";
import {
  getProcurementStats,
  getVendorPerformance,
  getSpendingSummaries,
  getMonthlyTrends,
  exportAnalytics,
} from "./controller";

const router = Router();

// Only ADMIN, MANAGER, and PROCUREMENT_OFFICER can access analytics
router.use(isAuthenticated);
router.use(isAuthorized([UserRole.ADMIN, UserRole.MANAGER, UserRole.PROCUREMENT_OFFICER]));

router.get("/procurement", getProcurementStats);
router.get("/vendors", getVendorPerformance);
router.get("/spending", getSpendingSummaries);
router.get("/trends", getMonthlyTrends);
router.get("/export", exportAnalytics);

export default router;

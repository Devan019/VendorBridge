import { Router } from "express";
import { compareQuotations, selectQuotation } from "./controller";
import { isAuthenticated, isAuthorized } from "../middleware";

const router = Router({ mergeParams: true }); // inherits :rfqId from parent

router.use(isAuthenticated);

// GET  /api/rfqs/:rfqId/compare          → side-by-side comparison matrix
// POST /api/rfqs/:rfqId/compare/select   → accept one, reject all others
router.get("/", isAuthorized(['ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER']), compareQuotations);
router.post("/select", isAuthorized(['ADMIN', 'PROCUREMENT_OFFICER']), selectQuotation);

export default router;

import { Router } from "express";
import { compareQuotations, selectQuotation } from "./controller";

const router = Router({ mergeParams: true }); // inherits :rfqId from parent

// GET  /api/rfqs/:rfqId/compare          → side-by-side comparison matrix
// POST /api/rfqs/:rfqId/compare/select   → accept one, reject all others
router.get("/", compareQuotations);
router.post("/select", selectQuotation);

export default router;

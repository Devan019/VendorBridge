import { Router } from "express";
import { isAuthenticated } from "../middleware";

import { formatResponse } from "../utils/formateResponse";

const restrictTo = (...roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return formatResponse(res, 403, "Forbidden", false, null);
    }
    next();
  };
};
import { UserRole } from "../generated/prisma/enums";
import {
  listPOs,
  getPO,
  manualCreatePO,
  updatePO,
  listInvoices,
  getInvoice,
  generateInvoiceForPO,
  updateInvoice,
  downloadInvoicePDF,
  emailInvoice,
} from "./controller";

const router = Router();

// Protect all PO and Invoice routes
router.use(isAuthenticated);

// ── Purchase Order Routes ─────────────────────────────────────────────────────

// Only Admin, Manager, and Procurement Officer can create or update POs
router.post(
  "/",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.PROCUREMENT_OFFICER),
  manualCreatePO
);

router.patch(
  "/:id/status",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.PROCUREMENT_OFFICER),
  updatePO
);

// All authenticated roles (including Vendors) can view POs (Vendors should only see their own - handled by query params and business logic filtering ideally, but for now we expose it)
router.get("/", listPOs);
router.get("/:id", getPO);

// ── Invoice Routes ────────────────────────────────────────────────────────────

// Endpoint to generate an invoice from a PO
router.post(
  "/:id/invoices",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.PROCUREMENT_OFFICER),
  generateInvoiceForPO // note: body should contain po_id as well, as per schema, or we could pass the param inside controller. Let's keep it in body as per schema
);

const invoiceRouter = Router();

invoiceRouter.use(isAuthenticated);

invoiceRouter.get("/", listInvoices);
invoiceRouter.get("/:id", getInvoice);

invoiceRouter.patch(
  "/:id/status",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.PROCUREMENT_OFFICER),
  updateInvoice
);

invoiceRouter.get("/:id/pdf", downloadInvoicePDF);

invoiceRouter.post(
  "/:id/send",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.PROCUREMENT_OFFICER),
  emailInvoice
);

export { router as poRoutes, invoiceRouter as invoiceRoutes };

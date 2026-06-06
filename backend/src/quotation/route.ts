import { Router } from 'express';
import {
  listQuotations,
  createQuotation,
  getQuotation,
  updateQuotation,
  confirmSubmission,
  updateQuotationStatus,
  deleteQuotation,
  listRFQQuotations,
} from './controller';
import { isAuthenticated, isAuthorized } from '../middleware';

const router = Router({ mergeParams: true }); // mergeParams for /rfqs/:rfqId/quotations

router.use(isAuthenticated);

// ── Quotation endpoints ───────────────────────────────────────────────────────
// GET    /api/quotations                    → list with ?rfq_id, vendor_id, status
// POST   /api/quotations                    → vendor submits a new quotation
// GET    /api/quotations/:id                → full quotation detail
// PATCH  /api/quotations/:id                → vendor edits (SUBMITTED + before deadline)
// POST   /api/quotations/:id/submit         → vendor confirms/re-confirms submission
// PATCH  /api/quotations/:id/status         → reviewer moves status forward
// DELETE /api/quotations/:id                → vendor withdraws (SUBMITTED + before deadline)
//
// Nested under RFQ router:
// GET    /api/rfqs/:rfqId/quotations        → all quotations for an RFQ

router.get('/', listQuotations);
router.post('/', isAuthorized(['VENDOR']), createQuotation);

router.get('/:id', getQuotation);
router.patch('/:id', isAuthorized(['VENDOR']), updateQuotation);
router.post('/:id/submit', isAuthorized(['VENDOR']), confirmSubmission);
router.patch('/:id/status', isAuthorized(['ADMIN', 'PROCUREMENT_OFFICER', 'MANAGER']), updateQuotationStatus);
router.delete('/:id', isAuthorized(['VENDOR']), deleteQuotation);

// Nested route (used when mounted under /api/rfqs/:rfqId)
router.get('/rfq/:rfqId', listRFQQuotations);

export { listRFQQuotations };
export default router;

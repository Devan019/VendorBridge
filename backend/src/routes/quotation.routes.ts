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
} from '../controllers/quotation.controller';

const router = Router({ mergeParams: true }); // mergeParams for /rfqs/:rfqId/quotations

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
router.post('/', createQuotation);

router.get('/:id', getQuotation);
router.patch('/:id', updateQuotation);
router.post('/:id/submit', confirmSubmission);
router.patch('/:id/status', updateQuotationStatus);
router.delete('/:id', deleteQuotation);

// Nested route (used when mounted under /api/rfqs/:rfqId)
router.get('/rfq/:rfqId', listRFQQuotations);

export { listRFQQuotations };
export default router;

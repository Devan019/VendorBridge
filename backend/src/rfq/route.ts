import { Router } from 'express';
import {
  listRFQs,
  createRFQ,
  getRFQ,
  updateRFQ,
  updateRFQStatus,
  deleteRFQ,
  addItem,
  updateItem,
  deleteItem,
  assignVendors,
  removeVendor,
  uploadAttachment,
  deleteAttachment,
} from './controller';
import { rfqUpload } from '../utils/upload';
import { isAuthenticated } from '../middleware';

const router = Router();

router.use(isAuthenticated);

// ── RFQ CRUD ──────────────────────────────────────────────────────────────────
// GET    /api/rfqs                          → list with search / filter / sort
// POST   /api/rfqs                          → create RFQ (with items + vendors)
// GET    /api/rfqs/:id                      → full RFQ profile
// PATCH  /api/rfqs/:id                      → update title / description / deadline (DRAFT only)
// PATCH  /api/rfqs/:id/status               → status transition (DRAFT→SENT→CLOSED)
// DELETE /api/rfqs/:id                      → delete (DRAFT only)

// ── Line Items ────────────────────────────────────────────────────────────────
// POST   /api/rfqs/:id/items                → add item (DRAFT only)
// PATCH  /api/rfqs/:id/items/:itemId        → update item (DRAFT only)
// DELETE /api/rfqs/:id/items/:itemId        → remove item (DRAFT only)

// ── Vendor Assignment ─────────────────────────────────────────────────────────
// POST   /api/rfqs/:id/vendors              → assign vendors (body: { vendor_ids })
// DELETE /api/rfqs/:id/vendors/:vendorId    → remove a vendor

// ── Attachments ───────────────────────────────────────────────────────────────
// POST   /api/rfqs/:id/attachments          → upload file (multipart, field: "file")
// DELETE /api/rfqs/:id/attachments/:attachmentId → delete attachment

router.get('/', listRFQs);
router.post('/', createRFQ);

router.get('/:id', getRFQ);
router.patch('/:id', updateRFQ);
router.patch('/:id/status', updateRFQStatus);
router.delete('/:id', deleteRFQ);

router.post('/:id/items', addItem);
router.patch('/:id/items/:itemId', updateItem);
router.delete('/:id/items/:itemId', deleteItem);

router.post('/:id/vendors', assignVendors);
router.delete('/:id/vendors/:vendorId', removeVendor);

router.post('/:id/attachments', rfqUpload.single('file'), uploadAttachment);
router.delete('/:id/attachments/:attachmentId', deleteAttachment);

export default router;

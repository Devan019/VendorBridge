import { Router } from 'express';
import {
  addVendorNote,
  createVendor,
  deleteVendor,
  getVendor,
  getVendorHistory,
  listCategories,
  listVendors,
  updateVendor,
} from './controller';
import { isAuthenticated } from '../middleware';

const router = Router();

router.use(isAuthenticated);

// ── Vendor CRUD ───────────────────────────────────────────────────────────────
// GET    /api/vendors              → list with search / filter / sort / pagination
// POST   /api/vendors              → register new vendor
// GET    /api/vendors/categories   → distinct category list (must be before /:id)
// GET    /api/vendors/:id          → vendor profile
// PATCH  /api/vendors/:id          → update vendor fields / status
// DELETE /api/vendors/:id          → soft-delete (or hard with ?hard=true)

// ── Vendor Notes / History ────────────────────────────────────────────────────
// GET    /api/vendors/:id/history  → all notes for vendor
// POST   /api/vendors/:id/notes    → add a note to vendor profile

router.get('/', listVendors);
router.post('/', createVendor);

// Static sub-path must come BEFORE the dynamic :id routes
router.get('/categories', listCategories);

router.get('/:id', getVendor);
router.patch('/:id', updateVendor);
router.delete('/:id', deleteVendor);

router.get('/:id/history', getVendorHistory);
router.post('/:id/notes', addVendorNote);

export default router;

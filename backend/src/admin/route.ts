import { Router } from 'express';
import { isAuthenticated, isAuthorized } from '../middleware';
import { listUsers, getUser, updateUserRole, deleteUser, getAdminStats } from './controller';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(isAuthenticated);
router.use(isAuthorized(['ADMIN']));

// GET  /api/admin/stats              → dashboard stats (user counts, rfq counts, etc)
// GET  /api/admin/users              → list all users (search, filter by role, paginate)
// GET  /api/admin/users/:id          → single user detail
// PATCH /api/admin/users/:id/role    → change a user's role
// DELETE /api/admin/users/:id        → remove a user

router.get('/stats', getAdminStats);
router.get('/users', listUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id/role', updateUserRole);
router.delete('/users/:id', deleteUser);

export default router;

import { Request, Response } from 'express';
import expressAsyncHandler from '../utils/expressAsync';
import { formatResponse } from '../utils/formateResponse';
import prisma from '../utils/prisma';

// GET /api/admin/users — list all users with optional role filter
export const listUsers = expressAsyncHandler(async (req: Request, res: Response) => {
  const { role, search, page = '1', limit = '20' } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const where: any = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { first_name: { contains: search, mode: 'insensitive' } },
      { last_name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        email: true,
        role: true,
        phone: true,
        country: true,
        image_key: true,
        created_at: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return formatResponse(res, 200, 'Users fetched successfully', true, {
    data: users,
    pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  });
});

// GET /api/admin/users/:id — single user detail
export const getUser = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      first_name: true,
      last_name: true,
      email: true,
      role: true,
      phone: true,
      country: true,
      image_key: true,
      created_at: true,
    },
  });

  if (!user) return formatResponse(res, 404, 'Not Found', false, null, 'User not found.');
  return formatResponse(res, 200, 'User fetched successfully', true, { data: user });
});

// PATCH /api/admin/users/:id/role — change a user's role
export const updateUserRole = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);
  const { role } = req.body as { role?: string };

  const validRoles = ['ADMIN', 'MANAGER', 'PROCUREMENT_OFFICER', 'VENDOR'];
  if (!role || !validRoles.includes(role)) {
    return formatResponse(res, 400, 'Validation Error', false, null, `role must be one of: ${validRoles.join(', ')}.`);
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return formatResponse(res, 404, 'Not Found', false, null, 'User not found.');

  // Prevent admin from removing their own admin role
  if (existing.id === req.user?.id && role !== 'ADMIN') {
    return formatResponse(res, 409, 'Conflict', false, null, 'You cannot change your own role.');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: role as any },
    select: { id: true, first_name: true, last_name: true, email: true, role: true },
  });

  return formatResponse(res, 200, 'User role updated', true, { data: updated });
});

// DELETE /api/admin/users/:id — delete a user
export const deleteUser = expressAsyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params['id']);

  if (id === req.user?.id) {
    return formatResponse(res, 409, 'Conflict', false, null, 'You cannot delete your own account.');
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return formatResponse(res, 404, 'Not Found', false, null, 'User not found.');

  await prisma.user.delete({ where: { id } });
  return formatResponse(res, 200, 'User deleted successfully', true, null);
});

// GET /api/admin/stats — quick dashboard stats for admin
export const getAdminStats = expressAsyncHandler(async (_req: Request, res: Response) => {
  const [totalUsers, totalVendors, totalRFQs, totalQuotations, usersByRole] = await Promise.all([
    prisma.user.count(),
    prisma.vendor.count(),
    prisma.rFQ.count(),
    prisma.quotation.count(),
    prisma.user.groupBy({ by: ['role'], _count: { role: true } }),
  ]);

  return formatResponse(res, 200, 'Admin stats fetched', true, {
    data: {
      totalUsers,
      totalVendors,
      totalRFQs,
      totalQuotations,
      usersByRole: usersByRole.map(r => ({ role: r.role, count: r._count.role })),
    },
  });
});

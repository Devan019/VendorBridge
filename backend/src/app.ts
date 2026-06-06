import 'dotenv/config';
import path from 'path';
import cors from 'cors';
import express, { Application, Request, Response, NextFunction } from 'express';
import { formatResponse } from './utils/formateResponse';
import vendorRoutes from './vendor/route';
import rfqRoutes from './rfq/route';
import quotationRoutes, { listRFQQuotations } from './quotation/route';
import authRoutes from './auth/route';
import comparisonRoutes from './comparison/route';
import approvalRoutes, { getApprovalTimeline } from './approval/route';
import notificationRoutes, { logRouter } from './notification/route';
import { poRoutes, invoiceRoutes } from './po/route';
import analyticsRoutes from './analytics/route';

const app: Application = express();
const PORT: number = Number(process.env.PORT) || 4000;

app.use((req, _res, next) => {
  const cookies: Record<string, string> = {};
  const cookieHeader = req.headers.cookie;

  if (cookieHeader) {
    cookieHeader.split(';').forEach((part) => {
      const [rawKey, ...rawValue] = part.trim().split('=');

      if (!rawKey) {
        return;
      }

      cookies[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue.join('='));
    });
  }

  req.cookies = cookies;
  next();
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);
app.use(express.json());

// ── Static files — serve uploaded attachments ─────────────────────────────────
app.use(
  '/uploads',
  express.static(path.join(process.cwd(), 'uploads')),
);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'VendorBridge API', version: '1.0.0' });
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/rfqs', rfqRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/logs', logRouter);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/pos', poRoutes);
app.use('/api/invoices', invoiceRoutes);
// Nested: GET /api/rfqs/:rfqId/quotations
app.get('/api/rfqs/:rfqId/quotations', listRFQQuotations);
// Nested: GET|POST /api/rfqs/:rfqId/compare[/select]
app.use('/api/rfqs/:rfqId/compare', comparisonRoutes);
// Nested: GET /api/quotations/:quotationId/approvals
app.get('/api/quotations/:quotationId/approvals', getApprovalTimeline);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  formatResponse(res, 404, "Route not found.", false);
});

// ── Global Error Handler ──────────────────────────────────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Error]', err);
  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  formatResponse(res, status, message, false, null, message);
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`⚡️ VendorBridge API running → http://localhost:${PORT}`);
});

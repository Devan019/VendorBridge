import 'dotenv/config';
import path from 'path';
import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import vendorRoutes from './routes/vendor.routes';
import rfqRoutes from './routes/rfq.routes';

const app: Application = express();
const PORT: number = Number(process.env.PORT) || 4000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
app.use('/api/vendors', vendorRoutes);
app.use('/api/rfqs', rfqRoutes);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`⚡️ VendorBridge API running → http://localhost:${PORT}`);
});

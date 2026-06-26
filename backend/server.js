import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import uploadRoute from './routes/uploadRoute.js';

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// ─── 1. Security Headers ───
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'unsafe-none' },
  contentSecurityPolicy: false, // Disabled — backend is a pure JSON API
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ─── 2. CORS — Allow any origin to connect ───
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

// ─── 3. Global Rate Limiter ───
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Slow down.' },
});
app.use(globalLimiter);

// ─── 4. Upload Rate Limiter ───
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many upload requests. Please try again after 15 minutes.',
  },
});

// ─── 5. Body Parsers ───
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.disable('x-powered-by');

// ─── Routes ───
app.use('/api/v1', uploadLimiter, uploadRoute);

app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Image-to-URL REST API',
    version: '2.1.0',
    endpoint: '/api/v1/upload',
  });
});

// ─── 404 ───
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.' });
});

// ─── Centralized Error Handler ───
app.use((err, req, res, next) => {
  console.error(`[Error]:`, err.message);

  if (err.message === 'Blocked by CORS') {
    return res.status(403).json({ success: false, error: 'Origin not allowed.' });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'File too large. Max 4.5MB.' });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: 'Use "image" as the field name.' });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ success: false, error: 'Only 1 file per request.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Malformed request body.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request body too large.' });
  }

  return res.status(err.status || 500).json({ success: false, error: 'Internal server error.' });
});

// ─── Crash Guards ───
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
});

// ─── Start (dev only — Vercel uses the export in api/index.js) ───
if (isDev) {
  app.listen(PORT, () => {
    console.log('==================================================');
    console.log(` 🔒 Image-to-URL REST API v2.1`);
    console.log(` Server:   http://localhost:${PORT}`);
    console.log(` Upload:   http://localhost:${PORT}/api/v1/upload`);
    console.log('==================================================');
  });
}

export default app;

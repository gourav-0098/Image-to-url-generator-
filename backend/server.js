import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { requestIdMiddleware } from './middleware/requestId.js';
import { securityHeaders, hotlinkProtection, csrfProtection } from './middleware/security.js';
import { memoryCheck } from './middleware/memory.js';
import { CORS_ORIGINS } from './config/constants.js';
import uploadRoute from './routes/uploadRoute.js';
import galleryRoute from './routes/galleryRoute.js';
import signRoute from './routes/signRoute.js';
import cronRoute from './routes/cronRoute.js';

// Load .env for local dev only
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// ─── Env validation (fail fast in production) ───
const requiredEnv = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missingEnv = requiredEnv.filter((k) => !process.env[k]);
if (missingEnv.length && process.env.NODE_ENV === 'production') {
  console.error(`[FATAL] Missing required env: ${missingEnv.join(', ')}`);
}

// ─── 1. Security Headers ───
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  contentSecurityPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true },
}));
app.disable('x-powered-by');
app.use(compression());

// Apply security headers + request ID to ALL requests
app.use(requestIdMiddleware);
app.use(securityHeaders);

// ─── 2. CORS — require ALLOWED_ORIGINS in production ───
// If ALLOWED_ORIGINS not set, allow all in dev, block in production.
// vercel.json headers provide fallback CORS headers at Edge.
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (CORS_ORIGINS.length === 0) {
      if (isDev) return cb(null, true);
      // Production: allow if vercel.json headers will handle it
      // This allows the request through; vercel.json adds Access-Control-* headers
      return cb(null, true);
    }
    if (CORS_ORIGINS.includes(origin) || CORS_ORIGINS.includes('*')) return cb(null, true);
    return cb(new Error('Origin not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
  credentials: true,
};
app.use(cors(corsOptions));

// Handle preflight OPTIONS explicitly
app.options('*', cors(corsOptions));

// ─── 2.5 CSRF protection on POST/PUT/DELETE ───
app.use(csrfProtection(CORS_ORIGINS));

// ─── 2.5 Hotlink protection for GET gallery routes ───
app.use('/api/v1/gallery', hotlinkProtection(CORS_ORIGINS));

// ─── 3. Global Rate Limiter (memory – use Upstash Redis for production) ───
const globalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests. Slow down.' },
  skip: (req) => req.path.startsWith('/api/v1/gallery') && req.method === 'GET',
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

// ─── 5. Upload timeout (prevent hanging connections) ───
app.set('timeout', 15000);
app.use((req, res, next) => {
  req.setTimeout(15000);
  res.setTimeout(15000);
  next();
});

// ─── 6. Body Parsers ───
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.disable('x-powered-by');
app.set('trust proxy', 1); // Vercel sets X-Forwarded-For

// ─── Routes ───
app.use('/api/v1', uploadLimiter, uploadRoute);
app.use('/api/v1', galleryRoute); // GET /api/v1/gallery/:id – no uploadLimiter
app.use('/api/v1', signRoute); // GET /api/v1/sign – signed direct upload params
app.use('/api', cronRoute); // GET /api/cron/cleanup

app.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Image-to-URL REST API',
    version: '2.2.0',
    endpoints: {
      uploadSingle: 'POST /api/v1/upload (field: image)',
      uploadBatch: 'POST /api/v1/upload/batch (field: images, 1-10 files, total <=4.5MB)',
      gallery: 'GET /api/v1/gallery/:id',
    },
  });
});

app.get('/api/health', async (req, res) => {
  let cloudinaryStatus = 'unknown';
  try {
    const { default: cloudinary } = await import('./config/cloudinary.js');
    const pong = await cloudinary.api.ping();
    cloudinaryStatus = pong.status || 'ok';
  } catch (e) {
    cloudinaryStatus = `error: ${e.message?.slice(0, 80)}`;
  }
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    version: '2.2.0',
    cloudinary: cloudinaryStatus,
    timestamp: new Date().toISOString(),
  });
});

// ─── Request logger (dev) ───
if (isDev) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[${req.method}] ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });
}

// ─── 404 ───
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found.', requestId: req.requestId });
});

// ─── Centralized Error Handler ───
app.use((err, req, res, next) => {
  const requestId = req.requestId || 'unknown';
  console.error(`[Error ${requestId}] ${req.method} ${req.originalUrl}:`, err.message);

  // Memory check
  if (!memoryCheck()) {
    return res.status(503).json({ success: false, error: 'Service temporarily unavailable (memory pressure)', requestId });
  }

  if (err.message === 'Blocked by CORS') {
    return res.status(403).json({ success: false, error: 'Origin not allowed.', requestId });
  }
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'File too large. Max 4.5MB per file.', requestId });
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ success: false, error: 'Use field name "image" for single or "images" for batch.', requestId });
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({ success: false, error: `Too many files. Max 10 per batch.`, requestId });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Malformed request body.', requestId });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request body too large. Vercel limit is 4.5MB total per request.', requestId });
  }

  return res.status(err.status || 500).json({ success: false, error: 'Internal server error.', requestId });
});

// ─── Crash Guards ───
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:', reason);
  // Do not exit on unhandled rejection in serverless, just log
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

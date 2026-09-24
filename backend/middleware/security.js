import { CSP_DIRECTIVES } from '../config/constants.js';

const CSP_STRING = Object.entries(CSP_DIRECTIVES)
  .map(([directive, values]) => `${directive} ${values.join(' ')}`)
  .join('; ');

// ─── CSRF protection – reject POST without valid Origin/Referer ───
export function csrfProtection(allowedOrigins) {
  return (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const origin = req.headers.origin || '';
      const referer = req.headers.referer || '';
      // Allow if origin/referer matches our allowed origins
      const host = origin ? new URL(origin).hostname : (referer ? new URL(referer).hostname : '');
      if (host && (allowedOrigins.includes(host) || allowedOrigins.includes('*'))) return next();
      // Allow same-origin direct calls (no origin header) for server-to-server
      if (!origin && !referer) return next();
      return res.status(403).json({ success: false, error: 'CSRF token missing or invalid.' });
    }
    next();
  };
}

// ─── Security headers middleware ───
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy', CSP_STRING);
  res.setHeader('X-Request-Id', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

// ─── Hotlink protection – validate Referer or Origin ───
export function hotlinkProtection(allowedOrigins) {
  return (req, res, next) => {
    if (req.method === 'GET') {
      const referer = req.headers.referer || '';
      const origin = req.headers.origin || '';
      // Allow direct API calls (no referer) or same-origin
      if (!referer && !origin) return next();
      if (allowedOrigins.length === 0) return next();
      const host = new URL(referer || origin).hostname;
      if (allowedOrigins.includes(host) || allowedOrigins.includes('*')) return next();
      return res.status(403).json({ success: false, error: 'Hotlink protection blocked this request.' });
    }
    next();
  };
}

// ─── SSRF protection – validate URLs are Cloudinary ───
export function validateCloudinaryUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    const allowedHosts = ['res.cloudinary.com', 'cloudinary.com'];
    if (!allowedHosts.some((h) => u.hostname.endsWith(h))) return false;
    if (!['https'].includes(u.protocol)) return false;
    // Block private/internal IPs
    const hostname = u.hostname;
    if (/^127\.|^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\./.test(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// ─── Sanitize a URL for safe display (prevent XSS) ───
export function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  return url.replace(/javascript:/gi, '').replace(/data:/gi, '').replace(/vbscript:/gi, '');
}

// ─── Sanitize filename for safe display ───
export function sanitizeFilename(name) {
  if (typeof name !== 'string') return '';
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
}

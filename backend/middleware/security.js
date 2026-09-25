import { CSP_DIRECTIVES } from '../config/constants.js';

const CSP_STRING = Object.entries(CSP_DIRECTIVES)
  .map(([directive, values]) => `${directive} ${values.join(' ')}`)
  .join('; ');

// ─── CSRF protection – reject POST without valid Origin/Referer ───
export function csrfProtection(allowedOrigins = []) {
  return (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      // If no restrictions or wildcard configured, allow
      if (!allowedOrigins || allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
        return next();
      }
      const origin = req.headers.origin || '';
      const referer = req.headers.referer || '';
      if (!origin && !referer) return next();
      try {
        const host = origin ? new URL(origin).hostname : new URL(referer).hostname;
        if (
          allowedOrigins.includes(host) ||
          allowedOrigins.includes(`https://${host}`) ||
          host.endsWith('.vercel.app') ||
          host === 'localhost' ||
          host === '127.0.0.1'
        ) {
          return next();
        }
      } catch {}
      return res.status(403).json({ success: false, error: 'CSRF validation failed.' });
    }
    next();
  };
}

// ─── Security headers middleware ───
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('X-Request-Id', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
}

// ─── Hotlink protection – validate Referer or Origin ───
export function hotlinkProtection(allowedOrigins = []) {
  return (req, res, next) => {
    if (req.method === 'GET') {
      if (!allowedOrigins || allowedOrigins.length === 0 || allowedOrigins.includes('*')) {
        return next();
      }
      const referer = req.headers.referer || '';
      const origin = req.headers.origin || '';
      if (!referer && !origin) return next();
      try {
        const host = new URL(referer || origin).hostname;
        if (
          allowedOrigins.includes(host) ||
          allowedOrigins.includes(`https://${host}`) ||
          host.endsWith('.vercel.app') ||
          host === 'localhost' ||
          host === '127.0.0.1'
        ) {
          return next();
        }
      } catch {}
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

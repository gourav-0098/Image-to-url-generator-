import { NextResponse } from 'next/server';

// Edge Middleware – runs on Vercel Edge (free, 0 Node cost)
// Handles CORS + simple in-memory rate-limit via headers
// For distributed limit, add Upstash Redis check here in future

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

export function proxy(req) {
  const res = NextResponse.next();

  // CORS for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin');
    if (origin) {
      if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*')) {
        res.headers.set('Access-Control-Allow-Origin', origin);
        res.headers.set('Vary', 'Origin');
      }
    } else {
      // Allow non-browser
      res.headers.set('Access-Control-Allow-Origin', '*');
    }
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Max-Age', '600');
  }

  // Security headers (also set in next.config, but double at Edge)
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' data: *.cloudinary.com res.cloudinary.com; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' api.cloudinary.com *.cloudinary.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.headers.set('Pragma', 'no-cache');
  res.headers.set('Expires', '0');

  // Handle preflight
  if (req.method === 'OPTIONS' && req.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }

  return res;
}

export const config = {
  matcher: ['/api/:path*', '/gallery/:path*', '/g/:path*'],
};

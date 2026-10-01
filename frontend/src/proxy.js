import { NextResponse } from 'next/server';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

export function proxy(req) {
  const res = NextResponse.next();

  // CORS for API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin');
    if (origin) {
      if (
        ALLOWED_ORIGINS.length === 0 ||
        ALLOWED_ORIGINS.includes(origin) ||
        ALLOWED_ORIGINS.includes('*') ||
        origin.endsWith('.vercel.app')
      ) {
        res.headers.set('Access-Control-Allow-Origin', origin);
        res.headers.set('Vary', 'Origin');
      }
    } else {
      res.headers.set('Access-Control-Allow-Origin', '*');
    }
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Max-Age', '600');
  }

  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS' && req.nextUrl.pathname.startsWith('/api/')) {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }

  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};

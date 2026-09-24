import { NextResponse } from 'next/server';
import { createGallery } from '../../../../config/galleryStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/v1/gallery – create short gallery ID from uploaded Cloudinary URLs
// Used by direct-upload flow (uploads go straight to Cloudinary, no Vercel proxy)
export async function POST(req) {
  try {
    const { urls } = await req.json();
    if (!Array.isArray(urls) || urls.length === 0 || urls.length > 10) {
      return NextResponse.json({ success: false, error: 'Provide urls array (1–10).' }, { status: 400 });
    }
    const filtered = urls.filter(
      (u) => typeof u === 'string' && u.startsWith('http') && u.includes('cloudinary.com')
    );
    if (filtered.length === 0) {
      return NextResponse.json({ success: false, error: 'No valid Cloudinary URLs.' }, { status: 400 });
    }
    if (filtered.length !== urls.length) {
      return NextResponse.json({ success: false, error: 'Some URLs invalid (must all be Cloudinary).' }, { status: 400 });
    }

    const galleryId = await createGallery(filtered);
    const galleryToken = Buffer.from(JSON.stringify(filtered)).toString('base64url');

    return NextResponse.json(
      { success: true, galleryId, galleryToken, count: filtered.length, urls: filtered },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message || 'Failed to create gallery' }, { status: 500 });
  }
}

// GET /api/v1/gallery?g=<token> – decode stateless token (fallback)
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('g') || searchParams.get('imgs');
  if (!token) return NextResponse.json({ success: false, error: 'Missing ?g= token' }, { status: 400 });
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString();
    const urls = JSON.parse(json);
    if (!Array.isArray(urls)) throw new Error('not array');
    const filtered = urls.filter((u) => typeof u === 'string' && u.startsWith('http'));
    return NextResponse.json({ success: true, count: filtered.length, urls: filtered });
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 400 });
  }
}

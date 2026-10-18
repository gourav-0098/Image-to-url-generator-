import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function signParams(params, secret) {
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(sorted + secret).digest('hex');
}

export async function GET() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (cloudName && apiSecret) {
    const timestamp = Math.round(Date.now() / 1000);
    const folder = 'image-to-url';
    const signature = signParams({ timestamp, folder }, apiSecret);
    return NextResponse.json({
      success: true,
      data: {
        cloudName,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder,
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        ttl: 300,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  // Fallback: proxy to backend API if frontend doesn't have direct Cloudinary credentials
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://image-to-url-generator.vercel.app';
  try {
    const res = await fetch(`${apiBase}/api/v1/sign`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data, {
      status: res.status,
      headers: {
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Sign service temporarily unavailable' }, { status: 503 });
  }
}



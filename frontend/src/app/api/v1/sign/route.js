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
  if (!cloudName || !apiSecret) {
    return NextResponse.json({ success: false, error: 'Cloudinary not configured' }, { status: 500 });
  }
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
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data: *.cloudinary.com res.cloudinary.com; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' api.cloudinary.com *.cloudinary.com; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
      'Access-Control-Allow-Origin': '*',
    },
  });
}



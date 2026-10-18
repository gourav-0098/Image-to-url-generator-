import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function tryDecodeToken(token) {
  if (!token || typeof token !== 'string') return null;
  try {
    let b64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = Buffer.from(b64, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {}
  return null;
}

export default async function GalleryShortRedirect({ params }) {
  const { id } = await params;
  if (!id) {
    redirect('/');
  }

  // 1. Direct decode if legacy base64 token
  const fromToken = tryDecodeToken(id);
  if (fromToken && fromToken.length > 0) {
    redirect(`/gallery?g=${encodeURIComponent(id)}`);
  }

  // 2. Redirect to gallery page with the short ID
  redirect(`/gallery?id=${encodeURIComponent(id)}`);
}

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

export default async function ShortRedirect({ params }) {
  const { id } = await params;
  if (!id) {
    redirect('/');
  }

  // 1. Direct decode if token
  const fromToken = tryDecodeToken(id);
  if (fromToken && fromToken.length > 0) {
    redirect(`/gallery?g=${encodeURIComponent(id)}`);
  }

  // 2. Query backend API if Redis/server ID
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://image-to-url-generator.vercel.app";
    const res = await fetch(`${apiBase}/api/v1/gallery/${encodeURIComponent(id)}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.urls) && data.urls.length > 0) {
        const token = Buffer.from(JSON.stringify(data.urls)).toString('base64url');
        redirect(`/gallery?g=${token}`);
      }
    }
  } catch {}

  // 3. Fallback to /gallery/${id}
  redirect(`/gallery/${encodeURIComponent(id)}`);
}

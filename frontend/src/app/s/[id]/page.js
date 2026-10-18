import { redirect, notFound } from 'next/navigation';

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

export default async function ShortImageRedirect({ params }) {
  const { id } = await params;
  if (!id) {
    redirect('/');
  }

  // 1. Check if token itself is base64 encoded
  const decoded = tryDecodeToken(id);
  if (decoded && decoded.length > 0) {
    if (decoded.length === 1) {
      redirect(decoded[0]);
    } else {
      redirect(`/gallery?g=${encodeURIComponent(id)}`);
    }
  }

  // 2. Fetch from backend MongoDB short record
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "https://image-to-url-generator.vercel.app";
  let targetUrl = null;
  let isGallery = false;

  try {
    const res = await fetch(`${apiBase}/api/v1/s/${encodeURIComponent(id)}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.type === 'gallery') {
        isGallery = true;
      } else if (data.url) {
        targetUrl = data.url;
      }
    }
  } catch (err) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
  }

  if (isGallery) {
    redirect(`/gallery?id=${encodeURIComponent(id)}`);
  }

  if (targetUrl) {
    redirect(targetUrl);
  }

  // Fallback: If not found, render a friendly error
  return (
    <main className="min-h-screen flex items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="max-w-md w-full text-center border border-zinc-800 bg-zinc-900/80 p-8 rounded-2xl shadow-2xl backdrop-blur-md">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">Short Link Not Found</h1>
        <p className="text-sm text-zinc-400 mb-6">
          The requested shortened image link (<code>{id}</code>) does not exist or may have expired.
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold text-white transition shadow-lg shadow-indigo-500/25"
        >
          Return to ImgDrive
        </a>
      </div>
    </main>
  );
}

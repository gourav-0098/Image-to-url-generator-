import { redirect } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://image-to-url-generator.vercel.app";

export default async function ShortRedirect({ params }) {
  const { id } = await params;
  if (!id || id.length < 4 || id.length > 32) {
    redirect('/');
  }
  try {
    const res = await fetch(`${API_BASE}/api/v1/gallery/${id}`, { cache: 'no-store' });
    if (!res.ok) redirect('/');
    const data = await res.json();
    if (!data.success || !data.urls) redirect('/');
    const galleryToken = Buffer.from(JSON.stringify(data.urls)).toString('base64url');
    redirect(`/gallery?g=${galleryToken}`);
  } catch {
    redirect('/');
  }
}

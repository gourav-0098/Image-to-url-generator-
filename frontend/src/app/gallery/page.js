"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// ─── XSS sanitization for URLs ───
function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  return url.replace(/javascript:/gi, '').replace(/data:/gi, '').replace(/vbscript:/gi, '').trim();
}

function isValidImageUrl(url) {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
}

function decodeUrls(token) {
  if (!token) return [];
  try {
    let b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = atob(b64);
    const arr = JSON.parse(json);
    if (Array.isArray(arr)) return arr.filter(isValidImageUrl);
  } catch {}
  try {
    const arr = token.split(",").map((s) => decodeURIComponent(s.trim())).filter(Boolean);
    if (arr.length > 0 && arr.every(isValidImageUrl)) return arr;
  } catch {}
  try {
    const arr = JSON.parse(decodeURIComponent(token));
    if (Array.isArray(arr)) return arr.filter(isValidImageUrl);
  } catch {}
  return [];
}

function GalleryInner() {
  const searchParams = useSearchParams();
  const [urls, setUrls] = useState([]);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [copiedGallery, setCopiedGallery] = useState(false);
  const [lightbox, setLightbox] = useState(null); // index or null

  useEffect(() => {
    // priority: ?g=  (galleryToken from backend)  -> hash fragment -> ?imgs=
    const g = searchParams.get("g");
    const imgs = searchParams.get("imgs");
    let token = g || imgs || "";
    // also check hash (e.g. /gallery#<token>) — useful for very long URLs not logged by server
    if (!token && typeof window !== "undefined" && window.location.hash) {
      token = window.location.hash.slice(1); // strip #
      // hash may be like #g=<token> or just token
      if (token.startsWith("g=")) token = token.slice(2);
    }
    let decoded = decodeUrls(token);

    // also support ?url= repeated? e.g. ?url=A&url=B
    if (decoded.length === 0) {
      const urlParams = searchParams.getAll("url");
      if (urlParams.length > 0) decoded = urlParams.filter((u) => u.startsWith("http"));
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls(decoded);
  }, [searchParams]);

  // keyboard nav for lightbox
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowRight") setLightbox((i) => (i + 1) % urls.length);
      if (e.key === "ArrowLeft") setLightbox((i) => (i - 1 + urls.length) % urls.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, urls.length]);

  const copy = async (text, idx = null) => {
    await navigator.clipboard.writeText(text);
    if (idx !== null) {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1500);
    } else {
      setCopiedGallery(true);
      setTimeout(() => setCopiedGallery(false), 2000);
    }
  };

  const galleryLink = typeof window !== "undefined" ? window.location.href : "";

  if (urls.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg text-center">
          <div className="card-glow rounded-2xl border border-zinc-800 bg-zinc-900/70 backdrop-blur-xl p-8">
            <div className="rounded-full bg-amber-500/15 w-14 h-14 flex items-center justify-center mx-auto mb-4">
              <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold text-zinc-100">No images found</h1>
            <p className="mt-2 text-sm text-zinc-400">This gallery link is invalid, expired, or contains no images.</p>
            <p className="mt-1 text-xs text-zinc-500 break-all">Expected format: <code className="bg-zinc-800 px-1 py-0.5 rounded">/gallery?g=&lt;token&gt;</code></p>
            <Link href="/" className="mt-6 inline-flex rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition">
              Upload Images
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-8 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link href="/" className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">ImgDrive</Link>
          <h1 className="text-lg font-semibold text-zinc-100 mt-1">Shared Gallery</h1>
          <p className="text-sm text-zinc-400">{urls.length} image{urls.length !== 1 ? "s" : ""} · Single shareable link</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => copy(galleryLink)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition border ${copiedGallery ? "bg-emerald-600 border-emerald-600 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700"}`}
          >
            {copiedGallery ? "Copied!" : "Copy Gallery Link"}
          </button>
          <Link
            href="/"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
          >
            Upload More
          </Link>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {urls.map((url, idx) => (
          <div key={idx} className="group rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/60 backdrop-blur flex flex-col">
            <button onClick={() => setLightbox(idx)} className="relative aspect-[4/3] overflow-hidden bg-zinc-950 block w-full text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Image ${idx + 1}`} className="w-full h-full object-contain group-hover:scale-[1.02] transition duration-300" loading="lazy" />
              <span className="absolute top-2 left-2 bg-black/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded-full font-medium">#{idx + 1}</span>
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="bg-zinc-900/80 text-white text-xs px-3 py-1.5 rounded-full">View</span>
              </span>
            </button>
            <div className="p-3 flex items-center gap-2">
              <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs text-indigo-400 hover:underline truncate" title={url}>
                {url}
              </a>
              <button
                onClick={() => copy(url, idx)}
                className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition ${copiedIdx === idx ? "bg-emerald-600 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
              >
                {copiedIdx === idx ? "Copied!" : "Copy"}
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md bg-zinc-800 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 transition" title="Open original">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur flex flex-col">
          <div className="flex items-center justify-between p-4 shrink-0">
            <span className="text-sm text-zinc-300">{lightbox + 1} / {urls.length}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => copy(urls[lightbox])} className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700">Copy URL</button>
              <a href={urls[lightbox]} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">Open Original</a>
              <button onClick={() => setLightbox(null)} className="rounded-full bg-zinc-800 p-2 text-zinc-300 hover:bg-zinc-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-4 gap-2 min-h-0">
            <button onClick={() => setLightbox((i) => (i - 1 + urls.length) % urls.length)} className="shrink-0 hidden sm:flex rounded-full bg-zinc-800/80 p-3 text-white hover:bg-zinc-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
            <div className="flex-1 flex items-center justify-center min-h-0 max-w-5xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[lightbox]} alt={`Image ${lightbox + 1}`} className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl" />
            </div>
            <button onClick={() => setLightbox((i) => (i + 1) % urls.length)} className="shrink-0 hidden sm:flex rounded-full bg-zinc-800/80 p-3 text-white hover:bg-zinc-700">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
          {/* Thumbnails */}
          <div className="shrink-0 p-3 overflow-x-auto">
            <div className="flex gap-2 justify-center">
              {urls.map((u, i) => (
                <button key={i} onClick={() => setLightbox(i)} className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 ${i === lightbox ? "border-indigo-500" : "border-transparent opacity-60 hover:opacity-100"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function GalleryPage() {
  return (
    <Suspense fallback={<main className="flex-1 flex items-center justify-center p-12"><span className="text-sm text-zinc-500">Loading gallery…</span></main>}>
      <GalleryInner />
    </Suspense>
  );
}

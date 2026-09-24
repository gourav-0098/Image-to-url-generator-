"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ─── XSS sanitization ───
function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  return url.replace(/javascript:/gi, '').replace(/data:/gi, '').replace(/vbscript:/gi, '').trim();
}
function isValidCloudinaryUrl(url) {
  if (typeof url !== 'string') return false;
  try { const u = new URL(url); return u.protocol === 'https:' && (u.hostname.endsWith('cloudinary.com') || u.hostname.endsWith('res.cloudinary.com')); } catch { return false; }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://image-to-url-generator.vercel.app";
const API_URL_SINGLE = `${API_BASE}/api/v1/upload`;
const API_URL_BATCH = `${API_BASE}/api/v1/upload/batch`;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 4.5 * 1024 * 1024;
const MAX_TOTAL = 4.5 * 1024 * 1024;
const MAX_FILES = 10;
const HISTORY_KEY = "imgdrive_history";
const getBadgeClass = (n) => n <= 5 ? "bg-emerald-500/20 text-emerald-400" : n <= 8 ? "bg-amber-500/20 text-amber-400" : "bg-red-500/20 text-red-400";

function copyWithFallback(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  }
  return fallbackCopy(text);
}
function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); } catch {}
  document.body.removeChild(ta);
  return Promise.resolve();
}

export default function Home() {
  const [state, setState] = useState("idle");
  const [files, setFiles] = useState([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copiedGallery, setCopiedGallery] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [history, setHistory] = useState([]);

  const inputRef = useRef(null);
  const dragCounter = useRef(0);
  const filesRef = useRef(files);
  useEffect(() => { filesRef.current = files; }, [files]);

  // Load history
  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setHistory(JSON.parse(raw).slice(0, 10));
    } catch {}
  }, []);
  const saveHistory = (entry) => {
    try {
      const next = [entry, ...history].slice(0, 10);
      setHistory(next);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {}
  };
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  };

  const makeId = () => Math.random().toString(36).slice(2, 9);

  const validateAndPreview = useCallback((fileList) => {
    const incoming = Array.from(fileList);
    const current = filesRef.current;
    const totalAfter = current.length + incoming.length;
    if (totalAfter > MAX_FILES) {
      setError(`You can upload up to ${MAX_FILES} images at once. You tried to add ${incoming.length} (already have ${current.length}).`);
      setState("error");
      return;
    }
    const currentTotal = current.reduce((s, f) => s + f.file.size, 0);
    const incomingTotal = incoming.reduce((s, f) => s + f.size, 0);
    if (currentTotal + incomingTotal > MAX_TOTAL) {
      setError(`Total size would be ${((currentTotal + incomingTotal) / (1024 * 1024)).toFixed(2)}MB — Vercel limit is 4.5MB total per request. Remove some files.`);
      setState("error");
      return;
    }
    for (const f of incoming) {
      if (!ALLOWED_TYPES.includes(f.type)) {
        setError(`"${f.name}" has unsupported type ${f.type}. Only JPEG, PNG, WebP, AVIF allowed.`);
        setState("error");
        return;
      }
      if (f.size > MAX_SIZE) {
        setError(`"${f.name}" exceeds 4.5 MB limit (${(f.size / (1024 * 1024)).toFixed(2)} MB).`);
        setState("error");
        return;
      }
    }

    const newEntries = incoming.map((f) => ({ id: makeId(), file: f, preview: null }));
    // Optimistic add
    setFiles((prev) => [...prev, ...newEntries]);
    setError("");
    setResult(null);
    setCopiedGallery(false);
    setCopiedIdx(null);
    setState("preview");

    newEntries.forEach((entry) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFiles((prev) => prev.map((x) => (x.id === entry.id ? { ...x, preview: e.target.result } : x)));
      };
      reader.readAsDataURL(entry.file);
    });
  }, []);

  // Paste support
  useEffect(() => {
    const onPaste = (e) => {
      if (state === "uploading" || state === "success") return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const filesFromClipboard = [];
      for (const it of items) if (it.kind === "file" && ALLOWED_TYPES.includes(it.type)) filesFromClipboard.push(it.getAsFile());
      if (filesFromClipboard.length) {
        e.preventDefault();
        validateAndPreview(filesFromClipboard);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [state, validateAndPreview]);

  const handleFileInput = (e) => {
    if (e.target.files?.length) validateAndPreview(e.target.files);
    e.target.value = "";
  };
  const removeFile = (id) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (next.length === 0) setState("idle");
      return next;
    });
  };

  // Drag with counter (fixes flicker)
  const onDragEnter = (e) => { e.preventDefault(); dragCounter.current++; setDragActive(true); };
  const onDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = (e) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current <= 0) { dragCounter.current = 0; setDragActive(false); } };
  const onDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    if (e.dataTransfer.files?.length) validateAndPreview(e.dataTransfer.files);
  };

  // ── Client-side compression (bypasses Vercel limit, saves bandwidth) ──
  const compressFile = async (file) => {
    if (file.size < 1.1 * 1024 * 1024) return file; // skip small
    try {
      const bitmap = await createImageBitmap(file).catch(async () => {
        const url = URL.createObjectURL(file);
        const img = await new Promise((res, rej) => {
          const i = new window.Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = url;
        });
        URL.revokeObjectURL(url);
        return img;
      });
      const maxW = 1920;
      let w = bitmap.width || bitmap.naturalWidth, h = bitmap.height || bitmap.naturalHeight;
      if (!w || !h) return file;
      const ratio = Math.min(1, maxW / Math.max(w, h));
      const nw = Math.round(w * ratio), nh = Math.round(h * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = nw; canvas.height = nh;
      const ctx = canvas.getContext('2d');
      // @ts-ignore
      if (bitmap instanceof ImageBitmap) ctx.drawImage(bitmap, 0, 0, nw, nh);
      else ctx.drawImage(bitmap, 0, 0, nw, nh);
      if (bitmap.close) try { bitmap.close(); } catch {}
      const outType = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
      const blob = await new Promise((res) => canvas.toBlob(res, outType, 0.78));
      if (!blob || blob.size >= file.size) return file;
      const newName = file.name.replace(/\.[^.]+$/, outType === 'image/webp' ? '.webp' : '.jpg');
      return new File([blob], newName, { type: blob.type });
    } catch { return file; }
  };

  const getSignData = async () => {
    const endpoints = [
      `${API_BASE}/api/v1/sign`,
      `/api/v1/sign`,
    ];
    for (const ep of endpoints) {
      try {
        const r = await fetch(ep, { cache: 'no-store' });
        if (!r.ok) continue;
        const j = await r.json();
        if (j.success && j.data?.signature) return j.data;
      } catch {}
    }
    return null;
  };

  const uploadViaDirect = async (filesList, signData, onProgress) => {
    const urls = [];
    let completed = 0;
    for (let i = 0; i < filesList.length; i++) {
      const f = await compressFile(filesList[i]);
      const fd = new FormData();
      fd.append('file', f);
      fd.append('api_key', signData.apiKey);
      fd.append('timestamp', String(signData.timestamp));
      fd.append('signature', signData.signature);
      fd.append('folder', signData.folder);
      // optional eager: quality auto
      // fd.append('quality', 'auto');

      const url = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', signData.uploadUrl);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const perFile = (e.loaded / e.total) / filesList.length;
            const overall = ((completed + perFile) * 100);
            onProgress(Math.min(99, Math.round(overall)));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.secure_url) resolve(res.secure_url);
              else reject(new Error(res.error?.message || 'Cloudinary error'));
            } catch (e) { reject(e); }
          } else reject(new Error(`Direct upload failed ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(fd);
      });
      urls.push(url);
      completed++;
      onProgress(Math.round((completed / filesList.length) * 100));
    }
    // create short gallery id via backend (or frontend route)
    let galleryId = null, galleryToken = null;
    try {
      const r = await fetch(`${API_BASE}/api/v1/gallery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      if (r.ok) {
        const j = await r.json();
        galleryId = j.galleryId; galleryToken = j.galleryToken;
      }
    } catch {}
    if (!galleryId) {
      // fallback stateless token
      galleryToken = btoa(JSON.stringify(urls)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return { urls, galleryId, galleryToken };
  };

  const uploadViaProxy = (filesList, onProgress) => new Promise((resolve, reject) => {
    const isSingle = filesList.length === 1;
    const targetUrl = isSingle ? API_URL_SINGLE : API_URL_BATCH;
    const fieldName = isSingle ? 'image' : 'images';
    const fd = new FormData();
    if (isSingle) fd.append(fieldName, filesList[0]);
    else filesList.forEach((f) => fd.append(fieldName, f));
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;
      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (!res.success) return reject(new Error(res.error || 'Upload failed'));
          let urls, galleryToken, galleryId, data, count;
          if (res.urls) { urls = res.urls; galleryToken = res.galleryToken; galleryId = res.galleryId; data = res.data; count = res.count; }
          else { urls = [res.url]; data = [res.data]; count = 1; galleryToken = res.galleryToken || ''; galleryId = res.galleryId || ''; }
          resolve({ urls, galleryToken, galleryId, data, count });
        } catch (e) { reject(e); }
      } else {
        try { const j = JSON.parse(xhr.responseText); reject(new Error(j.error || `Upload failed ${xhr.status}`)); }
        catch { reject(new Error(`Upload failed ${xhr.status}`)); }
      }
    };
    xhr.open('POST', targetUrl, true);
    xhr.send(fd);
  });

  const upload = async () => {
    if (filesRef.current.length === 0) return;
    setState('uploading'); setProgress(0); setError(''); setShowQR(false);
    const rawFiles = filesRef.current.map((f) => f.file);

    // Try direct (bypasses Vercel, supports >4.5MB, client compress)
    try {
      const signData = await getSignData();
      if (signData) {
        const onProgress = (p) => setProgress(p);
        const direct = await uploadViaDirect(rawFiles, signData, onProgress);
        const urls = direct.urls; const galleryId = direct.galleryId; const galleryToken = direct.galleryToken;
        const galleryUrl = galleryId ? `${window.location.origin}/gallery/${galleryId}` : `${window.location.origin}/gallery?g=${galleryToken}`;
        const final = { urls, galleryId, galleryToken, galleryUrl, count: urls.length, data: urls.map((u, i) => ({ url: u, filename: rawFiles[i].name })) };
        setResult(final); setState('success');
        saveHistory({ galleryUrl, galleryId, galleryToken, urls, count: urls.length, date: new Date().toISOString() });
        return;
      }
    } catch (e) {
      console.warn('[Direct] fallback to proxy', e.message);
    }

    // Fallback: proxy via Vercel (4.5MB limit)
    try {
      // compress before proxy too to stay under limit
      const compressed = [];
      for (const f of rawFiles) compressed.push(await compressFile(f));
      const total = compressed.reduce((s, f) => s + f.size, 0);
      if (total > MAX_TOTAL) {
        setError(`Total compressed size ${(total / 1024 / 1024).toFixed(2)}MB exceeds 4.5MB. Try fewer files or enable direct upload (set CLOUDINARY vars).`);
        setState('error'); return;
      }
      const proxyRes = await uploadViaProxy(compressed, (p) => setProgress(p));
      const galleryUrl = proxyRes.galleryId ? `${window.location.origin}/gallery/${proxyRes.galleryId}` : proxyRes.galleryToken ? `${window.location.origin}/gallery?g=${proxyRes.galleryToken}` : proxyRes.urls[0];
      const final = { urls: proxyRes.urls, galleryId: proxyRes.galleryId, galleryToken: proxyRes.galleryToken, galleryUrl, count: proxyRes.count || proxyRes.urls.length, data: proxyRes.data };
      setResult(final); setState('success');
      saveHistory({ galleryUrl, galleryId: proxyRes.galleryId, galleryToken: proxyRes.galleryToken, urls: proxyRes.urls, count: final.count, date: new Date().toISOString() });
    } catch (e) {
      setError(e.message || 'Upload failed'); setState('error');
    }
  };

  const copyGallery = async () => {
    if (!result?.galleryUrl) return;
    await copyWithFallback(sanitizeUrl(result.galleryUrl));
    setCopiedGallery(true);
    setTimeout(() => setCopiedGallery(false), 2000);
  };
  const copySingle = async (url, idx) => {
    await copyWithFallback(sanitizeUrl(url));
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };
  const copyAll = async () => {
    if (!result?.urls) return;
    await copyWithFallback(result.urls.join("\n"));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const reset = () => {
    setState("idle"); setFiles([]); setProgress(0); setResult(null); setError(""); setCopiedGallery(false); setCopiedIdx(null); setCopiedAll(false); setShowQR(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const totalSizeMB = files.reduce((acc, f) => acc + f.file.size, 0) / (1024 * 1024);
  const containerMax = state === "success" && result?.count > 1 ? "max-w-2xl" : "max-w-lg";

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className={`w-full ${containerMax} transition-all`}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">ImgDrive</h1>
          <p className="mt-2 text-sm text-zinc-400">Upload up to {MAX_FILES} images · Single gallery link + individual CDN URLs</p>
          <p className="mt-1 text-xs text-zinc-600">Tip: Paste (Ctrl+V) images directly</p>
        </div>

        <div className="card-glow rounded-2xl border border-zinc-800 bg-zinc-900/70 backdrop-blur-xl p-6">
          {state === "idle" && (
            <div
              onDragEnter={onDragEnter}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload images – click or drag and drop"
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
              className={`group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${dragActive ? "dropzone-active border-indigo-500 bg-indigo-500/10" : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40"}`}
            >
              <div className="rounded-full bg-zinc-800 p-4 group-hover:bg-indigo-500/20 transition">
                <svg className="h-8 w-8 text-zinc-400 group-hover:text-indigo-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" /></svg>
              </div>
              <p className="text-sm text-zinc-400"><span className="font-medium text-indigo-400">Click to browse</span> or drag &amp; drop</p>
              <p className="text-xs text-zinc-500">JPEG, PNG, WebP, AVIF · Max 4.5 MB each · Up to {MAX_FILES} files · Total ≤4.5MB</p>
              <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={handleFileInput} aria-hidden="true" />
            </div>
          )}

          {state === "preview" && (
            <div className="flex flex-col gap-4">
              <div className={`grid gap-3 ${files.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {files.map(({ id, file, preview }) => (
                  <div key={id} className="relative group rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950">
                    {preview ? <img src={preview} alt={file.name} className="w-full h-36 object-contain bg-zinc-950" /> : <div className="w-full h-36 flex items-center justify-center bg-zinc-900 text-xs text-zinc-500">Loading…</div>}
                    <button onClick={() => removeFile(id)} aria-label={`Remove ${file.name}`} className="absolute top-2 right-2 rounded-full bg-black/70 p-1 text-white hover:bg-red-600 transition focus:ring-2 focus:ring-white">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <p className="text-[11px] text-white truncate">{file.name}</p>
                      <p className="text-[10px] text-zinc-300">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <button onClick={() => inputRef.current?.click()} aria-label="Add more images" className="rounded-xl border-2 border-dashed border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40 flex flex-col items-center justify-center gap-2 h-36 transition text-zinc-500 hover:text-zinc-300 focus:ring-2 focus:ring-indigo-500">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    <span className="text-xs font-medium">Add more</span>
                  </button>
                )}
              </div>
              <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" onChange={handleFileInput} />
<div className="flex items-center justify-between text-xs px-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-6 h-5 rounded-full text-[10px] font-bold ${getBadgeClass(files.length)}`}>{files.length}/{MAX_FILES}</span>
                    <span className="text-zinc-500">{totalSizeMB.toFixed(2)} MB</span>
                  </div>
                  <span className={totalSizeMB > 4.5 ? "text-amber-400" : "text-zinc-600"}>{totalSizeMB > 4.5 ? "⚠ Exceeds 4.5MB limit" : "Single gallery link will be created"}</span>
                </div>
              <div className="flex gap-3">
                <button onClick={reset} className="flex-1 rounded-lg border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">Cancel</button>
                <button onClick={upload} disabled={totalSizeMB > 4.5} className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed">Upload {files.length > 1 ? `${files.length} Images` : "Image"}</button>
              </div>
            </div>
          )}

          {state === "uploading" && (
            <div className="flex flex-col items-center gap-5 py-8" role="status" aria-live="polite">
              <div className="relative h-16 w-16"><svg className="animate-spin h-16 w-16" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" className="text-zinc-800" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" className="text-indigo-500" /></svg></div>
              <p className="text-sm font-medium text-zinc-300">Uploading {files.length} image{files.length !== 1 ? "s" : ""}…</p>
              <div className="w-full rounded-full bg-zinc-800 h-2 overflow-hidden"><div className="progress-bar-shimmer h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} /></div>
              <span className="text-xs text-zinc-500 tabular-nums">{progress}%</span>
            </div>
          )}

          {state === "success" && result && (
            <div className="flex flex-col gap-5 py-2">
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-full bg-emerald-500/15 p-3"><svg className="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg></div>
                <p className="text-sm font-semibold text-emerald-400">{result.count === 1 ? "Upload Successful!" : `${result.count} Images Uploaded!`}</p>
                {result.count > 1 && <p className="text-xs text-zinc-400 -mt-1">One gallery link opens all images</p>}
              </div>

              <div className="rounded-xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1 tracking-widest uppercase">Gallery Link</span>
                  <span className="text-xs text-zinc-400">Single URL · Opens all {result.count} image{result.count !== 1 ? "s" : ""}</span>
                </div>
                <div className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-3 flex items-center gap-2">
                  <a href={result.galleryUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs text-indigo-400 hover:underline truncate">{result.galleryUrl}</a>
                  <button onClick={copyGallery} aria-label="Copy gallery link" className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${copiedGallery ? "copy-success bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"}`}>{copiedGallery ? "Copied!" : "Copy"}</button>
                </div>
                <div className="flex gap-2">
                  <a href={result.galleryUrl} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-500 transition">Open Gallery ↗</a>
                  <button onClick={copyGallery} className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">{copiedGallery ? "Copied!" : "Copy Link"}</button>
                  <button onClick={() => setShowQR(!showQR)} aria-label="Show QR code" className="rounded-lg border border-zinc-700 px-3 py-2.5 text-sm hover:bg-zinc-800" title="QR Code">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5A2.25 2.25 0 0 1 6 2.25h3A2.25 2.25 0 0 1 11.25 4.5v3A2.25 2.25 0 0 1 9 9.75H6A2.25 2.25 0 0 1 3.75 7.5v-3ZM3.75 16.5A2.25 2.25 0 0 1 6 14.25h3A2.25 2.25 0 0 1 11.25 16.5v3A2.25 2.25 0 0 1 9 21.75H6A2.25 2.25 0 0 1 3.75 19.5v-3ZM12.75 4.5A2.25 2.25 0 0 1 15 2.25h3A2.25 2.25 0 0 1 20.25 4.5v3A2.25 2.25 0 0 1 18 9.75h-3A2.25 2.25 0 0 1 12.75 7.5v-3ZM15 14.25h3.75M15 18h3.75M18 14.25v3.75" /></svg>
                  </button>
                </div>
                {showQR && (
                  <div className="flex flex-col items-center gap-2 p-3 bg-white rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(result.galleryUrl)}`} alt="QR for gallery link" className="w-44 h-44" loading="lazy" />
                    <span className="text-xs text-zinc-600">Scan to open gallery</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-medium text-zinc-400">Individual URLs</span>
                  {result.urls.length > 1 && <button onClick={copyAll} className={`text-xs font-medium transition ${copiedAll ? "text-emerald-400" : "text-indigo-400 hover:text-indigo-300"}`}>{copiedAll ? "Copied all!" : "Copy all"}</button>}
                </div>
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto pr-1">
                  {result.urls.map((url, idx) => (
                    <div key={idx} className="rounded-lg border border-zinc-800 bg-zinc-800/40 p-2.5 flex items-center gap-2">
                      <span className="shrink-0 w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-300">#{idx + 1}</span>
                      <a href={url} target="_blank" rel="noopener noreferrer" className="flex-1 text-xs text-indigo-400 hover:underline truncate">{url}</a>
                      <button onClick={() => copySingle(url, idx)} aria-label={`Copy URL ${idx + 1}`} className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition ${copiedIdx === idx ? "bg-emerald-600 text-white" : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"}`}>{copiedIdx === idx ? "Copied!" : "Copy"}</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 overflow-x-auto py-1">
                  {result.urls.map((u, i) => (
                    <a key={i} href={u} target="_blank" rel="noopener noreferrer" className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`uploaded ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              </div>

              <button onClick={reset} className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">Upload More</button>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-4 py-8" role="alert">
              <div className="rounded-full bg-red-500/15 p-3"><svg className="h-10 w-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /></svg></div>
              <p className="text-sm text-red-400 text-center max-w-xs break-words">{error}</p>
              <button onClick={reset} className="rounded-lg border border-zinc-700 px-6 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition">Try Again</button>
            </div>
          )}
        </div>

        {history.length > 0 && state !== "uploading" && (
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Recent Galleries</span>
              <button onClick={clearHistory} className="text-xs text-zinc-500 hover:text-zinc-300">Clear</button>
            </div>
            <div className="flex flex-col gap-2">
              {history.map((h, i) => (
                <a key={i} href={h.galleryUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg bg-zinc-800/40 p-2.5 hover:bg-zinc-800 transition">
                  <span className="text-xs font-bold text-zinc-400">{h.count} imgs</span>
                  <span className="flex-1 text-xs text-indigo-400 truncate">{h.galleryUrl}</span>
                  <span className="text-[10px] text-zinc-500">{new Date(h.date).toLocaleDateString()}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-zinc-600">Files are uploaded to Cloudinary (auto-optimized) · Single gallery link shares all · Total ≤4.5MB</p>
      </div>
    </main>
  );
}

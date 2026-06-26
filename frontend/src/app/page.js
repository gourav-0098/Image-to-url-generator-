"use client";

import { useState, useRef, useCallback } from "react";

const API_URL = `${process.env.NEXT_PUBLIC_API_URL || "https://image-to-url-generator.vercel.app"}/api/v1/upload`;

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 4.5 * 1024 * 1024; // 4.5 MB (matches Vercel limit)

export default function Home() {
  const [state, setState] = useState("idle"); // idle | preview | uploading | success | error
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const inputRef = useRef(null);

  /* ── File selection handler ── */
  const handleFile = useCallback((f) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      setError("Only JPEG, PNG, and WebP images are allowed.");
      setState("error");
      return;
    }
    if (f.size > MAX_SIZE) {
      setError("File exceeds the 4.5 MB size limit.");
      setState("error");
      return;
    }

    setFile(f);
    setError("");
    setResult(null);
    setCopied(false);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
      setState("preview");
    };
    reader.readAsDataURL(f);
  }, []);

  /* ── Drag events ── */
  const onDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };
  const onDragLeave = () => setDragActive(false);
  const onDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  /* ── Upload via XMLHttpRequest (for progress tracking) ── */
  const upload = () => {
    if (!file) return;
    setState("uploading");
    setProgress(0);
    setError("");

    const formData = new FormData();
    formData.append("image", file);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        setProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== XMLHttpRequest.DONE) return;

      if (xhr.status === 200) {
        try {
          const res = JSON.parse(xhr.responseText);
          if (res.success && res.url) {
            setResult(res);
            setState("success");
          } else {
            setError(res.error || "Upload failed.");
            setState("error");
          }
        } catch {
          setError("Invalid response from server.");
          setState("error");
        }
      } else {
        try {
          const res = JSON.parse(xhr.responseText);
          setError(res.error || `Upload failed (${xhr.status})`);
        } catch {
          setError(`Upload failed with status ${xhr.status}`);
        }
        setState("error");
      }
    };

    xhr.open("POST", API_URL, true);
    xhr.send(formData);
  };

  /* ── Copy to clipboard ── */
  const copyUrl = async () => {
    if (!result?.url) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Reset ── */
  const reset = () => {
    setState("idle");
    setFile(null);
    setPreview(null);
    setProgress(0);
    setResult(null);
    setError("");
    setCopied(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* ── Header ── */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            ImgDrive
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Upload an image · Get a shareable Google Drive link instantly
          </p>
        </div>

        {/* ── Card ── */}
        <div className="card-glow rounded-2xl border border-zinc-800 bg-zinc-900/70 backdrop-blur-xl p-6">
          {/* ── IDLE: Dropzone ── */}
          {state === "idle" && (
            <div
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`group relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors duration-200 ${
                dragActive
                  ? "dropzone-active border-indigo-500 bg-indigo-500/10"
                  : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/40"
              }`}
            >
              <div className="rounded-full bg-zinc-800 p-4 group-hover:bg-indigo-500/20 transition">
                <svg
                  className="h-8 w-8 text-zinc-400 group-hover:text-indigo-400 transition"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
                  />
                </svg>
              </div>
              <p className="text-sm text-zinc-400">
                <span className="font-medium text-indigo-400">
                  Click to browse
                </span>{" "}
                or drag &amp; drop
              </p>
              <p className="text-xs text-zinc-500">
                JPEG, PNG, WebP · Max 4.5 MB
              </p>
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
            </div>
          )}

          {/* ── PREVIEW ── */}
          {state === "preview" && (
            <div className="flex flex-col gap-4">
              <div className="relative overflow-hidden rounded-xl border border-zinc-800">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full max-h-64 object-contain bg-zinc-950"
                />
              </div>
              <div className="flex items-center justify-between text-sm text-zinc-400">
                <span className="truncate max-w-[60%]">{file?.name}</span>
                <span>{(file?.size / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="flex-1 rounded-lg border border-zinc-700 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={upload}
                  className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/25"
                >
                  Upload
                </button>
              </div>
            </div>
          )}

          {/* ── UPLOADING ── */}
          {state === "uploading" && (
            <div className="flex flex-col items-center gap-5 py-8">
              {/* Spinner */}
              <div className="relative h-16 w-16">
                <svg className="animate-spin h-16 w-16" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    fill="none"
                    className="text-zinc-800"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    className="text-indigo-500"
                  />
                </svg>
              </div>

              <p className="text-sm font-medium text-zinc-300">
                Uploading to Google Drive…
              </p>

              {/* Progress bar */}
              <div className="w-full rounded-full bg-zinc-800 h-2 overflow-hidden">
                <div
                  className="progress-bar-shimmer h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <span className="text-xs text-zinc-500 tabular-nums">
                {progress}%
              </span>
            </div>
          )}

          {/* ── SUCCESS ── */}
          {state === "success" && result && (
            <div className="flex flex-col items-center gap-5 py-4">
              {/* Checkmark */}
              <div className="rounded-full bg-emerald-500/15 p-3">
                <svg
                  className="h-10 w-10 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m4.5 12.75 6 6 9-13.5"
                  />
                </svg>
              </div>

              <p className="text-sm font-semibold text-emerald-400">
                Upload Successful!
              </p>

              {/* URL box */}
              <div className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 p-3 flex items-center gap-2">
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-xs text-indigo-400 hover:underline truncate"
                >
                  {result.url}
                </a>
                <button
                  onClick={copyUrl}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    copied
                      ? "copy-success bg-emerald-600 text-white"
                      : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                  }`}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              {/* File info */}
              {result.data && (
                <div className="w-full text-xs text-zinc-500 flex justify-between px-1">
                  <span className="truncate max-w-[50%]">
                    {result.data.filename}
                  </span>
                  <span>{result.data.size}</span>
                </div>
              )}

              <button
                onClick={reset}
                className="mt-2 rounded-lg border border-zinc-700 px-6 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition"
              >
                Upload Another
              </button>
            </div>
          )}

          {/* ── ERROR ── */}
          {state === "error" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="rounded-full bg-red-500/15 p-3">
                <svg
                  className="h-10 w-10 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
                  />
                </svg>
              </div>
              <p className="text-sm text-red-400 text-center max-w-xs">
                {error}
              </p>
              <button
                onClick={reset}
                className="rounded-lg border border-zinc-700 px-6 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-600">
          Files are uploaded to Google Drive via secure OAuth 2.0
        </p>
      </div>
    </main>
  );
}

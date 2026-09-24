import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  preload: true,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata = {
  title: "ImgDrive — Instant Image Hosting",
  description:
    "Upload up to 10 images at once and get a single shareable gallery link + individual CDN URLs. Fast, secure Cloudinary hosting.",
  keywords: ["image hosting", "image to url", "gallery", "cloudinary", "share images"],
  authors: [{ name: "ImgDrive" }],
  manifest: "/manifest.json",
  openGraph: {
    title: "ImgDrive — Instant Image Hosting",
    description: "Upload up to 10 images and share via a single gallery link.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ImgDrive — Instant Image Hosting",
    description: "Upload up to 10 images and share via a single gallery link.",
  },
  robots: { index: true, follow: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased dark`}>
      <body className="min-h-full flex flex-col bg-zinc-950 text-zinc-100 font-sans">
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}))}`,
          }}
        />
      </body>
    </html>
  );
}

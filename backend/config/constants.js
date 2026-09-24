// Security constants – keep all magic numbers in one place
export const MAX_FILES = 10;
export const MAX_FILE_SIZE = 4.5 * 1024 * 1024;
export const MAX_TOTAL_SIZE = 4.5 * 1024 * 1024;
export const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
export const SIGNATURE_TTL_SECONDS = 300; // 5 min for signed upload URLs
export const GALLERY_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const CLOUDINARY_FOLDER = 'image-to-url';
export const MAX_UPLOADS_PER_IP_PER_HOUR = 20;
export const MAX_UPLOADS_PER_USER_PER_DAY = 200;
export const CLOUDINARY_MAX_RETRIES = 2;
export const CLOUDINARY_RETRY_DELAY_MS = 500;
export const REQUEST_TIMEOUT_MS = 8000;
export const MEMORY_WARNING_THRESHOLD = 80; // %
export const REDIS_KEY_PREFIX = 'imgdrive:';
export const UPSTASH_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
export const UPSTASH_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
export const CORS_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'img-src': ["'self'", 'data:', '*.cloudinary.com', 'res.cloudinary.com'],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'connect-src': ["'self'", 'api.cloudinary.com', '*.cloudinary.com'],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'plugin-types': [],
};

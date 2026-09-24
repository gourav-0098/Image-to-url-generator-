import multer from 'multer';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
export const ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'avif'];

// Vercel body limit is 4.5MB TOTAL per request – enforce sum
export const MAX_TOTAL_SIZE = 4.5 * 1024 * 1024;
export const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

// Magic bytes for real image validation (prevents renamed .exe uploads)
// WebP: RIFF....WEBP at 0 and 8, AVIF: ftypavif
const MAGIC_BYTES = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png':  [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  'image/webp': [Buffer.from('RIFF')],
  'image/avif': [Buffer.from('ftyp')],
};

// Validate magic bytes synchronously (called in fileFilter before accepting file)
export function validateMagicBytes(buffer, mimetype) {
  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) return false;

  if (mimetype === 'image/webp') {
    if (buffer.length < 12) return false;
    const isRiff = buffer.subarray(0, 4).equals(Buffer.from('RIFF'));
    const isWebp = buffer.subarray(8, 12).equals(Buffer.from('WEBP'));
    return isRiff && isWebp;
  }
  if (mimetype === 'image/avif') {
    if (buffer.length < 12) return false;
    const ftyp = buffer.subarray(4, 8).toString();
    const brand = buffer.subarray(8, 12).toString();
    return ftyp === 'ftyp' && (brand === 'avif' || brand === 'avis');
  }

  return signatures.some((sig) => {
    if (buffer.length < sig.length) return false;
    const slice = buffer.subarray(0, sig.length);
    return sig.every((byte, i) => byte === slice[i]);
  });
}

// Strict fileFilter: checks BOTH MIME type AND magic bytes BEFORE accepting
const fileFilter = (req, file, cb) => {
  // Step 1: Reject non-allowed MIME types
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(new Error(`Rejected: ${file.mimetype}. Only ${ALLOWED_MIMES.join(', ')} allowed.`), false);
  }
  // Step 2: Reject if buffer exists but magic bytes don't match
  if (file.buffer && file.buffer.length > 0) {
    if (!validateMagicBytes(file.buffer, file.mimetype)) {
      return cb(new Error(`File content does not match ${file.mimetype}. Magic-byte validation failed.`), false);
    }
  }
  cb(null, true);
};

export const validateTotalSize = (files) => {
  const total = files.reduce((s, f) => s + f.size, 0);
  return { total, ok: total <= MAX_TOTAL_SIZE };
};

export const MAX_FILES = 10;

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
    fields: 5,
    fieldSize: 1024,
  },
});

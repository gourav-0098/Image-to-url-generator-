import multer from 'multer';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

// Magic bytes for real image validation (prevents renamed .exe uploads)
const MAGIC_BYTES = {
  'image/jpeg': [Buffer.from([0xFF, 0xD8, 0xFF])],
  'image/png':  [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  'image/webp': [Buffer.from('RIFF')],  // RIFF header (WebP starts with RIFF....WEBP)
};

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIMES.includes(file.mimetype)) {
    return cb(
      new Error(`Rejected: ${file.mimetype}. Only JPEG, PNG, and WebP allowed.`),
      false
    );
  }
  cb(null, true);
};

/**
 * Validates actual file bytes against known magic signatures.
 * Call this AFTER Multer has parsed the buffer into req.file.
 * Returns true if the buffer matches the claimed MIME type.
 */
export const validateMagicBytes = (buffer, mimetype) => {
  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) return false;

  return signatures.some((sig) => {
    const slice = buffer.subarray(0, sig.length);
    return sig.every((byte, i) => byte === slice[i]);
  });
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 4.5 * 1024 * 1024,  // 4.5 MB (Vercel free tier limit)
    files: 1,                    // single file per request
    fields: 5,                   // max 5 non-file fields
    fieldSize: 1024,             // max 1 KB per text field
  },
});

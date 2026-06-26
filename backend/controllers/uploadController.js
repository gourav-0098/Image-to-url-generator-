import { Readable } from 'stream';
import path from 'path';
import { drive } from '../config/googleDrive.js';
import { validateMagicBytes } from '../config/multer.js';

// Characters allowed in filenames (strip path traversal, null bytes, etc.)
const sanitizeFilename = (name) =>
  path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);

export const uploadImage = async (req, res) => {
  const { originalname, mimetype, buffer, size } = req.file;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  // ── Deep validation: check actual file bytes, not just the MIME header ──
  if (!validateMagicBytes(buffer, mimetype)) {
    console.warn('[Security] Magic-byte mismatch detected');
    return res.status(400).json({
      success: false,
      error: 'File content does not match its declared type. Upload rejected.',
    });
  }

  const safeName = `${Date.now()}-${sanitizeFilename(originalname)}`;

  try {
    // 1. Upload to Google Drive with a 30-second timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const { data: file } = await drive.files.create({
      requestBody: {
        name: safeName,
        mimeType: mimetype,
        parents: folderId ? [folderId] : [],
      },
      media: {
        mimeType: mimetype,
        body: Readable.from(buffer),
      },
      fields: 'id',
      supportsAllDrives: true,
      signal: controller.signal,
    });

    clearTimeout(timeout);


    // 2. Make file publicly readable
    await drive.permissions.create({
      fileId: file.id,
      requestBody: { role: 'reader', type: 'anyone' },
      supportsAllDrives: true,
    });

    const url = `https://drive.google.com/uc?export=view&id=${file.id}`;

    return res.status(200).json({
      success: true,
      url,
      data: {
        fileId: file.id,
        filename: sanitizeFilename(originalname),
        mimetype,
        size: `${(size / (1024 * 1024)).toFixed(2)} MB`,
      },
    });
  } catch (err) {
    // Never leak internal stack traces to the client
    console.error('[Drive Error]:', err.message);

    if (err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        error: 'Upload timed out. Please try again.',
      });
    }

    const status = err.code >= 400 && err.code < 600 ? err.code : 500;
    return res.status(status).json({
      success: false,
      error: 'Google Drive upload failed. Please try again later.',
    });
  }
};

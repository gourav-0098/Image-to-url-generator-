import express from 'express';
import multer from 'multer';
import { upload } from '../config/multer.js';
import { uploadImage } from '../controllers/uploadController.js';

const router = express.Router();

router.post('/upload', (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        error: `Upload error: ${err.message}`,
      });
    }

    if (err) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded. Use field name "image".',
      });
    }

    uploadImage(req, res);
  });
});

export default router;

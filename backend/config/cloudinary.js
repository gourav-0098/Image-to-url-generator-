import { v2 as cloudinary } from 'cloudinary';

const required = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(`[Cloudinary] Missing env: ${missing.join(', ')} – uploads will fail until set.`);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
  upload_timeout: 15000,
  connection_timeout: 10000,
});

export default cloudinary;

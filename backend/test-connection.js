import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cloudinary from './config/cloudinary.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🔍 Checking Cloudinary API configuration...\n');

const requiredKeys = [
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

let hasAllKeys = true;
for (const key of requiredKeys) {
  if (!process.env[key]) {
    console.error(`❌ Missing environment variable: ${key}`);
    hasAllKeys = false;
  } else {
    console.log(`✅ ${key}: Set`);
  }
}

if (!hasAllKeys) {
  console.error('\n⚠️ Please set all required keys in your backend/.env file.');
  process.exit(1);
}

async function runDiagnostics() {
  try {
    console.log('\n🔄 Testing Cloudinary API connection...');
    const res = await cloudinary.api.ping();
    console.log(`✅ Cloudinary API ping: ${res.status}`);

    console.log('\n📊 Fetching Cloudinary account usage details...');
    const usage = await cloudinary.api.usage();
    console.log(`👤 Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}`);
    console.log(`💾 Storage: ${(usage.storage?.usage / (1024 * 1024)).toFixed(2)} MB used`);
    console.log(`🖼️ Total Images / Assets: ${usage.objects?.usage || 0}`);
    console.log(`🌐 Bandwidth: ${(usage.bandwidth?.usage / (1024 * 1024)).toFixed(2)} MB used`);

    console.log('\n🎉 ALL CHECKS PASSED! Your Cloudinary integration is 100% ready to go.');
  } catch (err) {
    console.error('\n❌ DIAGNOSTIC FAILED:');
    console.error(err.message || err);
    process.exit(1);
  }
}

runDiagnostics();

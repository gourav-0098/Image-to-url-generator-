import { createShortGallery, getShortRecord } from '../services/shortUrlService.js';

export async function createGallery(urls, metadata = {}) {
  if (!Array.isArray(urls) || urls.length === 0) return null;
  return await createShortGallery({ urls, metadata });
}

export async function getGallery(id) {
  if (!id || typeof id !== 'string') return null;
  const record = await getShortRecord(id);
  if (record && Array.isArray(record.urls) && record.urls.length > 0) {
    return record.urls;
  }
  return null;
}

export function _memSize() {
  return 0;
}


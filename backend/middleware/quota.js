// Upload quota system per IP + global
// Uses in-memory store with TTL (ephemeral on serverless – use Upstash Redis for production)

const QUARTZ_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DAY_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_PER_IP_HOUR = 20;
const MAX_PER_DAY = 200;
const IP_TTL = QUARTZ_WINDOW_MS;

const ipStore = new Map(); // ip -> { hourStart, hourCount, dayStart, dayCount }

function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || req.ip
    || 'unknown';
}

export function checkQuota(req) {
  const ip = getClientIp(req);
  const now = Date.now();
  let entry = ipStore.get(ip);

  if (!entry || entry.dayStart + DAY_WINDOW_MS < now) {
    entry = { hourStart: now, hourCount: 0, dayStart: now, dayCount: 0 };
    ipStore.set(ip, entry);
  }
  if (entry.hourStart + QUARTZ_WINDOW_MS < now) {
    entry.hourStart = now;
    entry.hourCount = 0;
  }

  entry.hourCount++;
  entry.dayCount++;

  if (entry.hourCount > MAX_PER_IP_HOUR) {
    return { allowed: false, reason: `Hourly upload limit (${MAX_PER_IP_HOUR}/hr) exceeded` };
  }
  if (entry.dayCount > MAX_PER_DAY) {
    return { allowed: false, reason: `Daily upload limit (${MAX_PER_DAY}/day) exceeded` };
  }
  return { allowed: true, remaining: MAX_PER_IP_HOUR - entry.hourCount };
}

// Prune expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of ipStore) {
    if (entry.dayStart + DAY_WINDOW_MS < now) ipStore.delete(ip);
  }
  if (ipStore.size > 5000) {
    for (const [ip, entry] of ipStore) {
      if (entry.hourStart + QUARTZ_WINDOW_MS < now) ipStore.delete(ip);
    }
  }
}, 60 * 60 * 1000);

export function getRemainingQuota(req) {
  const ip = getClientIp(req);
  const entry = ipStore.get(ip);
  if (!entry) return { allowed: true, remaining: MAX_PER_IP_HOUR };
  return { allowed: entry.hourCount < MAX_PER_IP_HOUR, remaining: Math.max(0, MAX_PER_IP_HOUR - entry.hourCount) };
}

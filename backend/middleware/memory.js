// Memory monitoring for Node.js serverless (detect OOM against true heap limit)
import v8 from 'v8';

export function getMemoryUsage() {
  const usage = process.memoryUsage();
  let maxLimit = 1024 * 1024 * 1024; // 1GB fallback
  try {
    const stats = v8.getHeapStatistics();
    if (stats?.heap_size_limit) maxLimit = stats.heap_size_limit;
  } catch {}

  const heapUsedMB = (usage.heapUsed / 1024 / 1024).toFixed(1);
  const rssMB = (usage.rss / 1024 / 1024).toFixed(1);
  const heapTotalMB = (usage.heapTotal / 1024 / 1024).toFixed(1);
  const externalMB = (usage.external / 1024 / 1024).toFixed(1);
  const maxLimitMB = (maxLimit / 1024 / 1024).toFixed(0);
  const heapUsedPercent = ((usage.heapUsed / maxLimit) * 100).toFixed(1);

  return { heapUsedMB, rssMB, heapTotalMB, externalMB, maxLimitMB, heapUsedPercent };
}

export function memoryCheck() {
  const mem = getMemoryUsage();
  const percent = parseFloat(mem.heapUsedPercent);
  if (percent >= 85) {
    console.warn(`[Memory] CRITICAL: heap at ${percent}% of max limit (${mem.heapUsedMB}MB / ${mem.maxLimitMB}MB)`);
    if (global.gc) global.gc();
  }
  if (percent >= 92) {
    console.error(`[Memory] OOM imminent: heap at ${percent}% (${mem.heapUsedMB}MB / ${mem.maxLimitMB}MB) – aborting`);
    return false;
  }
  return true; // healthy
}

// Log memory stats periodically in dev
export function startMemoryMonitor(intervalMs = 30000) {
  if (process.env.NODE_ENV === 'production') return null;
  return setInterval(() => {
    const mem = getMemoryUsage();
    console.log(`[Memory] heap=${mem.heapUsedMB}MB/${mem.maxLimitMB}MB (${mem.heapUsedPercent}%) rss=${mem.rssMB}MB`);
  }, intervalMs);
}

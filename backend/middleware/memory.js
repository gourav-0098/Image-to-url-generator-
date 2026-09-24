// Memory monitoring for Node.js serverless (detect OOM before crash)

export function getMemoryUsage() {
  const usage = process.memoryUsage();
  const heapUsedMB = (usage.heapUsed / 1024 / 1024).toFixed(1);
  const rssMB = (usage.rss / 1024 / 1024).toFixed(1);
  const heapTotalMB = (usage.heapTotal / 1024 / 1024).toFixed(1);
  const externalMB = (usage.external / 1024 / 1024).toFixed(1);
  const heapLimitMB = (usage.heapTotal / (1024 * 1024)).toFixed(0); // rough
  const heapUsedPercent = ((usage.heapUsed / usage.heapTotal) * 100).toFixed(1);
  return { heapUsedMB, rssMB, heapTotalMB, externalMB, heapUsedPercent };
}

export function memoryCheck() {
  const mem = getMemoryUsage();
  const percent = parseFloat(mem.heapUsedPercent);
  if (percent >= 85) {
    console.warn(`[Memory] CRITICAL: heap at ${percent}% (${mem.heapUsedMB}MB) – forcing GC`);
    if (global.gc) global.gc();
  }
  if (percent >= 90) {
    console.error(`[Memory] OOM imminent: heap at ${percent}% – aborting`);
    return false; // signal caller to reject request
  }
  return true; // ok
}

// Log memory stats periodically in dev
export function startMemoryMonitor(intervalMs = 30000) {
  if (process.env.NODE_ENV === 'production') return null;
  return setInterval(() => {
    const mem = getMemoryUsage();
    console.log(`[Memory] heap=${mem.heapUsedMB}MB rss=${mem.rssMB}MB pct=${mem.heapUsedPercent}%`);
    if (mem.heapUsedPercent >= 80) console.warn('[Memory] WARNING: high usage');
  }, intervalMs);
}

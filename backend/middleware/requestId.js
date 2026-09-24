// Request ID middleware for tracing/debugging across serverless invocations

export function requestIdMiddleware(req, res, next) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  // Attach a lightweight logger
  req.log = {
    id,
    start: Date.now(),
    info: (msg) => console.log(`[${id}] ${msg}`),
    warn: (msg) => console.warn(`[${id}] WARN: ${msg}`),
    error: (msg) => console.error(`[${id}] ERROR: ${msg}`),
  };
  res.on('finish', () => {
    const ms = Date.now() - req.log.start;
    if (ms > 3000) req.log.warn(`Slow request: ${req.method} ${req.originalUrl} took ${ms}ms`);
  });
  next();
}

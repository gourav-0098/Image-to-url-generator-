// Circuit breaker for Cloudinary API calls
// Prevents cascading failures when Cloudinary is down

const STATES = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' };
const FAILURE_THRESHOLD = 5;
const SUCCESS_THRESHOLD = 2;
const OPEN_TIMEOUT_MS = 30 * 1000; // 30s before trying again

class CircuitBreaker {
  constructor() {
    this.state = STATES.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = null;
  }

  get isOpen() {
    if (this.state === STATES.OPEN) {
      if (Date.now() > this.lastFailureTime + OPEN_TIMEOUT_MS) {
        this.state = STATES.HALF_OPEN;
        return false; // allow one request through
      }
      return true;
    }
    return false;
  }

  recordSuccess() {
    this.failures = 0;
    this.successes++;
    if (this.successes >= SUCCESS_THRESHOLD && this.state === STATES.HALF_OPEN) {
      this.state = STATES.CLOSED;
      this.successes = 0;
    }
  }

  recordFailure() {
    this.successes = 0;
    this.failures++;
    this.lastFailureTime = Date.now();
    if (this.failures >= FAILURE_THRESHOLD) {
      this.state = STATES.OPEN;
      console.warn('[CircuitBreaker] OPEN – Cloudinary likely down, blocking for 30s');
    }
  }

  getStatus() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      open: this.isOpen,
    };
  }
}

// One instance per service
export const cloudinaryBreaker = new CircuitBreaker();

// Wrapper for Cloudinary calls with circuit breaker
export async function circuitBreakerWrapper(fn, breaker, fallback) {
  if (breaker.isOpen) {
    return fallback || Promise.reject(new Error('Service temporarily unavailable (circuit open)'));
  }
  try {
    const result = await fn();
    breaker.recordSuccess();
    return result;
  } catch (e) {
    breaker.recordFailure();
    return fallback || Promise.reject(e);
  }
}

interface AttemptWindow {
  attempts: number;
  blockedUntil?: number;
  windowStartedAt: number;
}

export interface LoginAttemptLimiter {
  canAttempt(key: string, now?: number): boolean;
  recordFailure(key: string, now?: number): void;
  recordSuccess(key: string): void;
}

export class InMemoryLoginAttemptLimiter implements LoginAttemptLimiter {
  private readonly entries = new Map<string, AttemptWindow>();

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 15 * 60_000,
    private readonly blockMs = 15 * 60_000,
  ) {}

  canAttempt(key: string, now = Date.now()) {
    const entry = this.entries.get(key);
    if (!entry) return true;
    if (entry.blockedUntil && entry.blockedUntil > now) return false;
    if (now - entry.windowStartedAt >= this.windowMs) this.entries.delete(key);
    return true;
  }

  recordFailure(key: string, now = Date.now()) {
    const current = this.entries.get(key);
    const entry = !current || now - current.windowStartedAt >= this.windowMs
      ? { attempts: 0, windowStartedAt: now }
      : current;
    entry.attempts += 1;
    if (entry.attempts >= this.maxAttempts) entry.blockedUntil = now + this.blockMs;
    this.entries.set(key, entry);
  }

  recordSuccess(key: string) {
    this.entries.delete(key);
  }
}

export const loginAttemptLimiter = new InMemoryLoginAttemptLimiter();

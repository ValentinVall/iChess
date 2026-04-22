import type { Request, Response, NextFunction } from 'express';

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const registrationAttempts = new Map<string, RateLimitEntry>();

const REGISTRATION_WINDOW_MS = 15 * 60 * 1000;
const REGISTRATION_MAX_ATTEMPTS = 5;

function getClientKey(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0]?.trim() || req.ip || 'unknown';
  }

  return req.ip || 'unknown';
}

function clearExpiredEntries(now: number) {
  for (const [key, entry] of registrationAttempts.entries()) {
    if (entry.resetAt <= now) {
      registrationAttempts.delete(key);
    }
  }
}

export function registerRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  clearExpiredEntries(now);

  const clientKey = getClientKey(req);
  const currentEntry = registrationAttempts.get(clientKey);

  if (!currentEntry || currentEntry.resetAt <= now) {
    registrationAttempts.set(clientKey, {
      count: 1,
      resetAt: now + REGISTRATION_WINDOW_MS,
    });
    return next();
  }

  if (currentEntry.count >= REGISTRATION_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((currentEntry.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    return res.status(429).json({
      error: 'Too many registration attempts. Please try again later.',
      retryAfterSeconds,
    });
  }

  currentEntry.count += 1;
  registrationAttempts.set(clientKey, currentEntry);
  return next();
}
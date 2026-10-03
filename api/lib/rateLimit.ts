const rateLimitMap = new Map<string, number[]>();

export function checkRateLimit(key: string, maxAttempts = 5, windowSeconds = 180): { allowed: boolean; remainingSec: number } {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  let timestamps = rateLimitMap.get(key) || [];
  // Prune timestamps outside window
  timestamps = timestamps.filter(t => now - t < windowMs);

  if (timestamps.length >= maxAttempts) {
    const oldest = timestamps[0];
    const remainingSec = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    rateLimitMap.set(key, timestamps);
    return { allowed: false, remainingSec };
  }

  timestamps.push(now);
  rateLimitMap.set(key, timestamps);
  return { allowed: true, remainingSec: 0 };
}

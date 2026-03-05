type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export const allowRateLimit = (key: string, maxPerMinute: number): boolean => {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }

  if (bucket.count >= maxPerMinute) {
    return false;
  }

  bucket.count += 1;
  return true;
};

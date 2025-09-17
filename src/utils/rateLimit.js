import redis from "../redis.js";

export async function rateLimit(key, limit = 5, ttl = 1) {
  // key: unique key for device or client
  // limit: max requests
  // ttl: time window in seconds

  const current = await redis.incr(key); 
  if (current === 1) {
    await redis.expire(key, ttl); 
  }

  if (current > limit) {
    return false; // rate limit exceeded
  }
  return true; 
}

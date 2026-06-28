const { config } = require('../config');
const { redis } = require('../redis');

function getClientId(req) {
  return req.ip || req.headers['x-forwarded-for'] || 'unknown';
}

async function rateLimiter(req, res, next) {
  const clientId = getClientId(req);
  const key = `rate_limit:shorten:${clientId}`;

  try {
    const currentCount = await redis.incr(key);

    if (currentCount === 1) {
      await redis.expire(key, config.rateLimitWindowSeconds);
    }

    if (currentCount > config.rateLimitMaxRequests) {
      const ttl = await redis.ttl(key);

      return res.status(429).json({
        error: 'Too many requests. Please slow down for a moment.',
        retryAfterSeconds: ttl
      });
    }

    res.setHeader('X-RateLimit-Limit', config.rateLimitMaxRequests);
    res.setHeader(
      'X-RateLimit-Remaining',
      Math.max(config.rateLimitMaxRequests - currentCount, 0)
    );

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { rateLimiter };

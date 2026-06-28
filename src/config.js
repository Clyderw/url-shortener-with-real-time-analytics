require('dotenv').config();

const config = {
  port: Number(process.env.PORT || 3000),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  databaseUrl:
    process.env.DATABASE_URL ||
    'postgres://postgres:postgres@localhost:5432/url_shortener',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  rateLimitWindowSeconds: Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 60),
  rateLimitMaxRequests: Number(process.env.RATE_LIMIT_MAX_REQUESTS || 10),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS || 3600)
};

module.exports = { config };

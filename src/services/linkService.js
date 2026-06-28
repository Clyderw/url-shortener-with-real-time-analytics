const { config } = require('../config');
const { createLink, findLinkByCode } = require('../db');
const { redis } = require('../redis');
const { randomCode } = require('../utils/hash');

const CODE_ATTEMPTS = 5;

function cacheKey(code) {
  return `url:${code}`;
}

function clicksKey(code) {
  return `clicks:${code}`;
}

async function shortenUrl(longUrl) {
  for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
    const code = randomCode();
    const created = await createLink(code, longUrl);

    if (created) {
      await redis.set(cacheKey(code), longUrl, {
        EX: config.cacheTtlSeconds
      });

      return {
        code,
        longUrl,
        shortUrl: `${config.baseUrl}/${code}`
      };
    }
  }

  throw new Error('Could not generate a unique short code. Please try again.');
}

async function resolveUrl(code) {
  const cachedUrl = await redis.get(cacheKey(code));

  if (cachedUrl) {
    return {
      longUrl: cachedUrl,
      source: 'redis-cache'
    };
  }

  const link = await findLinkByCode(code);

  if (!link) {
    return null;
  }

  await redis.set(cacheKey(code), link.long_url, {
    EX: config.cacheTtlSeconds
  });

  return {
    longUrl: link.long_url,
    source: 'postgres'
  };
}

async function trackClick(code) {
  const totalClicks = await redis.incr(clicksKey(code));
  await redis.zIncrBy('popular_urls', 1, code);
  return totalClicks;
}

async function getAnalytics(code) {
  const link = await findLinkByCode(code);

  if (!link) {
    return null;
  }

  const clicks = Number((await redis.get(clicksKey(code))) || 0);
  const rank = await redis.zRevRank('popular_urls', code);

  return {
    code,
    longUrl: link.long_url,
    shortUrl: `${config.baseUrl}/${code}`,
    createdAt: link.created_at,
    clicks,
    popularityRank: rank === null ? null : rank + 1
  };
}

module.exports = {
  shortenUrl,
  resolveUrl,
  trackClick,
  getAnalytics
};

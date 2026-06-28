# URL Shortener with Real-Time Analytics

This is a small but realistic URL shortener built around Redis.

The idea is simple: PostgreSQL keeps the permanent copy of every short link, while Redis handles the busy work that needs to be fast: caching hot links, rate limiting new shorten requests, and counting clicks live with `INCR`.

It is not trying to be a giant production platform, but the shape is the same one you would use when traffic starts to matter.

## What This Project Does

- Turns a long URL into a short URL like `http://localhost:3000/a8KqP2x`
- Redirects short URLs back to the original long URL
- Stores the durable URL mapping in PostgreSQL
- Caches short URL lookups in Redis so popular links do not keep hitting PostgreSQL
- Limits users to 10 shorten requests per minute by default
- Tracks live click counts in Redis every time a short URL is visited
- Exposes a small analytics endpoint for each link

## Why Redis Is Useful Here

Redis is great when the answer needs to come back very quickly and the data is simple.

In this app, Redis has three jobs:

1. **Cache hot URLs**

   When someone visits `/abc123`, the app first asks Redis:

   ```text
   url:abc123 -> https://example.com/some/very/long/page
   ```

   If Redis has it, the redirect can happen immediately. If Redis does not have it, the app falls back to PostgreSQL, then saves the result back into Redis for next time.

2. **Rate limit API users**

   Every shorten request increments a Redis key tied to the caller:

   ```text
   rate_limit:shorten:<ip-address>
   ```

   The key expires after 60 seconds. If the counter goes above 10 before it expires, the API returns `429 Too Many Requests`.

3. **Count clicks live**

   Every redirect runs:

   ```text
   INCR clicks:abc123
   ```

   That gives us a live click count without waiting for a database write. The app also updates a Redis sorted set called `popular_urls`, which makes it easy to rank links by traffic later.

## Tech Stack

- Node.js
- Express
- Redis
- PostgreSQL
- Docker Compose for local Redis and PostgreSQL

## Project Structure

```text
.
├── docker-compose.yml
├── package.json
├── scripts/
│   └── migrate.js
├── sql/
│   └── schema.sql
└── src/
    ├── config.js
    ├── db.js
    ├── redis.js
    ├── middleware/
    │   └── rateLimiter.js
    ├── routes/
    │   └── links.js
    ├── services/
    │   └── linkService.js
    ├── utils/
    │   └── hash.js
    └── server.js
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Start Redis and PostgreSQL

```bash
docker compose up -d
```

This starts:

- Redis on `localhost:6379`
- PostgreSQL on `localhost:5432`

### 3. Create your environment file

```bash
cp .env.example .env
```

The defaults are already set up for the Docker Compose services, so you usually do not need to change anything.

### 4. Run the database migration

```bash
npm run migrate
```

This creates the `links` table in PostgreSQL.

### 5. Start the API

```bash
npm run dev
```

The app will run at:

```text
http://localhost:3000
```

## Trying It Out

### Health check

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "postgres": "connected",
  "redis": "connected"
}
```

### Shorten a URL

```bash
curl -X POST http://localhost:3000/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"longUrl":"https://redis.io/docs/latest/"}'
```

Example response:

```json
{
  "code": "a8KqP2x",
  "longUrl": "https://redis.io/docs/latest/",
  "shortUrl": "http://localhost:3000/a8KqP2x"
}
```

### Visit the short URL

```bash
curl -I http://localhost:3000/a8KqP2x
```

The response will be a `302` redirect to the original URL.

You will also see two useful headers:

```text
X-URL-Source: redis-cache
X-Live-Clicks: 1
```

`X-URL-Source` tells you whether the redirect came from Redis or PostgreSQL. The first request after a cache miss may say `postgres`; later requests should say `redis-cache`.

### Check analytics

```bash
curl http://localhost:3000/api/links/a8KqP2x/analytics
```

Example response:

```json
{
  "code": "a8KqP2x",
  "longUrl": "https://redis.io/docs/latest/",
  "shortUrl": "http://localhost:3000/a8KqP2x",
  "createdAt": "2026-06-28T00:00:00.000Z",
  "clicks": 3,
  "popularityRank": 1
}
```

## API Reference

### `POST /api/shorten`

Creates a new short URL.

Request body:

```json
{
  "longUrl": "https://example.com"
}
```

Success response:

```json
{
  "code": "abc1234",
  "longUrl": "https://example.com",
  "shortUrl": "http://localhost:3000/abc1234"
}
```

Rate limit:

- Default: 10 requests per minute
- Backed by Redis
- Configurable with `RATE_LIMIT_WINDOW_SECONDS` and `RATE_LIMIT_MAX_REQUESTS`

### `GET /:code`

Redirects to the original long URL.

Behind the scenes:

1. Check Redis cache
2. If missing, read from PostgreSQL
3. Store the result back in Redis
4. Increment the Redis click counter
5. Redirect the user

### `GET /api/links/:code/analytics`

Returns live analytics for one short URL.

The click number comes from Redis, so it updates immediately after redirects.

### `GET /health`

Checks whether the API can talk to PostgreSQL and Redis.

## Configuration

All configuration comes from environment variables.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3000` | API port |
| `BASE_URL` | `http://localhost:3000` | Base URL used when returning short links |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/url_shortener` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `RATE_LIMIT_WINDOW_SECONDS` | `60` | Rate limit window |
| `RATE_LIMIT_MAX_REQUESTS` | `10` | Max shorten requests per window |
| `CACHE_TTL_SECONDS` | `3600` | How long cached URL mappings stay in Redis |

## A Note About Scaling

The redirect path is intentionally Redis-first because redirects are the hottest part of a URL shortener. In a real deployment, a popular link might be clicked thousands of times per minute. There is no reason to ask PostgreSQL for the same long URL over and over when Redis can keep that answer nearby.

PostgreSQL is still important. Redis is fast, but PostgreSQL is the durable source of truth for the URL mapping. If Redis restarts or a cache key expires, the app can rebuild the cache from the database.

For a larger production version, I would add:

- A background worker that periodically flushes Redis click counts into PostgreSQL
- Per-user accounts and API keys
- Custom aliases
- Expiration dates for links
- Abuse detection for malicious URLs
- Separate Redis clusters for caching, rate limits, and analytics if traffic gets very high

## Stopping Everything

```bash
docker compose down
```

If you also want to remove local database and Redis data:

```bash
docker compose down -v
```

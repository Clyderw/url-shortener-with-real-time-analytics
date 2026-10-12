# URL Shortener with Redis Analytics

A Node.js/Express learning project for URL shortening, redirects and click analytics. PostgreSQL stores URL mappings; Redis handles lookup caching, per-IP request limits, click counts and popularity ranking. Docker Compose starts the two databases locally.

## Run locally

Requires Node.js 20+ and Docker Compose.

```sh
npm install
docker compose up -d
cp .env.example .env
npm run migrate
npm start
```

Use the supplied `.env.example` for configuration. Compose uses local development credentials; do not reuse them on a public deployment.

```sh
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/shorten -H 'Content-Type: application/json' -d '{"longUrl":"https://example.com"}'
# Replace CODE with the returned code:
curl -i http://localhost:3000/CODE
curl http://localhost:3000/api/links/CODE/analytics
```

## Request flow

- `POST /api/shorten`: accept an HTTP(S) URL, enforce the per-IP limit, retry code collisions and persist the mapping in PostgreSQL before caching it.
- `GET /:code`: check Redis first, fall back to PostgreSQL, fill the cache and count the redirect.
- `GET /api/links/:code/analytics`: return the stored URL plus the live Redis click count and popularity rank.

Redirect responses expose `X-URL-Source` and `X-Live-Clicks`. Defaults: ten shorten requests per IP per 60 seconds and a 3,600-second lookup cache TTL.

## Tests

```sh
npm test
```

Nine offline service tests cover cache hits and misses, unknown links, persistence, bounded collision retries, click counting and analytics. They use mocked database and Redis boundaries and the built-in Node test runner; they do not require Docker or install dependencies. They do not replace live database or HTTP integration tests.

## Configuration

`PORT`, `BASE_URL`, `DATABASE_URL`, `REDIS_URL`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX_REQUESTS` and `CACHE_TTL_SECONDS` are read in `src/config.js`.

## Limitations

This is a learning project, not a hardened public service. Redis availability is currently required; rate-limit and popularity state live there. There are no user accounts, abuse-reporting flows, URL expiry or production deployment configuration. The request/response API polls analytics; it does not use WebSockets. Keep environment files and real credentials out of Git.

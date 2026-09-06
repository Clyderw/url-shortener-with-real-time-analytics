#URL Shortener with Real-Time Analytics

This is a small but realistic URL shortener built around Redis.

The idea is that PostgreSQL stores the permenent record of every short URL, whereas Redis handles the busy work that is more I/O bound. Cache hot URL's, rate-limit new shorten request, and count the clicks live using Redis INCR.

This is not being built out as an enormous production platform however; it shape is exactly the same shape one would reach when traffic really starts to matter.

What this project does

- Turn a long URL into a short URL like, http://localhost:3000/a8KqP2x
- Redirect short URLs back to a long URL
- Persist long URL mappings in PostgreSQL
- Cache short URL lookups so that hot URL's do not always hit PostgreSQL.
- Default rate limits new shorten requests at 10 URL's per minute per IP address.
- Maintain live count of total clicks for each short URL in Redis.
- Provide a simple endpoint that will display live analytics for a single URL

Why this could be useful with Redis

Redis makes things fast. When the answer needs to return in a blur, or there isn't a massive amount of state in each record, Redis is your guy. Redis here has three main uses:

1. Caching hot URL's

Whenever the app gets hit at /abc123, it will first askRedis:

``text

url:abc123 -> https://example.com/long/page/and/many/others

`

if Redis has the response, the user's browser can redirect them immediately. If Redis doesn't have it, the app can fallback and query PostgreSQL, before saving the returned data into Redis for the next time somebody asks.

2. Rate Limiting API Users

Every time that someone requests to create a new shorten link, their IP address gets a rate limited counter by Redis:

`text

rate_limit:shorten: -> count value

`

Each key expires by default at 60s, which means they can hit the API 10 times max a minute. If their IP exceeds the max requests, we'll simply return 429.

3. Counting clicks live

Redis will INCR it's internal counter every time someone uses the shortened link. This is really simple, gives a live count of clicks without having to do an expensive DB write per-click. Also store a Redis sorted set labeled popular\_urls which makes it incredibly simple to sort by link clicks when needed.

Tech stack

- Node.js

- Express

- Redis

- PostgreSQL

- Docker Compose to run Redis + PostgreSQL local databases.

Project structure

`text

.

Docker-compose.yml

package.json

scripts/

migrate.js

sql/

schema.sql

src/

config.js

db.js

redis.js

middleware/

rateLimiter.js

routes/

links.js

services/

linkService.js

utils/

hash.js

server.js

`

Getting started

### 1. Install dependencies

`bash

npm install

`

### 2. Start Redis and PostgreSQL

`bash

docker compose up -d

`

This will bring up Redis on port 6379 and PostgreSQL on port 5432.

### 3. Create an environment file

`bash

cp .env.example .env

`

You will need to fill out the environment variables below. Defaults usually cover well enough when you're just starting out and using docker compose.

### 4. Run migrations

`bash

npm run migrate

`

This sets up a basic links table to your PostgreSQL database.

### 5. Start the API

`bash

npm run dev

`

The API will start up on port 3000.

Trying It Out

### Health check

`bash

curl http://localhost:3000/health

`

### Shorten a URL

`bash

curl -X POST http://localhost:3000/api/shorten -H 'Content-Type: application/json' -d '{"longUrl":"https://redis.io/docs/latest/"}'

`

### Use the short URL

`bash

curl -I http://localhost:3000/a8KqP2x

`

You will get a 302 Found, redirecting to the longUrl, with a few helpful headers:

`text

X-URL-Source: redis-cache

X-Live-Clicks: 1

`

This shows that the URL was found from Redis, and that this is the first click. The very first request when a URL has never been viewed, will have 'postgres' here.

### Check the analytics

`bash

curl http://localhost:3000/api/links/a8KqP2x/analytics

`

### API endpoints

POST /api/shorten

Creates a new short URL. Takes longUrl as input, returns the generated code, longUrl, and a shortUrl. Rate limited at 10 URL's per minute per IP.

`json

{

"code": "a8KqP2x",

"longUrl": "https://redis.io/docs/latest/",

"shortUrl": "http://localhost:3000/a8KqP2x"

}

`

GET /:code

Redirects a short URL back to the long URL.

1. Check Redis cache

2. Fallback to PostgreSQL if Redis misses

3. Store data back to cache

4. Record the click in Redis

5. Redirect.

GET /api/links/:code/analytics

Returns the longUrl, shortUrl, code, creation date, clicks, and popularityRank for a given short URL. The clicks value is from Redis.

### Configuration

The API is configurable via environment variables.

| Variable | Default | What it does |

| :------------------------ | :-------- | :-------------------------------------------- |
| PORT | 3000 | Port that the application runs on |
| BASE_URL | http://localhost:3000 | The base URL returned in short links |
| DATABASE_URL | | The database URL for PostgreSQL connection. |
| REDIS_URL | | The connection url to Redis. |
| RATELIMITWINDOW_SECONDS | 60 | How many seconds a rate limit window lasts |
| RATELIMITMAX_REQUESTS | 10 | Max number of shorten requests allowed within a single window |
| CACHETTLSECONDS | 3600 | Time to live before a cached entry expires |

A note on scaling

The redirect path must use a cache (Redis, in our case) because this is the most IO-bound part of the system. In production, an IP might hit a given URL dozens, or hundreds of thousands of times a minute, and there's no need to go ask PostgreSQL each time.
The database serves as our persistent storage, and also for fall-back, or ifRedis fails a given data record.

To handle more production scale:

- A Redis background job to dump popular click counts into the database, or directly increment a counter in PostgreSQL when an index is maintained in Redis.
- API keys and accounts for users.
- Support for custom url aliases.
- TTL on URL's that expire after time.
- Abuse detection for bad domains and usage patterns.
- Potentially different Redis deployments, to split cache, rate limiting and analytics data, in the case the performance becomes extreme.

Shutting down

`bash

docker compose down

`

To take down everything and delete your local data:

`bash

docker compose down -v

``


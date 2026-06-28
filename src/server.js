const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const { config } = require('./config');
const { connectRedis, redis } = require('./redis');
const { pool } = require('./db');
const { router } = require('./routes/links');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', async (req, res, next) => {
  try {
    await pool.query('SELECT 1');
    await redis.ping();

    res.json({
      status: 'ok',
      postgres: 'connected',
      redis: 'connected'
    });
  } catch (error) {
    next(error);
  }
});

app.use(router);

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) {
    return next(error);
  }

  return res.status(500).json({
    error: 'Something went wrong. Please try again.'
  });
});

async function start() {
  await connectRedis();

  app.listen(config.port, () => {
    console.log(`URL shortener is running on ${config.baseUrl}`);
  });
}

process.on('SIGINT', async () => {
  await redis.quit();
  await pool.end();
  process.exit(0);
});

start().catch((error) => {
  console.error('Server failed to start:', error);
  process.exit(1);
});

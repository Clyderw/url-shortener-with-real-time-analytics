const express = require('express');
const { rateLimiter } = require('../middleware/rateLimiter');
const {
  getAnalytics,
  resolveUrl,
  shortenUrl,
  trackClick
} = require('../services/linkService');

const router = express.Router();

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

router.post('/api/shorten', rateLimiter, async (req, res, next) => {
  try {
    const { longUrl } = req.body;

    if (!longUrl || !isValidUrl(longUrl)) {
      return res.status(400).json({
        error: 'Please send a valid http or https URL in the longUrl field.'
      });
    }

    const shortened = await shortenUrl(longUrl);
    return res.status(201).json(shortened);
  } catch (error) {
    return next(error);
  }
});

router.get('/api/links/:code/analytics', async (req, res, next) => {
  try {
    const analytics = await getAnalytics(req.params.code);

    if (!analytics) {
      return res.status(404).json({ error: 'Short URL not found.' });
    }

    return res.json(analytics);
  } catch (error) {
    return next(error);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const resolved = await resolveUrl(req.params.code);

    if (!resolved) {
      return res.status(404).json({ error: 'Short URL not found.' });
    }

    const clicks = await trackClick(req.params.code);

    res.setHeader('X-URL-Source', resolved.source);
    res.setHeader('X-Live-Clicks', clicks);
    return res.redirect(302, resolved.longUrl);
  } catch (error) {
    return next(error);
  }
});

module.exports = { router };

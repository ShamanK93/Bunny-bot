import { Router } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { askBunny } from '../claude.js';
import { recordMessage, DEMO_API_KEY } from '../db.js';

const router = Router();

// The demo client's apiKey is public (embedded on the landing page), so
// anyone could hammer it. Cap it per IP instead of leaving it wide open.
const DEMO_RATE_LIMIT = 12; // messages per IP per hour
const demoUsage = new Map(); // ip -> { count, resetAt }

function demoRateLimited(ip) {
  const now = Date.now();
  const entry = demoUsage.get(ip);
  if (!entry || entry.resetAt < now) {
    demoUsage.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  entry.count += 1;
  return entry.count > DEMO_RATE_LIMIT;
}

router.post('/', apiKeyAuth, async (req, res) => {
  const { message, history = [], isNewConversation = false } = req.body;
  const client = req.client;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'missing_message' });
  }

  if (client.apiKey === DEMO_API_KEY) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
    if (demoRateLimited(ip)) {
      return res.status(429).json({
        error: 'demo_rate_limited',
        message: 'Trop de messages sur la démo publique — réessayez dans un moment, ou créez votre propre compte.',
      });
    }
  }

  try {
    const reply = await askBunny({
      businessName: client.businessName,
      courseContext: client.courseContext,
      history,
      message,
    });

    await recordMessage(client.id, { isNewConversation });

    res.json({ reply });
  } catch (err) {
    console.error('[chat] error:', err.message);
    res.status(502).json({
      error: 'upstream_error',
      message: "L'assistant est momentanément indisponible.",
    });
  }
});

// Public config endpoint so the widget can fetch colors/welcome message
// without exposing anything sensitive.
router.get('/config', apiKeyAuth, (req, res) => {
  const { widgetConfig } = req.client;
  res.json({ widgetConfig });
});

export default router;

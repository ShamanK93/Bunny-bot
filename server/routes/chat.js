import { Router } from 'express';
import { apiKeyAuth } from '../middleware/apiKeyAuth.js';
import { askBunny } from '../claude.js';
import { recordMessage } from '../db.js';

const router = Router();

router.post('/', apiKeyAuth, async (req, res) => {
  const { message, history = [], isNewConversation = false } = req.body;
  const client = req.client;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'missing_message' });
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

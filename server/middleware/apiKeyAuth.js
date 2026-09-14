import { getClientByApiKey, isSubscriptionActive } from '../db.js';

export async function apiKeyAuth(req, res, next) {
  const apiKey = req.header('x-api-key') || req.body?.apiKey;

  if (!apiKey) {
    return res.status(401).json({ error: 'missing_api_key' });
  }

  const client = await getClientByApiKey(apiKey);

  if (!client) {
    return res.status(401).json({ error: 'invalid_api_key' });
  }

  if (!isSubscriptionActive(client)) {
    return res.status(402).json({
      error: 'subscription_inactive',
      message: 'Abonnement expiré ou inactif.',
    });
  }

  req.client = client;
  next();
}

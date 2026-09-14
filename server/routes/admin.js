import { Router } from 'express';
import { adminAuth } from '../middleware/adminAuth.js';
import {
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  isSubscriptionActive,
} from '../db.js';

const router = Router();
router.use(adminAuth);

function toSummary(client) {
  return {
    id: client.id,
    businessName: client.businessName,
    email: client.email,
    apiKey: client.apiKey,
    status: client.subscription.status,
    active: isSubscriptionActive(client),
    trialEndsAt: client.subscription.trialEndsAt,
    messagesTotal: client.stats.messagesTotal,
    conversationsTotal: client.stats.conversationsTotal,
    createdAt: client.createdAt,
  };
}

router.get('/clients', async (req, res) => {
  const clients = await getAllClients();
  res.json(clients.map(toSummary));
});

router.get('/clients/:id', async (req, res) => {
  const client = await getClientById(req.params.id);
  if (!client) return res.status(404).json({ error: 'not_found' });
  res.json(client);
});

router.patch('/clients/:id', async (req, res) => {
  const { businessName, courseContext, widgetConfig } = req.body;
  const patch = {};
  if (businessName !== undefined) patch.businessName = businessName;
  if (courseContext !== undefined) patch.courseContext = courseContext;
  if (widgetConfig !== undefined) patch.widgetConfig = widgetConfig;

  const client = await updateClient(req.params.id, patch);
  if (!client) return res.status(404).json({ error: 'not_found' });
  res.json(toSummary(client));
});

// Manual revocation (e.g. abuse, non-payment handled outside Stripe)
router.post('/clients/:id/revoke', async (req, res) => {
  const client = await getClientById(req.params.id);
  if (!client) return res.status(404).json({ error: 'not_found' });
  client.subscription.status = 'canceled';
  await updateClient(req.params.id, { subscription: client.subscription });
  res.json(toSummary(client));
});

router.delete('/clients/:id', async (req, res) => {
  await deleteClient(req.params.id);
  res.json({ deleted: true });
});

export default router;

import { Router } from 'express';
import Stripe from 'stripe';
import {
  getClientByEmail,
  verifyClientPassword,
  createSession,
  deleteSession,
  updateClient,
  isSubscriptionActive,
} from '../db.js';
import { portalAuth } from '../middleware/portalAuth.js';

const router = Router();

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
};

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  const client = await getClientByEmail(email);
  const valid = client ? await verifyClientPassword(client, password) : false;

  if (!valid) {
    return res.status(401).json({ error: 'invalid_credentials', message: 'Email ou mot de passe incorrect.' });
  }

  const token = await createSession(client.id);
  res.cookie('bb_session', token, COOKIE_OPTS);
  res.json({ ok: true });
});

router.post('/logout', portalAuth, async (req, res) => {
  await deleteSession(req.sessionToken);
  res.clearCookie('bb_session');
  res.json({ ok: true });
});

router.get('/me', portalAuth, (req, res) => {
  const c = req.client;
  res.json({
    id: c.id,
    businessName: c.businessName,
    email: c.email,
    apiKey: c.apiKey,
    courseContext: c.courseContext,
    widgetConfig: c.widgetConfig,
    status: c.subscription.status,
    active: isSubscriptionActive(c),
    trialEndsAt: c.subscription.trialEndsAt,
    hasStripeCustomer: !!c.subscription.stripeCustomerId,
  });
});

router.patch('/me', portalAuth, async (req, res) => {
  const { businessName, courseContext, widgetConfig } = req.body;
  const patch = {};
  if (businessName !== undefined) patch.businessName = businessName;
  if (courseContext !== undefined) patch.courseContext = courseContext;
  if (widgetConfig !== undefined) patch.widgetConfig = widgetConfig;

  const updated = await updateClient(req.client.id, patch);
  res.json({ ok: true, widgetConfig: updated.widgetConfig });
});

// Hands off to Stripe's own hosted billing portal — the client manages
// their card, invoices, and cancellation there, not in our own UI.
router.post('/billing-session', portalAuth, async (req, res) => {
  const client = req.client;

  if (!client.subscription.stripeCustomerId) {
    return res.status(400).json({
      error: 'no_stripe_customer',
      message: "Aucun abonnement payant actif pour ce compte pour l'instant.",
    });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({ error: 'stripe_not_configured' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.billingPortal.sessions.create({
      customer: client.subscription.stripeCustomerId,
      return_url: `${process.env.APP_URL}/portal/`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('[portal billing-session] error:', err.message);
    res.status(500).json({ error: 'stripe_error', message: err.message });
  }
});

export default router;

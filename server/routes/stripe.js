import { Router } from 'express';
import Stripe from 'stripe';
import {
  getClientByStripeCustomerId,
  updateClientSubscription,
} from '../db.js';

const router = Router();

// NOTE: this route must receive the *raw* body (see server/index.js),
// because Stripe verifies the webhook signature against the raw bytes.
router.post('/webhook', async (req, res) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send('Stripe non configuré');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[stripe webhook] signature invalid:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const obj = event.data.object;

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const client = await getClientByStripeCustomerId(obj.customer);
        if (client) {
          await updateClientSubscription(client.id, {
            status: obj.status, // trialing | active | past_due | canceled | unpaid
            stripeSubscriptionId: obj.id,
            planId: obj.items.data[0]?.price?.id || null,
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const client = await getClientByStripeCustomerId(obj.customer);
        if (client) {
          await updateClientSubscription(client.id, { status: 'canceled' });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const client = await getClientByStripeCustomerId(obj.customer);
        if (client) {
          await updateClientSubscription(client.id, { status: 'past_due' });
        }
        break;
      }
      default:
        break; // ignore anything we don't act on
    }
    res.json({ received: true });
  } catch (err) {
    console.error('[stripe webhook] handling error:', err.message);
    res.status(500).send('Webhook handling failed');
  }
});

export default router;

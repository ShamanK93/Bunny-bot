import { Router } from 'express';
import Stripe from 'stripe';
import { createClient, updateClientSubscription } from '../db.js';

const router = Router();

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY manquant dans .env');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

// Step 1: create the client record (14-day trial) + a Stripe customer,
// then return a Checkout session URL for the paid plan.
router.post('/', async (req, res) => {
  const { businessName, email, courseContext } = req.body;

  if (!businessName || !email) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  try {
    const client = await createClient({ businessName, email, courseContext });

    // If Stripe isn't configured yet, still let them start their trial
    // so local/dev testing doesn't require live keys.
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PRICE_ID) {
      return res.json({
        client: { id: client.id, apiKey: client.apiKey },
        checkoutUrl: null,
        message: 'Stripe non configuré — essai gratuit démarré sans paiement.',
      });
    }

    const stripe = getStripe();
    const customer = await stripe.customers.create({
      email,
      name: businessName,
      metadata: { clientId: client.id },
    });

    await updateClientSubscription(client.id, {
      stripeCustomerId: customer.id,
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      subscription_data: {
        trial_period_days: 14,
        metadata: { clientId: client.id },
      },
      success_url: `${process.env.APP_URL}/signup/success.html?client=${client.id}`,
      cancel_url: `${process.env.APP_URL}/signup/`,
      metadata: { clientId: client.id },
    });

    res.json({
      client: { id: client.id, apiKey: client.apiKey },
      checkoutUrl: session.url,
    });
  } catch (err) {
    console.error('[signup] error:', err.message);
    res.status(500).json({ error: 'signup_failed', message: err.message });
  }
});

export default router;

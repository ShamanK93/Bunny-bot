import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { initDb } from './db.js';
import chatRoutes from './routes/chat.js';
import signupRoutes from './routes/signup.js';
import adminRoutes from './routes/admin.js';
import stripeRoutes from './routes/stripe.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());

// Stripe webhooks need the RAW body for signature verification, so this
// route is mounted BEFORE the JSON body-parser.
app.use('/api/stripe', stripeRoutes);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/chat', chatRoutes);
app.use('/api/signup', signupRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`🐰 BunnyBot server running on http://localhost:${PORT}`);
    console.log(`   Dashboard: http://localhost:${PORT}/dashboard/`);
    console.log(`   Signup:    http://localhost:${PORT}/signup/`);
  });
});

import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dataFile = path.join(dataDir, 'db.json');

// Ensure the data directory exists — it's gitignored (only db.json itself
// is ignored, but if the folder was never committed it won't exist on a
// fresh clone/deploy), so create it defensively before lowdb touches it.
mkdirSync(dataDir, { recursive: true });

const defaultData = { clients: [], sessions: [] };
const adapter = new JSONFile(dataFile);
const db = new Low(adapter, defaultData);

export async function initDb() {
  await db.read();
  db.data ||= defaultData;
  db.data.sessions ||= [];
  await db.write();
}

export function generateApiKey() {
  return 'bb_live_' + randomBytes(18).toString('hex');
}

export function generateId() {
  return randomBytes(8).toString('hex');
}

// --- Client CRUD -----------------------------------------------------

export async function createClient({ businessName, email, courseContext, password }) {
  await db.read();
  const passwordHash = await bcrypt.hash(password, 10);
  const client = {
    id: generateId(),
    businessName,
    email,
    passwordHash,
    apiKey: generateApiKey(),
    courseContext: courseContext || '',
    widgetConfig: {
      welcomeMessage: `Bonjour ! Je suis l'assistant de ${businessName}. Comment puis-je vous aider ?`,
      accentColor: '#1A1640',
      botName: 'BunnyBot',
      iconStyle: 'chat', // 'chat' | 'bubble' | 'message' | 'bunny'
      quickReplies: ['Quel est le prix ?', "Comment ça s'installe ?", 'Puis-je annuler à tout moment ?'],
    },
    subscription: {
      status: 'trialing', // trialing | active | past_due | canceled
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planId: null,
      trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
    },
    stats: { messagesTotal: 0, conversationsTotal: 0 },
    createdAt: Date.now(),
  };
  db.data.clients.push(client);
  await db.write();
  return client;
}

export async function getAllClients() {
  await db.read();
  return db.data.clients;
}

export async function getClientById(id) {
  await db.read();
  return db.data.clients.find((c) => c.id === id) || null;
}

export async function getClientByEmail(email) {
  await db.read();
  return (
    db.data.clients.find(
      (c) => c.email.toLowerCase() === String(email).toLowerCase()
    ) || null
  );
}

export async function getClientByApiKey(apiKey) {
  await db.read();
  return db.data.clients.find((c) => c.apiKey === apiKey) || null;
}

export async function getClientByStripeCustomerId(stripeCustomerId) {
  await db.read();
  return (
    db.data.clients.find(
      (c) => c.subscription.stripeCustomerId === stripeCustomerId
    ) || null
  );
}

export async function updateClient(id, patch) {
  await db.read();
  const client = db.data.clients.find((c) => c.id === id);
  if (!client) return null;
  Object.assign(client, patch);
  await db.write();
  return client;
}

export async function updateClientSubscription(id, subPatch) {
  await db.read();
  const client = db.data.clients.find((c) => c.id === id);
  if (!client) return null;
  Object.assign(client.subscription, subPatch);
  await db.write();
  return client;
}

export async function deleteClient(id) {
  await db.read();
  db.data.clients = db.data.clients.filter((c) => c.id !== id);
  await db.write();
}

export async function recordMessage(id, { isNewConversation }) {
  await db.read();
  const client = db.data.clients.find((c) => c.id === id);
  if (!client) return;
  client.stats.messagesTotal += 1;
  if (isNewConversation) client.stats.conversationsTotal += 1;
  await db.write();
}

export function isSubscriptionActive(client) {
  if (!client) return false;
  const { status, trialEndsAt } = client.subscription;
  if (status === 'active') return true;
  if (status === 'trialing') return Date.now() < trialEndsAt;
  return false;
}

// --- Public demo client (showcases BunnyBot on its own landing page) --

export const DEMO_API_KEY = 'bb_demo_bunnybot_showcase_public_key';

export async function ensureDemoClient() {
  await db.read();
  let demo = db.data.clients.find((c) => c.id === 'demo-bunnybot');
  if (demo) {
    var changed = false;
    if (!demo.widgetConfig.quickReplies) {
      demo.widgetConfig.quickReplies = ['Combien ça coûte ?', "Comment ça s'installe ?", 'Puis-je annuler à tout moment ?'];
      changed = true;
    }
    if (demo.widgetConfig.iconStyle !== 'chat') {
      demo.widgetConfig.iconStyle = 'chat';
      changed = true;
    }
    if (changed) await db.write();
    return demo;
  }

  demo = {
    id: 'demo-bunnybot',
    businessName: 'BunnyBot',
    email: 'demo@bunnybot.internal',
    passwordHash: null,
    apiKey: DEMO_API_KEY,
    courseContext:
      "BunnyBot est un chatbot pour créateurs de formations en ligne. Il s'installe en une ligne de code sur un site, répond aux questions des visiteurs uniquement à partir du contenu fourni par le créateur (jamais d'invention), 24h/24. Tarif : 39€/mois après un essai gratuit de 14 jours sans carte bancaire. Résiliable à tout moment. Propulsé par l'API Claude, facturation par Stripe.",
    widgetConfig: {
      welcomeMessage: "Bonjour ! Posez-moi une question sur BunnyBot, comme le feraient vos futurs visiteurs.",
      accentColor: '#1A1640',
      botName: 'BunnyBot',
      iconStyle: 'chat',
      quickReplies: ['Combien ça coûte ?', "Comment ça s'installe ?", 'Puis-je annuler à tout moment ?'],
    },
    subscription: {
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planId: null,
      trialEndsAt: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
    },
    stats: { messagesTotal: 0, conversationsTotal: 0 },
    createdAt: Date.now(),
  };
  db.data.clients.push(demo);
  await db.write();
  return demo;
}

// --- Client portal auth (separate from the public widget apiKey) -----

export async function verifyClientPassword(client, password) {
  if (!client?.passwordHash) return false;
  return bcrypt.compare(password, client.passwordHash);
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(clientId) {
  await db.read();
  const token = randomBytes(32).toString('hex');
  db.data.sessions.push({
    token,
    clientId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  await db.write();
  return token;
}

export async function getClientBySessionToken(token) {
  await db.read();
  const session = db.data.sessions.find((s) => s.token === token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) return null;
  return db.data.clients.find((c) => c.id === session.clientId) || null;
}

export async function deleteSession(token) {
  await db.read();
  db.data.sessions = db.data.sessions.filter((s) => s.token !== token);
  await db.write();
}

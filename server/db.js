import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { randomBytes } from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFile = path.join(__dirname, '..', 'data', 'db.json');

const defaultData = { clients: [] };
const adapter = new JSONFile(dataFile);
const db = new Low(adapter, defaultData);

export async function initDb() {
  await db.read();
  db.data ||= defaultData;
  await db.write();
}

export function generateApiKey() {
  return 'bb_live_' + randomBytes(18).toString('hex');
}

export function generateId() {
  return randomBytes(8).toString('hex');
}

// --- Client CRUD -----------------------------------------------------

export async function createClient({ businessName, email, courseContext }) {
  await db.read();
  const client = {
    id: generateId(),
    businessName,
    email,
    apiKey: generateApiKey(),
    courseContext: courseContext || '',
    widgetConfig: {
      welcomeMessage: `Bonjour ! Je suis l'assistant de ${businessName}. Comment puis-je vous aider ?`,
      accentColor: '#1F6F62',
      botName: 'BunnyBot',
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

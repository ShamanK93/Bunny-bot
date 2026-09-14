# 🐰 BunnyBot

Chatbot SaaS pour créateurs de formations en ligne : un widget qui répond aux
questions des visiteurs à partir du contexte de leur offre, un tableau de
bord admin, et une page d'inscription avec facturation Stripe.

## Ce qui est inclus

- **Backend** (Node/Express) : gestion multi-clients par clé API, endpoint
  de chat branché sur l'API Claude, webhooks Stripe.
- **Widget embarquable** (`public/widget.js`) : une seule balise `<script>`
  à coller sur le site du client.
- **Tableau de bord admin** (`public/dashboard/`) : liste des clients,
  statut d'abonnement, édition du contexte du bot, révocation d'accès.
- **Page d'inscription** (`public/signup/`) : formulaire → essai 14 jours
  → Stripe Checkout.
- Stockage simple en fichier JSON (`lowdb`) — suffisant pour démarrer sans
  base de données à gérer ; migrable vers Postgres plus tard si besoin.

## Installation

```bash
npm install
cp .env.example .env
```

Remplis `.env` :

| Variable | Où la trouver |
|---|---|
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys |
| `ADMIN_TOKEN` | invente une longue chaîne aléatoire — c'est ton mot de passe pour `/dashboard/` |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` | dashboard.stripe.com — crée un produit "BunnyBot" avec un prix récurrent mensuel |
| `STRIPE_WEBHOOK_SECRET` | généré quand tu crées le endpoint webhook (voir plus bas) |

Sans clé Stripe, l'inscription fonctionne quand même : elle crée un essai
gratuit sans paiement (pratique pour tester en local).

## Lancer en local

```bash
npm start
```

- Page d'inscription : http://localhost:3000/signup/
- Tableau de bord admin : http://localhost:3000/dashboard/ (connecte-toi avec `ADMIN_TOKEN`)

## Brancher Stripe (facturation réelle)

1. Crée un produit dans le Dashboard Stripe avec un prix récurrent
   (ex. 39 €/mois) → copie son `price_id` dans `STRIPE_PRICE_ID`.
2. Dans Stripe → Developers → Webhooks, ajoute un endpoint pointant vers
   `https://ton-domaine.com/api/stripe/webhook`, écoutant au minimum :
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
3. Copie le secret de signature généré dans `STRIPE_WEBHOOK_SECRET`.

## Installer le widget chez un client

Dans le tableau de bord, chaque client a un extrait de code prêt à copier :

```html
<script src="https://ton-domaine.com/widget.js" data-api-key="bb_live_xxxxx"></script>
```

À coller juste avant `</body>` sur le site du client. Le widget va chercher
tout seul sa configuration (couleur, message d'accueil, nom du bot) via la
clé API.

## Déployer

Le projet est une app Node/Express standard : elle tourne telle quelle sur
Railway, Render, Fly.io ou un VPS classique. Pense à :
- monter un volume persistant pour `data/db.json` (ou migrer vers une vraie
  base si tu dépasses quelques dizaines de clients),
- mettre `APP_URL` à jour avec ton domaine réel (utilisé dans les redirections
  Stripe Checkout).

## Ce qui manque encore avant de vendre pour de vrai

- Emails transactionnels (confirmation d'inscription, fin d'essai, échec de
  paiement) — actuellement juste mentionnés dans l'UI, pas envoyés.
- Un vrai design de dashboard responsive mobile (fonctionnel en l'état,
  optimisé desktop).
- Limitation de débit / anti-abus sur `/api/chat` si un client reçoit
  beaucoup de trafic.
"# Bunny-bot" 

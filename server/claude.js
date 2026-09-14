const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-5';

/**
 * Ask Claude to answer a visitor's question, grounded in the course
 * creator's own context (their offer, FAQ, pricing, policies, etc.).
 *
 * @param {Object} params
 * @param {string} params.businessName
 * @param {string} params.courseContext - free text the client filled in the dashboard
 * @param {Array<{role: 'user'|'assistant', content: string}>} params.history
 * @param {string} params.message - the visitor's new message
 */
export async function askBunny({ businessName, courseContext, history, message }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY manquant dans .env');
  }

  const systemPrompt = [
    `Tu es BunnyBot, l'assistant qui répond aux questions des visiteurs sur le site de "${businessName}", un créateur de formation en ligne.`,
    `Ton rôle : aider les visiteurs à comprendre l'offre, lever leurs objections et les orienter vers l'achat quand c'est pertinent — sans jamais mentir ni inventer d'information absente du contexte ci-dessous.`,
    `Réponds toujours en français, de façon chaleureuse, concise (3-5 phrases maximum), et sans jargon technique.`,
    `Si tu ne connais pas la réponse à partir du contexte fourni, dis-le honnêtement et propose de mettre la personne en contact avec ${businessName}.`,
    '',
    `--- Contexte fourni par ${businessName} ---`,
    courseContext || "(Aucun contexte fourni pour l'instant.)",
  ].join('\n');

  const messages = [
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b) => b.type === 'text');
  return textBlock?.text?.trim() || "Désolé, je n'ai pas de réponse pour le moment.";
}

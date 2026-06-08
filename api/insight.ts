// Vercel serverless function — Anthropic proxy for the Analysis AI panel.
//
// The browser POSTs the same `messages.create` params it would have sent
// directly; this function forwards them to Anthropic using the server-side
// ANTHROPIC_API_KEY (a Vercel env var) so the key never reaches the client.
// Enable it by setting VITE_AI_PROXY=/api/insight at build time — see DEPLOY.md.
//
// This file lives outside `src`, so it is NOT part of the Vite/tsc app build
// (tsconfig.app.json includes only "src"). Vercel bundles it with its own
// Node runtime; `any`-typed req/res avoids a @vercel/node dependency.
import Anthropic from '@anthropic-ai/sdk';

// Only the two models the app actually uses. Rejecting anything else keeps the
// proxy from being repurposed as an open-ended Anthropic relay.
const ALLOWED_MODELS = new Set(['claude-sonnet-4-6', 'claude-haiku-4-5']);
const MAX_TOKENS_CAP = 1024;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(501).json({ error: 'AI proxy not configured (missing ANTHROPIC_API_KEY).' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { model, max_tokens, system, messages } = body ?? {};

    if (!ALLOWED_MODELS.has(model)) {
      res.status(400).json({ error: `Model not allowed: ${String(model)}` });
      return;
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required.' });
      return;
    }

    const client = new Anthropic({ apiKey });
    const message = await client.messages.create({
      model,
      max_tokens: Math.min(Number(max_tokens) || 600, MAX_TOKENS_CAP),
      system,
      messages,
    });

    res.status(200).json(message);
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? 'AI request failed.' });
  }
}

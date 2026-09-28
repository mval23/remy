// Remy's AI server function (Supabase Edge Function, Deno).
//
// It holds the Gemini API key so the app never sees it, lets only signed-in people use it,
// and asks Gemini for JSON in the exact shape the app sends. The app then re-checks every
// answer against the user's safety rules before showing it.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   GEMINI_API_KEY  required. A free key from Google AI Studio (no card needed, so it can't cost money).
//   GEMINI_MODEL    optional. Defaults to the models in MODELS below, tried in order.

/** Overridable only for local testing against a fake server. */
const GEMINI_BASE = Deno.env.get('GEMINI_BASE_URL') ?? 'https://generativelanguage.googleapis.com';
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const MAX_SYSTEM = 4_000;
const MAX_PROMPT = 20_000;
const MAX_SCHEMA = 20_000;
/** Per person, per running copy of this function: a light brake on runaway use of the free quota. */
const PER_HOUR = 30;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (error: string, status: number) => reply({ error }, status);

const recent = new Map<string, number[]>();

/** Ask Supabase Auth who sent this request. Works whether or not the platform already checked the token. */
async function signedInUser(req: Request): Promise<string | null> {
  const auth = req.headers.get('Authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  if (!auth.startsWith('Bearer ') || !apikey) return null;
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!res.ok) return null;
  const user = (await res.json()) as { id?: string; role?: string };
  return user.id && user.role === 'authenticated' ? user.id : null;
}

async function gemini(model: string, key: string, system: string, prompt: string, schema: unknown) {
  return fetch(`${GEMINI_BASE}/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.9, maxOutputTokens: 4096 },
    }),
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('failed', 405);

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return fail('not-set-up', 503);

  const userId = await signedInUser(req);
  if (!userId) return fail('sign-in', 401);

  const now = Date.now();
  const times = (recent.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (times.length >= PER_HOUR) return fail('busy', 429);
  recent.set(userId, [...times, now]);

  let body: { system?: unknown; prompt?: unknown; schema?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail('failed', 400);
  }
  const { system, prompt, schema } = body;
  if (typeof system !== 'string' || typeof prompt !== 'string' || typeof schema !== 'object' || schema === null) return fail('failed', 400);
  if (system.length > MAX_SYSTEM || prompt.length > MAX_PROMPT || JSON.stringify(schema).length > MAX_SCHEMA) return fail('too-long', 413);

  const custom = Deno.env.get('GEMINI_MODEL');
  const models = custom ? [custom] : MODELS;
  for (const model of models) {
    const res = await gemini(model, key, system, prompt, schema);
    // A model that doesn't exist (or isn't available to this key): try the next one.
    if (res.status === 404 || res.status === 403) continue;
    if (res.status === 429) return fail('busy', 429);
    if (!res.ok) {
      console.error('Gemini error', model, res.status, (await res.text()).slice(0, 500));
      return fail('failed', 502);
    }
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('');
    if (!text) return fail('failed', 502);
    try {
      return reply({ json: JSON.parse(text), model });
    } catch {
      return fail('failed', 502);
    }
  }
  console.error('No Gemini model was available', models);
  return fail('not-set-up', 503);
});

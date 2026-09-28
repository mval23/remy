// Remy's reminder sender (Supabase Edge Function, Deno).
//
// Two ways in:
//   1. The scheduled job (send_due_reminders in supabase/reminders.sql) posts the reminders that are due,
//      with the x-cron-secret header.
//   2. A signed-in person taps "Send a test" in the app, which posts that device's own subscription.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  the notification keys (see reminder-keys.local, made on the owner's computer)
//   CRON_SECRET                         shared with the scheduled job
// Turn "Enforce JWT verification" off for this function: the scheduled job has no sign-in token,
// so the function checks the secret, or asks Supabase Auth who the person is, itself.

import webpush from 'npm:web-push@3.6.7';

const MAX_MESSAGES = 500;

interface Message {
  subscription: webpush.PushSubscription;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Ask Supabase Auth who sent this request (same check as remy-ai). */
async function signedIn(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  const apikey = req.headers.get('apikey') ?? '';
  if (!auth.startsWith('Bearer ') || !apikey) return false;
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { Authorization: auth, apikey } });
  if (!res.ok) return false;
  const user = (await res.json()) as { role?: string };
  return user.role === 'authenticated';
}

const valid = (m: unknown): m is Message => {
  const x = m as Message;
  return !!x && typeof x.title === 'string' && typeof x.body === 'string' && typeof x.subscription?.endpoint === 'string' && !!x.subscription.keys?.p256dh && !!x.subscription.keys?.auth;
};

async function send(messages: Message[]) {
  let sent = 0;
  const gone: string[] = [];
  for (const m of messages) {
    try {
      await webpush.sendNotification(m.subscription, JSON.stringify({ title: m.title.slice(0, 120), body: m.body.slice(0, 400), url: m.url ?? '', tag: m.tag ?? '' }), { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // 404/410: the device turned notifications off or the subscription expired.
      if (status === 404 || status === 410) gone.push(m.subscription.endpoint);
      else console.error('Push failed', status, String(e).slice(0, 300));
    }
  }
  return { sent, gone };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ error: 'failed' }, 405);

  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv) return reply({ error: 'not-set-up' }, 503);
  webpush.setVapidDetails('https://github.com/mval23/remy', pub, priv);

  let body: { messages?: unknown; test?: boolean; subscription?: unknown };
  try {
    body = await req.json();
  } catch {
    return reply({ error: 'failed' }, 400);
  }

  const cron = Deno.env.get('CRON_SECRET');
  if (cron && req.headers.get('x-cron-secret') === cron) {
    const messages = (Array.isArray(body.messages) ? body.messages : []).filter(valid).slice(0, MAX_MESSAGES);
    return reply(await send(messages));
  }

  if (body.test && (await signedIn(req))) {
    const m = { subscription: body.subscription, title: 'Reminders are on', body: 'I’ll nudge you about thawing, your check-in and prep day.', url: '', tag: 'remy-test' };
    if (!valid(m)) return reply({ error: 'failed' }, 400);
    const r = await send([m]);
    return r.sent ? reply(r) : reply({ error: 'failed', ...r }, 502);
  }

  return reply({ error: 'sign-in' }, 401);
});

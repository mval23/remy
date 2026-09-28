import { supabase } from '../sync/supabase';

/**
 * Calls the `remy-ai` server function (supabase/functions/remy-ai), which holds the Gemini key.
 * The app never sees the key. Only signed-in people can use it.
 */

export const AI_FUNCTION = 'remy-ai';

export class AiError extends Error {
  constructor(
    message: string,
    /** not-set-up, busy, sign-in, offline, failed */
    readonly code: string,
  ) {
    super(message);
  }
}

/** Plain-language messages for the server function's error codes. */
const MESSAGES: Record<string, string> = {
  'not-set-up': 'Remy’s AI isn’t set up yet. The steps are in SETUP.md (section 8).',
  busy: 'Remy’s free AI has reached its limit for now. Try again in a minute, or tomorrow if it keeps happening.',
  'sign-in': 'Sign in on the Sync & install screen to use AI ideas.',
  'too-long': 'That request is too long. Keep it to a sentence or two.',
  offline: 'You’re offline. AI ideas need an internet connection; everything else still works.',
  failed: 'Remy’s AI couldn’t come up with an idea just now. Try again.',
};

export const aiMessage = (code: string) => MESSAGES[code] ?? MESSAGES.failed;

/** Ask the model for JSON matching `schema`. Returns the parsed JSON. */
export async function askForJson(system: string, prompt: string, schema: object): Promise<unknown> {
  if (!navigator.onLine) throw new AiError(aiMessage('offline'), 'offline');
  const pending = supabase();
  if (!pending) throw new AiError(aiMessage('not-set-up'), 'not-set-up');
  const sb = await pending;
  const { data: session } = await sb.auth.getSession();
  if (!session.session) throw new AiError(aiMessage('sign-in'), 'sign-in');

  const { data, error } = await sb.functions.invoke(AI_FUNCTION, { body: { system, prompt, schema } });
  if (error) {
    let code = 'failed';
    const ctx = (error as { context?: unknown }).context;
    if (ctx instanceof Response) {
      if (ctx.status === 404) code = 'not-set-up';
      try {
        const body = (await ctx.json()) as { error?: string };
        if (body.error) code = body.error;
      } catch {
        /* not JSON */
      }
    } else if (!navigator.onLine) code = 'offline';
    throw new AiError(aiMessage(code), code);
  }
  const json = (data as { json?: unknown } | null)?.json;
  if (json === undefined) throw new AiError(aiMessage('failed'), 'failed');
  return json;
}

import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { InterviewState } from '../interview/types';
import type { PlanState } from '../storage/db';
import type { RemoteRow } from './merge';

/**
 * Supabase connection for sign-in and sync. It's optional: without the two settings below,
 * Remy works exactly as before and keeps everything on this device.
 *
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY come from the Supabase project settings.
 * The “anon” (publishable) key is designed to be public; row-level security in
 * supabase/schema.sql makes sure each person can only read and change their own row.
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const syncConfigured = Boolean(url && anonKey);

let client: Promise<SupabaseClient> | null = null;
/** The Supabase library is loaded only when sync is set up, keeping the app quick to open. */
export function supabase(): Promise<SupabaseClient> | null {
  if (!syncConfigured) return null;
  client ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url!, anonKey!, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' } }),
  );
  return client;
}

const TABLE = 'user_data';

/** Email a sign-in code (and link). The link returns to this app’s address. */
export async function sendSignInEmail(email: string) {
  const sb = await supabase();
  if (!sb) throw new Error('Sync isn’t set up');
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL, shouldCreateUser: true } });
  if (error) throw error;
}

/** Sign in with the code from the email. Works inside an installed app, where email links open elsewhere. */
export async function verifyCode(email: string, code: string): Promise<Session> {
  const sb = await supabase();
  if (!sb) throw new Error('Sync isn’t set up');
  const { data, error } = await sb.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
  if (error) throw error;
  if (!data.session) throw new Error('No session returned');
  return data.session;
}

export async function signOut() {
  await (await supabase())?.auth.signOut();
}

export async function fetchRow(userId: string): Promise<RemoteRow | null> {
  const sb = (await supabase())!;
  const { data, error } = await sb.from(TABLE).select('interview, plan, interview_at, plan_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data as RemoteRow | null) ?? null;
}

/** Upload one or both documents. Only the fields given are changed. */
export async function pushRow(userId: string, docs: { interview?: InterviewState; interviewAt?: number; plan?: PlanState; planAt?: number }) {
  const sb = (await supabase())!;
  const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
  if (docs.interview) Object.assign(row, { interview: docs.interview, interview_at: docs.interviewAt });
  if (docs.plan) Object.assign(row, { plan: docs.plan, plan_at: docs.planAt });
  const { error } = await sb.from(TABLE).upsert(row, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function deleteRow(userId: string) {
  const sb = (await supabase())!;
  const { error } = await sb.from(TABLE).delete().eq('user_id', userId);
  if (error) throw error;
}

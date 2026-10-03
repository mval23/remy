import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { InterviewState } from '../interview/types';
import type { BodyProfile } from '../planning/energy';
import type { PlanState } from '../storage/db';
import type { RemoteHealth, RemoteRow } from './merge';

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

/**
 * Email and password sign-in. It works inside an installed app (email links open in the browser instead)
 * and needs no custom email templates. Supabase only emails a confirmation link when the account is
 * created, and a reset link if the password is forgotten; both use its standard templates.
 */
const appAddress = () => window.location.origin + import.meta.env.BASE_URL;

async function requireClient(): Promise<SupabaseClient> {
  const sb = await supabase();
  if (!sb) throw new Error('Sync isn’t set up');
  return sb;
}

/** Create an account. Returns a session right away if email confirmation is off; otherwise null until confirmed. */
export async function createAccount(email: string, password: string): Promise<Session | null> {
  const { data, error } = await (await requireClient()).auth.signUp({ email, password, options: { emailRedirectTo: appAddress() } });
  if (error) throw error;
  // Supabase returns a user with no identities when the email already has an account.
  if (data.user && data.user.identities?.length === 0) throw new Error('User already registered');
  return data.session;
}

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await (await requireClient()).auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

/** Email a link to choose a new password. Opening it brings the person back to Remy to set one. */
export async function sendPasswordReset(email: string) {
  const { error } = await (await requireClient()).auth.resetPasswordForEmail(email, { redirectTo: appAddress() });
  if (error) throw error;
}

export async function setNewPassword(password: string) {
  const { error } = await (await requireClient()).auth.updateUser({ password });
  if (error) throw error;
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

const HEALTH_TABLE = 'user_health';

/**
 * The optional cloud copy of the body details (supabase/schema.sql, SETUP.md step 11). Null when there's none yet;
 * 'missing' when the table hasn't been created in this Supabase project.
 */
export async function fetchHealth(userId: string): Promise<RemoteHealth | null | 'missing'> {
  const sb = (await supabase())!;
  const { data, error } = await sb.from(HEALTH_TABLE).select('health, health_at').eq('user_id', userId).maybeSingle();
  if (error) {
    // Postgres "undefined table", or PostgREST's "not in the schema cache".
    if (error.code === '42P01' || error.code === 'PGRST205') return 'missing';
    throw error;
  }
  return (data as RemoteHealth | null) ?? null;
}

export async function pushHealth(userId: string, health: BodyProfile, at: number) {
  const sb = (await supabase())!;
  const { error } = await sb.from(HEALTH_TABLE).upsert({ user_id: userId, health, health_at: at, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Remove the body details from the cloud (switching sync off, or deleting everything). Fine if the table doesn't exist. */
export async function deleteHealth(userId: string) {
  const sb = (await supabase())!;
  await sb.from(HEALTH_TABLE).delete().eq('user_id', userId);
}

export async function deleteRow(userId: string) {
  const sb = (await supabase())!;
  const { error } = await sb.from(TABLE).delete().eq('user_id', userId);
  if (error) throw error;
  await deleteHealth(userId);
  // Reminders and notification sign-ups (supabase/reminders.sql). Those tables may not exist if reminders were never set up.
  await sb.from('reminders').delete().eq('user_id', userId);
  await sb.from('push_subscriptions').delete().eq('user_id', userId);
}

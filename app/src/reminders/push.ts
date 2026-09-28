import { isAppleMobile, isInstalled } from '../pwa';
import { supabase, syncConfigured } from '../sync/supabase';
import type { Reminder } from './reminders';

/**
 * Phone notifications (Web Push). Each device that allows notifications registers a push subscription
 * in Supabase; the app saves the week's reminders there; a scheduled job sends them (supabase/reminders.sql).
 * Needs sign-in, the public notification key (VITE_VAPID_PUBLIC_KEY), and the service worker, which only
 * exists in built versions of the app (not `npm run dev`).
 */

const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
export const pushConfigured = syncConfigured && Boolean(vapidPublic);

export type PushState =
  | 'not-set-up' // no key or no sync in this copy of Remy
  | 'install-first' // iPhone/iPad: only installed apps can get notifications
  | 'unsupported' // this browser can't
  | 'blocked' // the person said no; only their settings can undo it
  | 'off'
  | 'on';

const hasPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  // In development there's no service worker; don't wait forever for one.
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function pushState(): Promise<PushState> {
  if (!pushConfigured) return 'not-set-up';
  if (!hasPush()) return isAppleMobile() && !isInstalled() ? 'install-first' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  const reg = await registration();
  if (!reg) return 'unsupported';
  return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function client() {
  const sb = await supabase();
  if (!sb) throw new Error('Sync isn’t set up');
  const { data } = await sb.auth.getSession();
  if (!data.session) throw new Error('Sign in first');
  return { sb, userId: data.session.user.id };
}

/** Save (or refresh) this device's subscription, so reminders reach it. */
async function saveSubscription(sub: PushSubscription) {
  const { sb, userId } = await client();
  const { error } = await sb
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, user_id: userId, subscription: sub.toJSON(), updated_at: new Date().toISOString() });
  if (error) throw error;
}

/** Ask permission (must follow a tap), subscribe this device, and save it. */
export async function enablePush(): Promise<PushState> {
  const reg = await registration();
  if (!reg || !vapidPublic) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublic) }));
  await saveSubscription(sub);
  return 'on';
}

/** Stop notifications on this device. */
export async function disablePush(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) return;
  try {
    const { sb } = await client();
    await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  } finally {
    await sub.unsubscribe();
  }
}

/** Re-save this device's subscription when the app opens, so old devices can be tidied away. */
export async function refreshSubscription(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (sub) await saveSubscription(sub);
}

/** Replace the account's unsent reminders with this list. */
export async function saveReminders(list: Reminder[]): Promise<void> {
  const { sb, userId } = await client();
  const del = await sb.from('reminders').delete().eq('user_id', userId).is('sent_at', null);
  if (del.error) throw del.error;
  if (!list.length) return;
  const { error } = await sb
    .from('reminders')
    .insert(list.map((r) => ({ user_id: userId, send_at: new Date(r.at).toISOString(), title: r.title, body: r.body, url: r.url, tag: r.tag })));
  if (error) throw error;
}

/** Send one notification to this device right now. */
export async function sendTest(): Promise<void> {
  const sub = await (await registration())?.pushManager.getSubscription();
  if (!sub) throw new Error('Notifications aren’t on for this device');
  const { sb } = await client();
  const { error } = await sb.functions.invoke('remy-push', { body: { test: true, subscription: sub.toJSON() } });
  if (error) throw error;
}

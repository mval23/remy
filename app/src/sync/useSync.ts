import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InterviewState } from '../interview/types';
import { loadStamps, type PlanState } from '../storage/db';
import { reconcile } from './merge';
import { deleteRow, fetchRow, pushRow, sendSignInEmail, signOut, supabase, syncConfigured, verifyCode } from './supabase';

export type SyncStatus = 'off' | 'signedOut' | 'syncing' | 'synced' | 'offline' | 'error';

interface Options {
  interview: InterviewState;
  planState: PlanState;
  /** Replace local data with the cloud copy, saved with the cloud copy's change time. */
  applyInterview: (value: InterviewState, at: number) => void;
  applyPlan: (value: PlanState, at: number) => void;
}

const POLL_MS = 30_000;
const DEBOUNCE_MS = 1_500;

/**
 * Keeps this device and the cloud copy in step.
 * Runs after local changes (short delay), when the app comes back into view, when the connection returns,
 * and every 30 seconds while the app is open.
 */
export function useSync(opts: Options) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<SyncStatus>(syncConfigured ? 'signedOut' : 'off');
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(opts);
  latest.current = opts;
  const running = useRef(false);
  const again = useRef(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const pending = supabase();
    if (!pending) return;
    let unsubscribe = () => {};
    let cancelled = false;
    void pending.then((sb) => {
      if (cancelled) return;
      void sb.auth.getSession().then(({ data }) => setSession(data.session));
      const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
      unsubscribe = () => data.subscription.unsubscribe();
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const userId = session?.user.id ?? null;

  const syncNow = useCallback(async () => {
    if (!userId) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    setStatus('syncing');
    try {
      const stamps = await loadStamps();
      const remote = await fetchRow(userId);
      const { interview, planState } = latest.current;
      const d = reconcile({ interview, plan: planState, stamps }, remote);
      if (d.pullInterview) latest.current.applyInterview(d.pullInterview.value, d.pullInterview.at);
      if (d.pullPlan) latest.current.applyPlan(d.pullPlan.value, d.pullPlan.at);
      if (d.pushInterview || d.pushPlan) {
        await pushRow(userId, {
          ...(d.pushInterview ? { interview, interviewAt: stamps.interviewAt } : {}),
          ...(d.pushPlan ? { plan: d.pullPlan?.value ?? planState, planAt: d.pullPlan?.at ?? stamps.planAt } : {}),
        });
      }
      setLastSynced(Date.now());
      setError(null);
      setStatus('synced');
    } catch (e) {
      setStatus(navigator.onLine ? 'error' : 'offline');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      running.current = false;
      if (again.current) {
        again.current = false;
        void syncNow();
      }
    }
  }, [userId]);

  // Sync on sign-in, then whenever the app becomes visible or the connection returns, and on a timer.
  useEffect(() => {
    if (!userId) {
      setStatus(syncConfigured ? 'signedOut' : 'off');
      return;
    }
    void syncNow();
    const onVisible = () => document.visibilityState === 'visible' && void syncNow();
    const onOnline = () => void syncNow();
    const onOffline = () => setStatus('offline');
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const poll = window.setInterval(() => document.visibilityState === 'visible' && void syncNow(), POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(poll);
    };
  }, [userId, syncNow]);

  /** Called after a local change has been saved: upload shortly, batching quick edits together. */
  const schedule = useCallback(() => {
    if (!userId) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void syncNow(), DEBOUNCE_MS);
  }, [userId, syncNow]);

  return {
    configured: syncConfigured,
    status,
    email: session?.user.email ?? null,
    signedIn: !!userId,
    lastSynced,
    error,
    syncNow,
    schedule,
    sendCode: sendSignInEmail,
    verify: verifyCode,
    signOut: async () => {
      await signOut();
      setLastSynced(null);
    },
    /** Remove the cloud copy (used by “Delete everything”). */
    deleteCloudCopy: async () => {
      if (userId) await deleteRow(userId);
    },
  };
}

export type Sync = ReturnType<typeof useSync>;

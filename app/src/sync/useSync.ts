import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { InterviewState } from '../interview/types';
import type { BodyProfile } from '../planning/energy';
import { loadStamps, type PlanState } from '../storage/db';
import { normalizePlanState } from '../storage/planState';
import { reconcile, reconcileHealth, withoutWeights } from './merge';
import {
  createAccount,
  deleteHealth,
  deleteRow,
  fetchHealth,
  fetchRow,
  pushHealth,
  pushRow,
  sendPasswordReset,
  setNewPassword,
  signIn,
  signOut,
  supabase,
  syncConfigured,
} from './supabase';

export type SyncStatus = 'off' | 'signedOut' | 'syncing' | 'synced' | 'offline' | 'error';

interface Options {
  interview: InterviewState;
  planState: PlanState;
  /** Replace local data with the cloud copy, saved with the cloud copy's change time. */
  applyInterview: (value: InterviewState, at: number) => void;
  applyPlan: (value: PlanState, at: number) => void;
  /** Body details for the optional estimate. They and the weigh-ins sync only when `health.sync` is on. */
  health: BodyProfile;
  applyHealth: (value: BodyProfile) => void;
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
  /** Arrived from a password-reset email: ask for a new password. */
  const [recovery, setRecovery] = useState(false);
  /** Why body details can't sync, when the optional table is missing. */
  const [healthNote, setHealthNote] = useState<string | null>(null);
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
      const { data } = sb.auth.onAuthStateChange((event, s) => {
        setSession(s);
        if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      });
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
      const { interview, planState, health } = latest.current;
      const d = reconcile({ interview, plan: planState, stamps }, remote, Date.now(), health.sync);
      if (d.pullInterview) latest.current.applyInterview(d.pullInterview.value, d.pullInterview.at);
      if (d.pullPlan) latest.current.applyPlan(d.pullPlan.value, d.pullPlan.at);
      if (d.pushInterview || d.pushPlan) {
        await pushRow(userId, {
          ...(d.pushInterview ? { interview: d.pullInterview?.value ?? interview, interviewAt: d.pullInterview?.at ?? stamps.interviewAt } : {}),
          ...(d.pushPlan ? { plan: d.uploadPlan!, planAt: d.pullPlan?.at ?? stamps.planAt } : {}),
        });
      }
      if (health.sync) {
        const cloud = await fetchHealth(userId);
        if (cloud === 'missing') setHealthNote('Body details can’t sync yet: the user_health table isn’t in your Supabase project (SETUP.md step 11).');
        else {
          setHealthNote(null);
          const h = reconcileHealth(health, cloud);
          if (h.pull) latest.current.applyHealth(h.pull);
          if (h.push) await pushHealth(userId, health, health.updatedAt);
        }
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
    recovery,
    createAccount,
    signIn,
    sendPasswordReset,
    setNewPassword: async (password: string) => {
      await setNewPassword(password);
      setRecovery(false);
    },
    cancelRecovery: () => setRecovery(false),
    signOut: async () => {
      await signOut();
      setLastSynced(null);
    },
    healthNote,
    /**
     * Stop sharing body details: delete the cloud copy and the weigh-ins in the cloud plan. The plan keeps its change
     * time, so other devices keep their own copies; one that still shares them uploads them again.
     */
    stopHealthSync: async () => {
      setHealthNote(null);
      if (!userId) return;
      await deleteHealth(userId);
      const remote = await fetchRow(userId);
      if (!remote?.plan) return;
      const plan = normalizePlanState(remote.plan);
      if (withoutWeights(plan) !== plan) await pushRow(userId, { plan: withoutWeights(plan), planAt: remote.plan_at });
    },
    /** Remove the cloud copy (used by “Delete everything”). */
    deleteCloudCopy: async () => {
      if (userId) await deleteRow(userId);
    },
  };
}

export type Sync = ReturnType<typeof useSync>;

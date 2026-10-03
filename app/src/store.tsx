import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type SetStateAction } from 'react';
import { activeAnswers, answerQuestion, fillWithSamples, firstOpen, prevBefore, skipQuestion } from './interview/engine';
import { asRatings } from './interview/helpers';
import { FOOD_GROUP_A, FOODS, Q, QBY } from './interview/questions';
import { emptyInterview, type AnswerValue, type InterviewState, type Level, type Question } from './interview/types';
import { answerSuggestion, applyCheckin, forgetAllLearned, forgetLearned, learnFromRejection, noticeSuggestion } from './learning/learning';
import type { CheckinDraft, Noticed } from './learning/types';
import { planAhead } from './planning/ahead';
import type { ShopDays } from './planning/calendar';
import { R, registerAiRecipes } from './planning/data/recipes';
import { WEEKS } from './planning/data/weeks';
import { emptyBody, energyTargets, type BodyProfile } from './planning/energy';
import { fitToGoals, goalsOf, hasGoals } from './planning/goals';
import { emptyGroceryEdits } from './planning/grocery';
import type { ShopMode } from './planning/month';
import { balanceDay } from './planning/nutrition';
import {
  approveAll,
  approveDay,
  buildPlan,
  dropRemoved,
  openSlot,
  regenerate,
  replaceMeal,
  setApproved,
  setSide,
  swapMeals,
} from './planning/planner';
import { context, defaultVariety, type PlanContext } from './planning/rules';
import type { Recipe, Slot, Variety, WeekPlan } from './planning/types';
import { disablePush, refreshSubscription, saveReminders } from './reminders/push';
import { OPENABLE, upcomingReminders, type ReminderSettings } from './reminders/reminders';
import { backupFileName, makeBackup, readBackup, type Backup } from './storage/backup';
import {
  deleteEverything,
  emptyPlanState,
  loadHealth,
  loadInterview,
  loadPlanState,
  saveHealth,
  saveInterview,
  savePlanState,
  type PlanState,
} from './storage/db';
import { stampAnswers, stampMeals } from './sync/merge';
import { useSync } from './sync/useSync';
import { pilotFile, PILOT_FILE_NAME } from './learning/pilot';

export type Screen =
  | 'welcome' | 'interview' | 'resume' | 'summary' | 'home' | 'planner' | 'nutrition' | 'recipe' | 'grocery' | 'prep'
  | 'account' | 'checkin' | 'prefs' | 'privacy' | 'reminders' | 'cook';
export type SheetName = 'map' | 'options' | 'confirmRestart' | 'replace' | 'move' | 'side' | 'food' | 'confirmForget' | 'confirmImport' | 'meal' | 'menuSettings' | 'estimate';
export interface SheetArg {
  d: number;
  slot: Slot;
  /** Replace sheet opened from “Not this”: ask why. */
  reject?: boolean;
}

export interface UiState {
  screen: Screen;
  /** Where to return after editing a single answer. */
  editReturn: Screen | null;
  /** The question just answered, so Remy can react to it. */
  lastAnswered: string | null;
  drafts: Record<string, AnswerValue>;
  sheet: SheetName | null;
  sheetArg: SheetArg | null;
  toast: string | null;
  recipeId: string | null;
  /** Screen to go back to from a recipe. */
  recipeBack: Screen;
  /** Prep day as a time-saving timeline, or recipe by recipe (also the order cook mode follows). */
  prepView: 'timeline' | 'recipe';
  /** Food whose level is being changed (food sheet). */
  sheetFood: string | null;
  /** A backup file that was read and is waiting for confirmation. */
  pendingImport: Backup | null;
  /** Week shown in the planner: 0 = this week, 1… = the weeks planned ahead. */
  week: number;
  /** The planner shows one week day by day, or the month on a calendar. */
  planView: 'week' | 'month';
}

export interface RejectReason {
  why: string | null;
  /** Food to mark as Dislike, chosen in the reject sheet. */
  food: string | null;
}

const initialUi = (screen: Screen = 'welcome'): UiState => ({
  screen, editReturn: null, lastAnswered: null, drafts: {}, sheet: null, sheetArg: null, toast: null, recipeId: null, recipeBack: 'planner',
  sheetFood: null, pendingImport: null, prepView: 'timeline', week: 0, planView: 'week',
});

/** The screen named in ?open=… (from a tapped reminder), once; the address is then tidied. */
function openedFromReminder(): Screen | null {
  const params = new URLSearchParams(window.location.search);
  const screen = params.get('open');
  if (!screen) return null;
  params.delete('open');
  const rest = params.toString();
  window.history.replaceState(null, '', window.location.pathname + (rest ? `?${rest}` : '') + window.location.hash);
  return OPENABLE.includes(screen) ? (screen as Screen) : null;
}

const planContext = (s: InterviewState, p: PlanState): PlanContext => context(activeAnswers(s), p.adj, p.hungry, p.recent, p.shopDays);

/** A newly built week, fitted to the person's daily goals when they set some. */
const fitted = (plan: WeekPlan, s: InterviewState, p: PlanState): WeekPlan => {
  const goals = goalsOf(p.nutrition, activeAnswers(s));
  return hasGoals(goals) ? fitToGoals(plan, planContext(s, p), goals).plan : plan;
};
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** A week of the month: 0 = this week, 1… = the weeks planned ahead. */
const weekOf = (p: PlanState, w: number): WeekPlan | null => (w === 0 ? p.plan : (p.ahead[w - 1] ?? null));
const withWeek = (p: PlanState, w: number, plan: WeekPlan): PlanState => (w === 0 ? { ...p, plan } : { ...p, ahead: p.ahead.map((x, i) => (i === w - 1 ? plan : x)) });
/** The weeks after `plan`, redrafted from the rules: meals approved ahead stay. */
const aheadFor = (plan: WeekPlan, s: InterviewState, p: PlanState, variety: Variety) => planAhead(plan, p.ahead, variety, planContext(s, p), goalsOf(p.nutrition, activeAnswers(s)));

interface Initial {
  interview: InterviewState;
  plan: PlanState;
  /** Device-only details for the optional estimate (never synced). */
  health: BodyProfile;
}

function useRemyState(initial: Initial) {
  const [interview, setInterviewRaw] = useState<InterviewState>(initial.interview);
  const [planState, setPlanStateRaw] = useState<PlanState>(initial.plan);
  // Every local change records when each answer and meal changed, so sync can merge two devices piece by piece.
  // Copies applied from the cloud use the raw setters: they keep the times they came with.
  const setInterview = useCallback((u: SetStateAction<InterviewState>) => setInterviewRaw((prev) => stampAnswers(prev, typeof u === 'function' ? u(prev) : u)), []);
  const setPlanState = useCallback((u: SetStateAction<PlanState>) => setPlanStateRaw((prev) => stampMeals(prev, typeof u === 'function' ? u(prev) : u)), []);
  const [health, setHealth] = useState<BodyProfile>(initial.health);
  const shuffles = useRef(1);
  // Saved AI recipes must be in the library before anything below (or any screen) looks them up.
  registerAiRecipes(planState.aiRecipes);
  const [ui, setUi] = useState<UiState>(() => initialUi(initial.plan.plan ? openedFromReminder() ?? 'home' : 'welcome'));
  const toastTimer = useRef<number | undefined>(undefined);
  /** Change time to save with the next update. Set when applying the cloud copy, so it isn't re-uploaded as “new”. */
  const stampNext = useRef<{ interview?: number; plan?: number }>({});

  const sync = useSync({
    interview,
    planState,
    applyInterview: (value, at) => {
      stampNext.current.interview = at;
      setInterviewRaw(value);
    },
    applyPlan: (value, at) => {
      stampNext.current.plan = at;
      setPlanStateRaw(value);
      // A second device that just signed in: jump from the welcome screen to the synced week.
      if (value.plan) setUi((u) => (u.screen === 'welcome' ? { ...u, screen: 'home' } : u));
    },
    health,
    applyHealth: setHealth,
  });

  // Opening a password-reset link lands on the Sync & install screen to choose a new password.
  useEffect(() => {
    if (sync.recovery) setUi((u) => ({ ...u, screen: 'account', sheet: null }));
  }, [sync.recovery]);

  // A reminder tapped while Remy is already open: the service worker asks this window to show that screen.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const screen = (e.data as { type?: string; screen?: string } | null)?.type === 'remy-open' ? e.data.screen : null;
      if (OPENABLE.includes(screen)) setUi((u) => ({ ...u, screen: screen as Screen, sheet: null }));
    };
    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, []);

  // Keep the account's phone reminders in step with the week and the settings (all devices compute the same list).
  const reminderKey = useRef('');
  useEffect(() => {
    if (!sync.signedIn || !planState.reminders.push || !planState.plan) return;
    const list = upcomingReminders(planState.plan, activeAnswers(interview), planState.weekStartedAt, planState.reminders, new Date(), {
      ahead: planState.ahead,
      shopDays: planState.shopDays,
      monthly: planState.shopping === 'monthly',
    });
    const key = JSON.stringify(list);
    if (key === reminderKey.current) return;
    const t = window.setTimeout(() => {
      void saveReminders(list)
        .then(() => {
          reminderKey.current = key;
        })
        .catch(() => {
          /* Offline or not set up yet: tried again on the next change or visit. */
        });
    }, 2000);
    return () => window.clearTimeout(t);
  }, [sync.signedIn, planState.plan, planState.ahead, planState.shopDays, planState.shopping, planState.reminders, planState.weekStartedAt, interview]);
  useEffect(() => {
    if (sync.signedIn && planState.reminders.push) void refreshSubscription().catch(() => {});
  }, [sync.signedIn]);

  // A week without weeks planned ahead (older saved data, a backup, the cloud copy): draft them.
  useEffect(() => {
    if (!planState.plan || planState.ahead.length || !interview.confirmed) return;
    setPlanState((p) => (p.plan && !p.ahead.length ? { ...p, ahead: aheadFor(p.plan, interview, p, p.variety ?? defaultVariety(activeAnswers(interview))) } : p));
  }, [planState.plan, planState.ahead.length, interview.confirmed]);

  // Save after every change (not the values just loaded), then schedule an upload for local changes.
  useEffect(() => {
    if (interview === initial.interview) return;
    const at = stampNext.current.interview;
    stampNext.current.interview = undefined;
    void saveInterview(interview, at ?? Date.now()).then(() => at === undefined && sync.schedule());
  }, [interview]);
  useEffect(() => {
    if (planState === initial.plan) return;
    const at = stampNext.current.plan;
    stampNext.current.plan = undefined;
    void savePlanState(planState, at ?? Date.now()).then(() => at === undefined && sync.schedule());
  }, [planState]);
  // Body details stay on this device unless “Sync my body details” is on (their own owner-only table).
  useEffect(() => {
    if (health === initial.health) return;
    void saveHealth(health).then(() => health.sync && sync.schedule());
  }, [health]);

  const patchUi = (p: Partial<UiState>) => setUi((u) => ({ ...u, ...p }));
  const patchPlan = (p: Partial<PlanState>) => setPlanState((s) => ({ ...s, ...p }));
  /** Change the week in view in the planner (this week or one ahead). */
  const updatePlan = (fn: (plan: WeekPlan) => WeekPlan) =>
    setPlanState((s) => {
      const cur = weekOf(s, ui.week);
      return cur ? withWeek(s, ui.week, fn(cur)) : s;
    });
  const viewPlan = weekOf(planState, ui.week);
  const toast = (msg: string) => {
    patchUi({ toast: msg });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => patchUi({ toast: null }), 2800);
  };
  const dropDraft = (id: string) =>
    setUi((u) => {
      const drafts = { ...u.drafts };
      delete drafts[id];
      return { ...u, drafts };
    });

  /** After a profile change, rebuild unapproved meals so the plan follows the new answers. */
  const refreshPlan = (s: InterviewState, p: PlanState = planState) => {
    if (!s.confirmed || !p.plan) return;
    const variety = p.variety ?? defaultVariety(activeAnswers(s));
    const { plan, changed } = buildPlan(variety, planContext(s, p), p.plan);
    const week = fitted(plan, s, p);
    setPlanState({ ...p, plan: week, ahead: p.ahead.length ? aheadFor(week, s, p, variety) : p.ahead });
    if (changed) toast(`Plan updated: ${changed} meal${changed > 1 ? 's' : ''} changed`);
  };

  const afterAnswer = (state: InterviewState, next: ReturnType<typeof answerQuestion>['next'], q: Question) => {
    setInterview(state);
    dropDraft(q.id);
    refreshPlan(state);
    if (next.kind === 'finished') patchUi({ screen: 'summary', lastAnswered: q.id });
    else if (next.kind === 'returnFromEdit') {
      patchUi({ screen: ui.editReturn ?? 'summary', editReturn: null, lastAnswered: null });
      toast('Answer updated');
    } else patchUi({ lastAnswered: q.id });
  };

  const setRating = (s: InterviewState, food: string, level: Level): InterviewState => {
    const key = FOOD_GROUP_A.includes(food) ? 'rateA' : 'rateB';
    return { ...s, answers: { ...s.answers, [key]: { ...asRatings(s.answers[key]), [food]: level } }, updatedAt: Date.now() };
  };

  const actions = {
    go: (screen: Screen) => patchUi({ screen, sheet: null, sheetArg: null }),
    openSheet: (sheet: SheetName, sheetArg: SheetArg | null = null) => patchUi({ sheet, sheetArg }),
    closeSheet: () => patchUi({ sheet: null, sheetArg: null }),
    toast,
    setDraft: (id: string, v: AnswerValue) => setUi((u) => ({ ...u, drafts: { ...u.drafts, [id]: v } })),

    /* ---------- interview ---------- */
    start: () => {
      setInterview((s) => ({ ...s, started: true, current: s.current ?? firstOpen(s)?.id ?? Q[0].id }));
      patchUi({ screen: 'interview', lastAnswered: null, sheet: null });
    },
    submit: (q: Question, v: AnswerValue) => {
      const { state, next } = answerQuestion(interview, q, v, !!ui.editReturn);
      afterAnswer(state, next, q);
    },
    skip: (q: Question) => {
      const { state, next } = skipQuestion(interview, q, !!ui.editReturn);
      afterAnswer(state, next, q);
    },
    back: (q: Question) => {
      const prev = prevBefore(interview.answers, q);
      if (!prev) return patchUi({ screen: 'welcome' });
      setInterview((s) => ({ ...s, current: prev.id }));
      patchUi({ lastAnswered: null });
    },
    goToQuestion: (id: string) => {
      setInterview((s) => ({ ...s, current: id }));
      patchUi({ screen: 'interview', lastAnswered: null, sheet: null });
    },
    /** Jump into the interview to change one answer, then come back. */
    edit: (id: string) => {
      if (!QBY[id]) return;
      const from = ui.screen === 'interview' ? null : ui.screen;
      setInterview((s) => ({ ...s, current: id }));
      dropDraft(id);
      patchUi({ screen: 'interview', editReturn: from && interview.done ? from : null, lastAnswered: null, sheet: null });
    },
    cancelEdit: () => {
      setInterview((s) => ({ ...s, current: null }));
      patchUi({ screen: ui.editReturn ?? 'summary', editReturn: null });
    },
    saveAndExit: () => {
      void saveInterview(interview);
      patchUi({ screen: 'resume', sheet: null });
      toast('Progress saved');
    },
    useSample: () => {
      setInterview({ ...fillWithSamples(emptyInterview()), confirmed: false });
      setPlanState(emptyPlanState());
      patchUi({ screen: 'summary', drafts: {}, editReturn: null, sheet: null });
      toast('Sample profile loaded');
    },
    loadHalfSample: () => {
      setInterview(fillWithSamples(emptyInterview(), 'picky'));
      patchUi({ drafts: {}, sheet: null });
      toast('Loaded a half-finished interview');
    },
    fillRest: () => {
      setInterview((s) => fillWithSamples(s));
      patchUi({ screen: 'summary', sheet: null, editReturn: null });
      toast('Filled the rest with example answers');
    },
    /** Confirm the profile and build the first week. */
    confirm: () => {
      const s = { ...interview, confirmed: true, updatedAt: Date.now() };
      const variety = defaultVariety(activeAnswers(s));
      setInterview(s);
      // The first week is cooked on the next prep day; reminders and “today” follow that date.
      setPlanState((p) => {
        const plan = fitted(buildPlan(variety, planContext(s, p)).plan, s, p);
        return { ...p, variety, day: 0, weekStartedAt: Date.now(), plan, ahead: planAhead(plan, [], variety, planContext(s, p), goalsOf(p.nutrition, activeAnswers(s))) };
      });
      patchUi({ screen: 'planner' });
      toast('Your week is ready. Review each meal.');
    },
    /** Delete everything on this device and, when signed in, the cloud copy too. */
    restart: async () => {
      try {
        await sync.deleteCloudCopy();
      } catch {
        toast('Couldn’t reach the cloud copy. Try again when you’re online.');
        return;
      }
      // Stop notifications on this device too.
      await disablePush().catch(() => {});
      await deleteEverything();
      // Change time 0 means “nothing here”, so the empty state isn't uploaded as new data.
      stampNext.current = { interview: 0, plan: 0 };
      setInterview(emptyInterview());
      setPlanState(emptyPlanState());
      setHealth(emptyBody());
      setUi(initialUi());
      toast('Everything deleted');
    },

    /* ---------- planner ---------- */
    selectDay: (d: number) => patchPlan({ day: d }),
    /** Show another week of the month in the planner (0 = this week). */
    selectWeek: (w: number) => patchUi({ week: Math.max(0, Math.min(w, planState.ahead.length)) }),
    setPlanView: (planView: UiState['planView']) => patchUi({ planView }),
    /** From the month calendar: open a week's day in the planner. */
    openDay: (w: number, i: number) => {
      patchUi({ week: w, planView: 'week', sheet: null });
      patchPlan({ day: i });
    },
    setShopDays: (patch: Partial<ShopDays>) => setPlanState((s) => ({ ...s, shopDays: { ...s.shopDays, ...patch } })),
    setVariety: (v: Variety) => {
      const kept = planState.plan ? planState.plan.flatMap((d) => Object.values(d.meals)).filter((m) => m?.ok).length : 0;
      const plan = fitted(buildPlan(v, planContext(interview, planState), planState.plan).plan, interview, planState);
      patchPlan({ variety: v, plan, ahead: planState.ahead.length ? aheadFor(plan, interview, planState, v) : planState.ahead });
      toast(kept ? `${WEEKS[v].label}: kept ${kept} approved meal${kept > 1 ? 's' : ''}, rebuilt the rest` : `${WEEKS[v].label}: plan rebuilt`);
    },
    /** A different menu for every meal that isn't approved; tap again for another option. */
    regenerate: () => {
      if (!viewPlan) return;
      const seed = shuffles.current++;
      const variety = planState.variety ?? defaultVariety(activeAnswers(interview));
      const { plan, changed } = regenerate(variety, planContext(interview, planState), viewPlan, seed);
      const kept = viewPlan.flatMap((d) => Object.values(d.meals)).filter((m) => m?.ok).length;
      setPlanState(withWeek(planState, ui.week, fitted(plan, interview, planState)));
      toast(changed ? `New menu: ${changed} meal${changed > 1 ? 's' : ''} changed${kept ? `, ${kept} approved kept` : ''}. Tap again for another.` : 'Nothing else fits your rules for these meals');
    },
    /** Fit this week to the daily goals now (new weeks are fitted automatically). */
    fitGoals: () => {
      const goals = goalsOf(planState.nutrition, activeAnswers(interview));
      if (!viewPlan || !hasGoals(goals)) return;
      const r = fitToGoals(viewPlan, planContext(interview, planState), goals);
      setPlanState(withWeek(planState, ui.week, r.plan));
      const parts = [
        r.swapped && `${r.swapped} meal${r.swapped > 1 ? 's' : ''} swapped`,
        r.sides && `${r.sides} protein side${r.sides > 1 ? 's' : ''} added`,
        r.scale !== 1 && `portions ${pct(r.scale)}`,
        r.dayFixes && `${r.dayFixes} day${r.dayFixes > 1 ? 's' : ''} evened out`,
      ].filter(Boolean);
      toast(parts.length ? `Fitted to your goals: ${parts.join(', ')}` : 'Your week already fits your goals');
    },
    toggleApproved: (d: number, slot: Slot) => updatePlan((p) => setApproved(p, d, slot, !p[d].meals[slot]?.ok)),
    approveDay: (d: number) => {
      updatePlan((p) => approveDay(p, d));
      toast('Day approved');
    },
    approveAll: () => {
      updatePlan(approveAll);
      toast('Whole week approved');
    },
    /**
     * Swap in a recipe. With a reason, the rejected recipe is ranked lower from now on.
     * `keep` is a new AI recipe to save with the user's data first.
     */
    replace: (d: number, slot: Slot, recipeId: string, reason?: RejectReason, keep?: Recipe) => {
      const base = keep ? { ...planState, aiRecipes: { ...planState.aiRecipes, [keep.id]: keep } } : planState;
      if (keep) registerAiRecipes(base.aiRecipes);
      const cur = weekOf(base, ui.week);
      if (!cur) return;
      const old = cur[d].meals[slot]?.r;
      let p: PlanState = withWeek(base, ui.week, replaceMeal(cur, d, slot, recipeId));
      if (old && reason) p = learnFromRejection(p, old, reason.why);
      if (reason?.food) {
        const s = setRating(interview, reason.food, 'dislike');
        setInterview(s);
        setPlanState(p);
        refreshPlan(s, p);
        toast(`${FOODS[reason.food].n} marked Dislike. You can change that in your profile.`);
      } else {
        setPlanState(p);
        toast(`Swapped in ${R[recipeId].short.toLowerCase()}`);
      }
      patchUi({ sheet: null, sheetArg: null });
    },
    move: (from: number, to: number, slot: Slot) => {
      updatePlan((p) => swapMeals(p, from, to, slot));
      patchUi({ sheet: null, sheetArg: null });
      toast('Meal moved');
    },
    /** Plan a meal in a slot that was skipped or eaten out. */
    planAnyway: (d: number, slot: Slot) => {
      updatePlan((p) => openSlot(p, d, slot));
      patchUi({ sheet: 'replace', sheetArg: { d, slot } });
    },
    setSide: (d: number, slot: Slot, sideId: string | null) => {
      updatePlan((p) => setSide(p, d, slot, sideId));
      patchUi({ sheet: null, sheetArg: null });
      toast(sideId ? `Added ${R[sideId].short.toLowerCase()}` : 'Side removed');
    },
    balance: (days: number[]) => {
      if (!viewPlan) return;
      const ctx = planContext(interview, planState);
      let added = 0;
      const plan = viewPlan.map((day, i) => {
        if (!days.includes(i)) return day;
        const r = balanceDay(day, i, ctx);
        added += r.added;
        return r.day;
      });
      setPlanState(withWeek(planState, ui.week, plan));
      toast(added ? `Added ${added} side${added > 1 ? 's' : ''}. Remove any you don’t want.` : 'Nothing more fits your foods');
    },
    openRecipe: (id: string) => patchUi({ recipeId: id, recipeBack: ui.screen === 'recipe' ? ui.recipeBack : ui.screen, screen: 'recipe', sheet: null }),

    /* ---------- prep day ---------- */
    setPrepView: (prepView: UiState['prepView']) => patchUi({ prepView }),
    /** Tick a prep step off (or back on). Progress belongs to the current week. */
    markStep: (id: string, done: boolean) =>
      setPlanState((s) => {
        const cur = s.prepDone.week === s.weekStartedAt ? s.prepDone.done : {};
        const next = { ...cur };
        if (done) next[id] = true;
        else delete next[id];
        return { ...s, prepDone: { week: s.weekStartedAt, done: next } };
      }),
    resetPrep: () => setPlanState((s) => ({ ...s, prepDone: { week: s.weekStartedAt, done: {} } })),

    /* ---------- groceries ---------- */
    groceryEdit: (fn: (g: PlanState['groceries']) => PlanState['groceries']) => setPlanState((s) => ({ ...s, groceries: fn(s.groceries) })),
    /** Shop weekly for everything, or monthly for what keeps. */
    setShopping: (mode: ShopMode) => {
      setPlanState((s) => ({ ...s, shopping: mode, month: mode === 'monthly' && !s.month.startedAt ? { ...s.month, startedAt: Date.now() } : s.month }));
      toast(mode === 'monthly' ? 'Staples move to a monthly list' : 'Everything is back on the weekly list');
    },
    monthEdit: (fn: (g: PlanState['groceries']) => PlanState['groceries']) => setPlanState((s) => ({ ...s, month: { ...s.month, edits: fn(s.month.edits) } })),
    /** Clear the monthly list's check-offs and start a new month from this week. */
    newMonth: () => {
      setPlanState((s) => ({ ...s, month: { startedAt: Date.now(), edits: { ...emptyGroceryEdits(), have: s.month.edits.have } } }));
      toast('New month started');
    },

    /* ---------- weekly check-in and learning ---------- */
    editCheckin: (fn: (c: CheckinDraft) => CheckinDraft) => setPlanState((s) => ({ ...s, checkin: fn(s.checkin) })),
    /** Apply the check-in and plan next week. */
    saveCheckin: () => {
      setPlanState(applyCheckin(planState, activeAnswers(interview)).next);
      patchUi({ screen: 'home', sheet: null });
      toast('Check-in saved. Next week is planned.');
    },
    answerNotice: (answer: Noticed) => {
      const s = noticeSuggestion(activeAnswers(interview), planState.noticed);
      if (!s) return;
      setPlanState(answerSuggestion(planState, s, answer));
      toast(answer === 'yes' ? 'It’ll be a side next week, once' : answer === 'stop' ? 'Got it. Remy won’t ask about that again.' : 'Got it');
    },
    forget: (id: string) => {
      setPlanState((s) => forgetLearned(s, id));
      toast('Deleted. Remy won’t use it.');
    },
    hideInference: (id: string) => {
      setPlanState((s) => ({ ...s, hiddenInferences: { ...s.hiddenInferences, [id]: true } }));
      toast('Deleted. Remy won’t use it.');
    },
    forgetAll: () => {
      setPlanState((s) => forgetAllLearned(s, activeAnswers(interview)));
      patchUi({ sheet: null });
      toast('Learned preferences deleted');
    },
    openFood: (food: string) => patchUi({ sheet: 'food', sheetFood: food }),
    setFoodLevel: (food: string, level: Level, levelName: string) => {
      const s = setRating(interview, food, level);
      setInterview(s);
      refreshPlan(s);
      patchUi({ sheet: null, sheetFood: null });
      toast(`${FOODS[food].n} moved to ${levelName}`);
    },
    /** Change one interview answer from a settings control, and update unapproved meals. */
    setAnswer: (id: string, v: AnswerValue, msg: string) => {
      const s = { ...interview, answers: { ...interview.answers, [id]: v }, updatedAt: Date.now() };
      setInterview(s);
      refreshPlan(s);
      toast(msg);
    },

    /* ---------- reminders ---------- */
    setReminders: (patch: Partial<ReminderSettings>) => setPlanState((s) => ({ ...s, reminders: { ...s.reminders, ...patch } })),

    /* ---------- AI ---------- */
    setAiConsent: (on: boolean) => {
      setPlanState((s) => ({ ...s, aiConsent: on }));
      toast(on ? 'AI ideas turned on' : 'AI ideas turned off. Nothing more is sent.');
    },
    /** Delete a saved AI recipe that isn't in the current week. */
    deleteAiRecipe: (id: string) => {
      const aiRecipes = { ...planState.aiRecipes };
      delete aiRecipes[id];
      registerAiRecipes(aiRecipes);
      setPlanState({ ...planState, aiRecipes });
      toast('Recipe deleted');
    },

    /* ---------- your data ---------- */
    /** Save everything to a file the user keeps. */
    exportData: () => {
      const blob = new Blob([JSON.stringify(makeBackup(interview, planState, health), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast('Backup saved to your downloads');
    },
    /** The pilot summary (learning/pilot.ts) as a file the person can choose to share. Nothing is uploaded. */
    downloadPilot: (includeWeight: boolean) => {
      const blob = new Blob([JSON.stringify(pilotFile(planState.progress, includeWeight), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = PILOT_FILE_NAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast('Summary saved to your downloads');
    },
    /** Read a backup file, then ask before replacing anything. */
    importFile: async (file: File) => {
      const r = readBackup(await file.text());
      if (!r.ok) return toast(r.reason);
      patchUi({ pendingImport: r.backup, sheet: 'confirmImport' });
    },
    confirmImport: () => {
      const b = ui.pendingImport;
      if (!b) return;
      let plan = b.plan;
      registerAiRecipes(plan.aiRecipes);
      if (b.interview.confirmed && !plan.plan) {
        const variety = plan.variety ?? defaultVariety(activeAnswers(b.interview));
        plan = { ...plan, variety, plan: buildPlan(variety, planContext(b.interview, plan)).plan };
      }
      setInterview(b.interview);
      setPlanState(plan);
      setHealth(b.health);
      setUi(initialUi(plan.plan ? 'home' : b.interview.done ? 'summary' : 'welcome'));
      toast('Backup restored');
    },

    /* ---------- nutrition ---------- */
    setEstimates: (on: boolean) => setPlanState((s) => ({ ...s, nutrition: { ...s.nutrition, nums: on } })),
    /** Update the details for the optional estimate (kept on this device unless body-detail sync is on). */
    setBody: (b: Partial<BodyProfile>) => setHealth((h) => ({ ...h, ...b, updatedAt: Date.now() })),
    /**
     * Share the body details and weigh-ins with the account, or stop. Turning it on doesn't change the details'
     * change time, so a newer copy from another device wins; turning it off deletes the cloud copy.
     */
    setHealthSync: (on: boolean) => {
      setHealth((h) => ({ ...h, sync: on }));
      if (on) toast('Body details will sync with your account');
      else
        void sync
          .stopHealthSync()
          .then(() => toast('Body details removed from the cloud. They stay on this device.'))
          .catch(() => toast('Couldn’t reach the cloud. Try again when you’re online.'));
    },
    /** Use Remy's estimate as the daily goals and fit this week and the drafts ahead to it. */
    useEstimate: () => {
      const A = activeAnswers(interview);
      const r = energyTargets(health, A);
      if (!r.ok) return toast(r.reason);
      const nutrition = { ...planState.nutrition, kcal: String(r.plan.target), pro: r.plan.proteinG ? String(r.plan.proteinG) : '', from: 'estimate' as const, floor: r.plan.floor };
      let next: PlanState = { ...planState, nutrition };
      const goals = goalsOf(nutrition, A);
      if (hasGoals(goals) && next.plan) {
        const ctx = planContext(interview, next);
        next = { ...next, plan: fitToGoals(next.plan, ctx, goals).plan, ahead: next.ahead.map((w) => fitToGoals(w, ctx, goals).plan) };
      }
      setPlanState(next);
      setHealth((h) => ({ ...h, consent: true, updatedAt: Date.now() }));
      patchUi({ sheet: null });
      toast(`Your menu now aims for about ${r.plan.target.toLocaleString('en-US')} kcal a day`);
    },
    /** Delete the estimate details from this device; goals that came from the estimate go too. */
    forgetBody: () => {
      if (health.sync) void sync.stopHealthSync().catch(() => {});
      setHealth(emptyBody());
      if (planState.nutrition.from === 'estimate') setPlanState((s) => ({ ...s, nutrition: { ...s.nutrition, kcal: '', pro: '', from: 'typed', floor: null } }));
      patchUi({ sheet: null });
      toast(health.sync ? 'Your details are deleted from this device and the cloud' : 'Your details are deleted from this device');
    },
    setTargets: (kcal: string, pro: string) => setPlanState((s) => ({ ...s, nutrition: { ...s.nutrition, kcal, pro, from: 'typed', floor: null } })),
    setBalanceMode: (v: string) => {
      const s = { ...interview, answers: { ...interview.answers, balance: v }, updatedAt: Date.now() };
      setInterview(s);
      toast('Balance checks on');
    },
  };

  const ctx = planContext(interview, planState);
  return { interview, planState, health, viewPlan, ui, ctx, actions, sync };
}

type Remy = ReturnType<typeof useRemyState>;
const Ctx = createContext<Remy | null>(null);

function Provider({ initial, children }: { initial: Initial; children: ReactNode }) {
  const value = useRemyState(initial);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Loads saved progress from the device, then renders the app. */
export function RemyProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [initial, setInitial] = useState<Initial | null>(null);
  useEffect(() => {
    void Promise.all([loadInterview(), loadPlanState(), loadHealth()]).then(([interview, plan, health]) => {
      registerAiRecipes(plan.aiRecipes);
      // Profiles confirmed before planning existed get their first week now.
      if (interview.confirmed && !plan.plan) {
        const variety = defaultVariety(activeAnswers(interview));
        plan = { ...plan, variety, plan: buildPlan(variety, planContext(interview, plan)).plan };
      }
      // Recipes deleted from the menu since the plan was made are swapped out.
      if (plan.plan) plan = { ...plan, plan: dropRemoved(plan.plan, planContext(interview, plan)).plan, ahead: plan.ahead.map((w) => dropRemoved(w, planContext(interview, plan)).plan) };
      setInitial({ interview, plan, health });
    });
  }, []);
  if (!initial) return <>{fallback}</>;
  return <Provider initial={initial}>{children}</Provider>;
}

export function useRemy(): Remy {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRemy must be used inside RemyProvider');
  return v;
}

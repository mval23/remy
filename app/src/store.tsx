import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { activeAnswers, answerQuestion, fillWithSamples, firstOpen, prevBefore, skipQuestion } from './interview/engine';
import { asRatings } from './interview/helpers';
import { FOOD_GROUP_A, FOODS, Q, QBY } from './interview/questions';
import { emptyInterview, type AnswerValue, type InterviewState, type Level, type Question } from './interview/types';
import { answerSuggestion, applyCheckin, forgetAllLearned, forgetLearned, learnFromRejection, noticeSuggestion } from './learning/learning';
import type { CheckinDraft, Noticed } from './learning/types';
import { R, registerAiRecipes } from './planning/data/recipes';
import { WEEKS } from './planning/data/weeks';
import { balanceDay } from './planning/nutrition';
import {
  approveAll,
  approveDay,
  buildPlan,
  openSlot,
  replaceMeal,
  setApproved,
  setSide,
  swapMeals,
} from './planning/planner';
import { context, defaultVariety, type PlanContext } from './planning/rules';
import type { Recipe, Slot, Variety, WeekPlan } from './planning/types';
import { backupFileName, makeBackup, readBackup, type Backup } from './storage/backup';
import {
  deleteEverything,
  emptyPlanState,
  loadInterview,
  loadPlanState,
  saveInterview,
  savePlanState,
  type PlanState,
} from './storage/db';
import { useSync } from './sync/useSync';

export type Screen =
  | 'welcome' | 'interview' | 'resume' | 'summary' | 'home' | 'planner' | 'nutrition' | 'recipe' | 'grocery' | 'prep'
  | 'account' | 'checkin' | 'prefs';
export type SheetName = 'map' | 'options' | 'confirmRestart' | 'replace' | 'move' | 'side' | 'food' | 'confirmForget' | 'confirmImport';
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
  /** Food whose level is being changed (food sheet). */
  sheetFood: string | null;
  /** A backup file that was read and is waiting for confirmation. */
  pendingImport: Backup | null;
}

export interface RejectReason {
  why: string | null;
  /** Food to mark as Dislike, chosen in the reject sheet. */
  food: string | null;
}

const initialUi = (screen: Screen = 'welcome'): UiState => ({
  screen, editReturn: null, lastAnswered: null, drafts: {}, sheet: null, sheetArg: null, toast: null, recipeId: null, recipeBack: 'planner',
  sheetFood: null, pendingImport: null,
});

const planContext = (s: InterviewState, p: PlanState): PlanContext => context(activeAnswers(s), p.adj, p.hungry);

function useRemyState(initial: { interview: InterviewState; plan: PlanState }) {
  const [interview, setInterview] = useState<InterviewState>(initial.interview);
  const [planState, setPlanState] = useState<PlanState>(initial.plan);
  // Saved AI recipes must be in the library before anything below (or any screen) looks them up.
  registerAiRecipes(planState.aiRecipes);
  const [ui, setUi] = useState<UiState>(() => initialUi(initial.plan.plan ? 'home' : 'welcome'));
  const toastTimer = useRef<number | undefined>(undefined);
  /** Change time to save with the next update. Set when applying the cloud copy, so it isn't re-uploaded as “new”. */
  const stampNext = useRef<{ interview?: number; plan?: number }>({});

  const sync = useSync({
    interview,
    planState,
    applyInterview: (value, at) => {
      stampNext.current.interview = at;
      setInterview(value);
    },
    applyPlan: (value, at) => {
      stampNext.current.plan = at;
      setPlanState(value);
      // A second device that just signed in: jump from the welcome screen to the synced week.
      if (value.plan) setUi((u) => (u.screen === 'welcome' ? { ...u, screen: 'home' } : u));
    },
  });

  // Opening a password-reset link lands on the Sync & install screen to choose a new password.
  useEffect(() => {
    if (sync.recovery) setUi((u) => ({ ...u, screen: 'account', sheet: null }));
  }, [sync.recovery]);

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

  const patchUi = (p: Partial<UiState>) => setUi((u) => ({ ...u, ...p }));
  const patchPlan = (p: Partial<PlanState>) => setPlanState((s) => ({ ...s, ...p }));
  const updatePlan = (fn: (plan: WeekPlan) => WeekPlan) => setPlanState((s) => (s.plan ? { ...s, plan: fn(s.plan) } : s));
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
    const { plan, changed } = buildPlan(p.variety ?? defaultVariety(activeAnswers(s)), planContext(s, p), p.plan);
    setPlanState({ ...p, plan });
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
      setPlanState((p) => ({ ...p, variety, day: 0, plan: buildPlan(variety, planContext(s, p)).plan }));
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
      await deleteEverything();
      // Change time 0 means “nothing here”, so the empty state isn't uploaded as new data.
      stampNext.current = { interview: 0, plan: 0 };
      setInterview(emptyInterview());
      setPlanState(emptyPlanState());
      setUi(initialUi());
      toast('Everything deleted');
    },

    /* ---------- planner ---------- */
    selectDay: (d: number) => patchPlan({ day: d }),
    setVariety: (v: Variety) => {
      const kept = planState.plan ? planState.plan.flatMap((d) => Object.values(d.meals)).filter((m) => m?.ok).length : 0;
      const plan = buildPlan(v, planContext(interview, planState), planState.plan).plan;
      patchPlan({ variety: v, plan });
      toast(kept ? `${WEEKS[v].label}: kept ${kept} approved meal${kept > 1 ? 's' : ''}, rebuilt the rest` : `${WEEKS[v].label}: plan rebuilt`);
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
      const old = base.plan?.[d].meals[slot]?.r;
      let p: PlanState = { ...base, plan: base.plan && replaceMeal(base.plan, d, slot, recipeId) };
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
      if (!planState.plan) return;
      const ctx = planContext(interview, planState);
      let added = 0;
      const plan = planState.plan.map((day, i) => {
        if (!days.includes(i)) return day;
        const r = balanceDay(day, i, ctx);
        added += r.added;
        return r.day;
      });
      patchPlan({ plan });
      toast(added ? `Added ${added} side${added > 1 ? 's' : ''}. Remove any you don’t want.` : 'Nothing more fits your foods');
    },
    openRecipe: (id: string) => patchUi({ recipeId: id, recipeBack: ui.screen === 'recipe' ? ui.recipeBack : ui.screen, screen: 'recipe', sheet: null }),

    /* ---------- groceries ---------- */
    groceryEdit: (fn: (g: PlanState['groceries']) => PlanState['groceries']) => setPlanState((s) => ({ ...s, groceries: fn(s.groceries) })),

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
      const blob = new Blob([JSON.stringify(makeBackup(interview, planState), null, 2)], { type: 'application/json' });
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
      setUi(initialUi(plan.plan ? 'home' : b.interview.done ? 'summary' : 'welcome'));
      toast('Backup restored');
    },

    /* ---------- nutrition ---------- */
    setEstimates: (on: boolean) => setPlanState((s) => ({ ...s, nutrition: { ...s.nutrition, nums: on } })),
    setTargets: (kcal: string, pro: string) => setPlanState((s) => ({ ...s, nutrition: { ...s.nutrition, kcal, pro } })),
    setBalanceMode: (v: string) => {
      const s = { ...interview, answers: { ...interview.answers, balance: v }, updatedAt: Date.now() };
      setInterview(s);
      toast('Balance checks on');
    },
  };

  const ctx = planContext(interview, planState);
  return { interview, planState, ui, ctx, actions, sync };
}

type Remy = ReturnType<typeof useRemyState>;
const Ctx = createContext<Remy | null>(null);

function Provider({ initial, children }: { initial: { interview: InterviewState; plan: PlanState }; children: ReactNode }) {
  const value = useRemyState(initial);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Loads saved progress from the device, then renders the app. */
export function RemyProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [initial, setInitial] = useState<{ interview: InterviewState; plan: PlanState } | null>(null);
  useEffect(() => {
    void Promise.all([loadInterview(), loadPlanState()]).then(([interview, plan]) => {
      registerAiRecipes(plan.aiRecipes);
      // Profiles confirmed before planning existed get their first week now.
      if (interview.confirmed && !plan.plan) {
        const variety = defaultVariety(activeAnswers(interview));
        plan = { ...plan, variety, plan: buildPlan(variety, planContext(interview, plan)).plan };
      }
      setInitial({ interview, plan });
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

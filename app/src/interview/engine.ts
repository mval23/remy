import { FOODS, LEVELS, Q, QBY, SECTIONS } from './questions';
import { arr, asBudget, asPreparations, asRatings, clone, money, str } from './helpers';
import type { AnswerValue, Answers, InterviewState, Option, Question } from './types';

/* ---------- which questions apply ---------- */

export function applies(q: Question, A: Answers): boolean {
  if (!q.when) return true;
  try {
    return q.when(A);
  } catch {
    return false;
  }
}

/** The questions that currently apply, in order. Changes as answers change. */
export function sequence(A: Answers): Question[] {
  return Q.filter((q) => applies(q, A));
}

export function isAnswered(s: InterviewState, id: string): boolean {
  return s.answers[id] !== undefined || !!s.skipped[id];
}

/** Answers from questions that still apply. Answers left over from abandoned branches are ignored. */
export function activeAnswers(s: InterviewState): Answers {
  const out: Answers = {};
  for (const q of sequence(s.answers)) if (s.answers[q.id] !== undefined) out[q.id] = s.answers[q.id];
  return out;
}

export function nextAfter(A: Answers, q: Question): Question | null {
  return sequence(A).find((x) => x.i > q.i) ?? null;
}

export function prevBefore(A: Answers, q: Question): Question | null {
  let prev: Question | null = null;
  for (const x of sequence(A)) if (x.i < q.i) prev = x;
  return prev;
}

export function firstOpen(s: InterviewState): Question | null {
  return sequence(s.answers).find((x) => !isAnswered(s, x.id)) ?? null;
}

export function currentQuestion(s: InterviewState): Question | null {
  const q = s.current ? QBY[s.current] : undefined;
  if (q && applies(q, s.answers)) return q;
  return firstOpen(s);
}

export function optionsOf(q: Question, A: Answers): Option[] {
  const raw = q.optsFn ? q.optsFn(A) : q.opts ?? [];
  return raw.map((x) => (typeof x === 'string' ? { v: x } : x));
}

/* ---------- progress ---------- */

export function sectionStats(s: InterviewState) {
  const seq = sequence(s.answers);
  return SECTIONS.map((sec) => {
    const qs = seq.filter((q) => q.sec === sec.id);
    return { sec, total: qs.length, done: qs.filter((q) => isAnswered(s, q.id)).length };
  });
}

export function progress(s: InterviewState) {
  const seq = sequence(s.answers);
  return { done: seq.filter((q) => isAnswered(s, q.id)).length, total: seq.length };
}

/* ---------- answers ---------- */

export function isValid(q: Question, v: AnswerValue | undefined): boolean {
  if (!q.required) return true;
  if (v === undefined || v === null) return false;
  switch (q.type) {
    case 'single':
      return !!v;
    case 'rate':
      return Object.keys(asRatings(v)).length >= 3;
    case 'ways':
      return true;
    case 'budget':
      return !!asBudget(v)?.amount;
    default:
      return Array.isArray(v) ? v.length > 0 : !!v;
  }
}

/** The starting value for a question’s answer controls. */
export function initialDraft(q: Question, s: InterviewState): AnswerValue {
  const existing = s.answers[q.id];
  if (existing !== undefined) return clone(existing);
  switch (q.type) {
    case 'rate': {
      // Foods already on the never-list are pre-marked, so they aren’t asked about twice.
      const never = arr(s.answers.never).map((x) => x.toLowerCase());
      const r: Record<string, 'never'> = {};
      for (const f of q.foods ?? []) if (never.includes(FOODS[f].n.toLowerCase())) r[f] = 'never';
      return r;
    }
    case 'ways':
      return {};
    case 'budget':
      return { amount: '', currency: 'USD' };
    case 'single':
    case 'number':
      return '';
    default:
      return [];
  }
}

export function formatAnswer(q: Question, v: AnswerValue | undefined, skipped = false): string {
  if (v === undefined) return skipped ? 'Skipped' : '';
  switch (q.type) {
    case 'rate': {
      const counts: Record<string, number> = {};
      for (const lv of Object.values(asRatings(v))) counts[lv] = (counts[lv] ?? 0) + 1;
      return LEVELS.filter((l) => counts[l.id]).map((l) => `${l.label} ${counts[l.id]}`).join(' · ') || 'No ratings';
    }
    case 'ways': {
      const p = asPreparations(v);
      const foods = Object.keys(p).filter((f) => p[f]?.length);
      return foods.length ? foods.map((f) => `${FOODS[f].n}: ${p[f].join(', ').toLowerCase()}`).join('; ') : 'No preferences';
    }
    case 'budget': {
      const b = asBudget(v);
      return b && b.amount ? `${money(b.amount, b.currency)} per week` : 'Not set';
    }
    case 'number':
      return str(v) ? `${str(v)} kcal per day (estimate)` : 'No number';
    default:
      if (Array.isArray(v)) return v.length ? v.join(', ') : 'None';
      return String(v);
  }
}

/* ---------- state transitions ---------- */

export type AfterAnswer =
  | { kind: 'question'; id: string }
  | { kind: 'finished' }
  | { kind: 'returnFromEdit' };

/**
 * Record an answer and decide where to go next.
 * While editing a single answer, new follow-ups it unlocks are asked before returning.
 */
export function answerQuestion(
  s: InterviewState,
  q: Question,
  v: AnswerValue,
  editing: boolean,
): { state: InterviewState; next: AfterAnswer } {
  const answers = { ...s.answers, [q.id]: clone(v) };
  const skipped = { ...s.skipped };
  delete skipped[q.id];
  let state: InterviewState = { ...s, answers, skipped, started: true, updatedAt: Date.now() };

  if (q.id === 'allergy_confirm' && v === 'Let me change my answer') {
    const rest = { ...answers };
    delete rest.allergy_confirm;
    state = { ...state, answers: rest, current: 'allergies' };
    return { state, next: { kind: 'question', id: 'allergies' } };
  }
  return advance(state, q, editing);
}

export function skipQuestion(s: InterviewState, q: Question, editing: boolean) {
  const answers = { ...s.answers };
  delete answers[q.id];
  const state: InterviewState = { ...s, answers, skipped: { ...s.skipped, [q.id]: true }, started: true, updatedAt: Date.now() };
  return advance(state, q, editing);
}

function advance(state: InterviewState, q: Question, editing: boolean): { state: InterviewState; next: AfterAnswer } {
  const n = nextAfter(state.answers, q);
  if (editing) {
    if (n && n.when && !isAnswered(state, n.id)) return { state: { ...state, current: n.id }, next: { kind: 'question', id: n.id } };
    return { state: { ...state, current: null }, next: { kind: 'returnFromEdit' } };
  }
  if (!n) return { state: { ...state, done: true, current: null }, next: { kind: 'finished' } };
  return { state: { ...state, current: n.id }, next: { kind: 'question', id: n.id } };
}

/** Fill unanswered questions with the sample picky-eater answers (for demos and tests). */
export function fillWithSamples(s: InterviewState, stopAtSection?: string): InterviewState {
  let state: InterviewState = { ...s, answers: { ...s.answers }, skipped: { ...s.skipped }, started: true };
  for (let k = 0; k < 200; k++) {
    const q = firstOpen(state);
    if (!q || (stopAtSection && q.sec === stopAtSection)) break;
    if (q.sample === '' || q.sample === undefined) state.skipped[q.id] = true;
    else state.answers[q.id] = clone(q.sample);
  }
  const open = firstOpen(state);
  return { ...state, current: open?.id ?? null, done: !open, updatedAt: Date.now() };
}

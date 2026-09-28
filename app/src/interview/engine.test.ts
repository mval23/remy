import { describe, expect, it } from 'vitest';
import {
  activeAnswers,
  answerQuestion,
  currentQuestion,
  fillWithSamples,
  formatAnswer,
  initialDraft,
  isValid,
  optionsOf,
  prevBefore,
  sequence,
  skipQuestion,
} from './engine';
import { toggleOption } from './helpers';
import { Q, QBY } from './questions';
import { emptyInterview, type Answers } from './types';
import { LATER_IDS, laterQuestions } from '../profile/profile';

const ids = (A: Answers) => sequence(A).map((q) => q.id);

describe('branching', () => {
  it('asks the allergy confirmation only when an allergy is selected', () => {
    expect(ids({ allergies: ['None'] })).not.toContain('allergy_confirm');
    expect(ids({ allergies: ['Shellfish'] })).toContain('allergy_confirm');
    expect(QBY.allergy_confirm.say({ allergies: ['Shellfish', 'Sesame'] })).toContain('Shellfish and Sesame');
  });

  it('asks goal follow-ups only for weight loss, and calories only for detailed guidance', () => {
    const lose = { goal: 'Lose weight and body fat, sustainably' };
    expect(ids({ goal: 'Save time on cooking' })).not.toContain('pace');
    expect(ids({ goal: 'Save time on cooking' })).not.toContain('progress');
    expect(ids(lose)).toEqual(expect.arrayContaining(['pace', 'progress']));
    expect(ids({ ...lose, pace: 'Some structure' })).not.toContain('calories');
    expect(ids({ ...lose, pace: 'Detailed' })).toContain('calories');
  });

  it('asks about preparations only for foods rated “Some ways”', () => {
    expect(ids({ rateA: { chicken: 'love' } })).not.toContain('ways');
    expect(ids({ rateA: { eggs: 'ways' } })).toContain('ways');
  });

  it('asks why vegetables miss only after two or more vegetable dislikes', () => {
    expect(ids({ rateB: { zucchini: 'dislike' } })).not.toContain('vegwhy');
    expect(ids({ rateB: { zucchini: 'dislike', mushrooms: 'never' } })).toContain('vegwhy');
    // Fruit doesn't count as a vegetable.
    expect(ids({ rateB: { zucchini: 'dislike', apples: 'dislike' } })).not.toContain('vegwhy');
  });

  it('asks about components only when leftovers are a problem', () => {
    expect(ids({ leftovers: 'Love them' })).not.toContain('components');
    expect(ids({ leftovers: 'I dislike leftovers' })).toContain('components');
  });

  it('offers only the meals the user eats when asking what prep day covers', () => {
    const A = { schedule: ['Breakfast', 'Dinner'] };
    expect(optionsOf(QBY.fromprep, A).map((o) => o.v)).toEqual(['Breakfast', 'Dinner']);
  });
});

describe('answering', () => {
  it('moves to the next applicable question', () => {
    const s = emptyInterview();
    const { state, next } = answerQuestion(s, QBY.allergies, ['None'], false);
    expect(next).toEqual({ kind: 'question', id: 'intolerances' });
    expect(state.started).toBe(true);
  });

  it('“Let me change my answer” returns to the allergy list', () => {
    let s = answerQuestion(emptyInterview(), QBY.allergies, ['Shellfish'], false).state;
    expect(currentQuestion(s)?.id).toBe('allergy_confirm');
    const r = answerQuestion(s, QBY.allergy_confirm, 'Let me change my answer', false);
    s = r.state;
    expect(r.next).toEqual({ kind: 'question', id: 'allergies' });
    expect(s.answers.allergy_confirm).toBeUndefined();
  });

  it('when editing, asks newly unlocked follow-ups before returning', () => {
    const done = fillWithSamples(emptyInterview());
    // The sample has no leftover issues; changing that unlocks the components question.
    const r1 = answerQuestion(done, QBY.leftovers, 'I dislike leftovers', true);
    expect(r1.next).toEqual({ kind: 'question', id: 'components' });
    const r2 = answerQuestion(r1.state, QBY.components, 'Yes, 5 minutes of assembly is fine', true);
    expect(r2.next).toEqual({ kind: 'returnFromEdit' });
  });

  it('skipping records the skip and clears any answer', () => {
    const s = { ...emptyInterview(), answers: { never: ['Olives'] } };
    const { state } = skipQuestion(s, QBY.never, false);
    expect(state.skipped.never).toBe(true);
    expect(state.answers.never).toBeUndefined();
  });

  it('ignores answers from branches that no longer apply', () => {
    let s = fillWithSamples(emptyInterview());
    expect(activeAnswers(s).ways).toBeDefined();
    // Re-rate every “Some ways” food so the preparations question no longer applies.
    const rateA = { ...(s.answers.rateA as Record<string, string>), eggs: 'like', yogurt: 'like' };
    const rateB = { ...(s.answers.rateB as Record<string, string>), broccoli: 'like', spinach: 'like', tomatoes: 'like', onions: 'like' };
    s = { ...s, answers: { ...s.answers, rateA: rateA as never, rateB: rateB as never } };
    expect(s.answers.ways).toBeDefined();
    expect(activeAnswers(s).ways).toBeUndefined();
  });

  it('goes back to the previous applicable question', () => {
    const A = { allergies: ['None'] };
    expect(prevBefore(A, QBY.intolerances)?.id).toBe('allergies');
    expect(prevBefore({ allergies: ['Soy'] }, QBY.intolerances)?.id).toBe('allergy_confirm');
  });
});

describe('sample profile', () => {
  it('completes the interview, asking 59 of the 61 interview questions', () => {
    const s = fillWithSamples(emptyInterview());
    expect(Q.length).toBe(61 + LATER_IDS.length);
    expect(s.done).toBe(true);
    expect(sequence(s.answers).length).toBe(59);
  });

  it('leaves the later questions for check-ins, then treats them as normal answers', () => {
    const s = fillWithSamples(emptyInterview());
    expect(laterQuestions(s.answers).map((q) => q.id)).toEqual(LATER_IDS);
    const answered = { ...s.answers, frozenveg: 'Fresh only' };
    expect(sequence(answered).map((q) => q.id)).toContain('frozenveg');
    expect(laterQuestions(answered).map((q) => q.id)).toEqual(['brands', 'homedishes']);
  });

  it('can stop part-way for a half-finished example', () => {
    const s = fillWithSamples(emptyInterview(), 'picky');
    expect(s.done).toBe(false);
    expect(currentQuestion(s)?.sec).toBe('picky');
  });
});

describe('answer helpers', () => {
  it('keeps the “none” option exclusive', () => {
    expect(toggleOption(['Soy'], 'None', 'None')).toEqual(['None']);
    expect(toggleOption(['None'], 'Soy', 'None')).toEqual(['Soy']);
    expect(toggleOption(['Soy', 'Fish'], 'Soy', 'None')).toEqual(['Fish']);
  });

  it('pre-marks foods from the never-list as Never', () => {
    const s = { ...emptyInterview(), answers: { never: ['Mushrooms'] } };
    expect(initialDraft(QBY.rateB, s)).toEqual({ mushrooms: 'never' });
  });

  it('validates required answers', () => {
    expect(isValid(QBY.allergies, [])).toBe(false);
    expect(isValid(QBY.allergies, ['None'])).toBe(true);
    expect(isValid(QBY.rateA, { chicken: 'love', rice: 'love' })).toBe(false);
    expect(isValid(QBY.rateA, { chicken: 'love', rice: 'love', pasta: 'like' })).toBe(true);
    expect(isValid(QBY.never, [])).toBe(true);
  });

  it('formats answers for the conversation and profile', () => {
    expect(formatAnswer(QBY.budget, { amount: 110, currency: 'USD' })).toBe('$110 per week');
    expect(formatAnswer(QBY.rateA, { chicken: 'love', rice: 'love', beans: 'dislike' })).toBe('Love 2 · Dislike 1');
    expect(formatAnswer(QBY.never, undefined, true)).toBe('Skipped');
  });
});

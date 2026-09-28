import { useState } from 'react';
import { AnswerControls } from '../components/AnswerControls';
import { BottomNav, Header } from '../components/Chrome';
import { Leader, Mast, SecHead } from '../components/Dish';
import { Icon } from '../components/Icon';
import { applyCheckin, BODY_QUESTIONS, bodyCheckinOn, checkinDue, mealsToRate, NOT_AGAIN_REASONS, weekQuestions, weightOn, type CheckinQuestion } from '../learning/learning';
import type { CheckinDraft, MealRating } from '../learning/types';
import type { AnswerValue, Question as InterviewQuestion } from '../interview/types';
import { R } from '../planning/data/recipes';
import { laterQuestions } from '../profile/profile';
import { useRemy } from '../store';

const RATINGS: [MealRating, string, string][] = [
  ['loved', 'smile', 'Loved'],
  ['fine', 'meh', 'Fine'],
  ['no', 'frown', 'Not again'],
];

/** Toggle a value in a record: tapping the selected option clears it. */
function toggle<T>(rec: Record<string, T>, k: string, v: T): Record<string, T> {
  const next = { ...rec };
  if (next[k] === v) delete next[k];
  else next[k] = v;
  return next;
}

function Question({ f, value, onPick }: { f: CheckinQuestion; value: string | undefined; onPick: (o: string) => void }) {
  return (
    <div className="qline">
      <p className="strong">{f.q}</p>
      <div className="chips gap-top" role="group" aria-label={f.q}>
        {f.o.map((o) => (
          <button key={o} type="button" className="chip" aria-pressed={value === o} onClick={() => onPick(o)}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * One question the interview left for later. It saves to the profile right away,
 * separately from the check-in, and the next check-in asks the next one.
 */
function LaterQuestion({ q }: { q: InterviewQuestion }) {
  const { ctx, actions } = useRemy();
  const [draft, setDraft] = useState<AnswerValue>(q.type === 'chips' ? [] : '');
  const save = (v: AnswerValue) => {
    actions.setAnswer(q.id, v, q.ack?.(v, ctx.A) ?? 'Saved to your profile');
    actions.editCheckin((c) => ({ ...c, later: q.id }));
  };
  const empty = Array.isArray(draft) ? draft.length === 0 : !draft;
  return (
    <div className="qline stack">
      <p className="strong">{q.say(ctx.A)}</p>
      <p className="hint">One question from your interview that I saved for later. It goes into your profile.</p>
      <AnswerControls q={q} answers={ctx.A} draft={draft} setDraft={setDraft} pick={(v) => save(v)} submit={() => !empty && save(draft)} />
      {q.type === 'chips' && (
        <div className="row wrap">
          <button type="button" className="btn sm" disabled={empty} onClick={() => save(draft)}>
            Save answer
          </button>
          <button type="button" className="btn sm ghost" onClick={() => save([])}>
            Nothing comes to mind
          </button>
        </div>
      )}
    </div>
  );
}

/** Weekly check-in: rate the week's meals, a few quick questions, then see exactly what changes. */
export function Checkin() {
  const { planState, ctx, actions } = useRemy();
  const plan = planState.plan;
  if (!plan) return null;
  const A = ctx.A;
  const c = planState.checkin;
  const edit = (p: Partial<CheckinDraft>) => actions.editCheckin((x) => ({ ...x, ...p }));
  const pick = (id: string) => (o: string) => edit({ q: toggle(c.q, id, o) });
  const meals = mealsToRate(plan);
  const rated = meals.filter((m) => c.rated[m.id]).length;
  const { changes } = applyCheckin(planState, A);
  const later = c.later ? null : laterQuestions(A)[0];

  return (
    <>
      <Header title="Weekly check-in" back="home" />
      <main className="body">
        <Mast kicker="End of the week" title="How was the menu?" sub="About 2 minutes. Rate what you ate and skip anything you didn’t try, then I’ll plan next week around it." />

        <section className="msec">
          <SecHead title="This week’s dishes" aside={`${rated} of ${meals.length} rated`} />
          <div>
            {meals.map(({ id, times }) => {
              const r = R[id];
              const v = c.rated[id];
              const why = c.why[id] ?? [];
              return (
                <div className="rate-dish" key={id}>
                  <div className="dish-line">
                    <span className="dish-name">
                      <span aria-hidden="true">{r.e}</span> {r.short}
                    </span>
                    <Leader />
                    <span className="times">
                      {times} time{times > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="rate-row" role="group" aria-label={`Rate ${r.short}`}>
                      {RATINGS.map(([val, icon, label]) => (
                        <button key={val} type="button" className="chip rate-chip" aria-pressed={v === val} onClick={() => edit({ rated: toggle(c.rated, id, val) })}>
                          <Icon name={icon} size={16} />
                          {label}
                        </button>
                      ))}
                  </div>
                  {v === 'no' && (
                    <div className="rate-why">
                      <div>
                        <p className="hint">What didn’t work? (optional)</p>
                        <div className="chips gap-top">
                          {NOT_AGAIN_REASONS.map((x) => (
                            <button
                              key={x}
                              type="button"
                              className="chip"
                              aria-pressed={why.includes(x)}
                              onClick={() => edit({ why: { ...c.why, [id]: why.includes(x) ? why.filter((y) => y !== x) : [...why, x] } })}
                            >
                              {x}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="msec">
          <SecHead title="A few quick questions" />
          <div>
            {weekQuestions(plan, A, planState).map((f) => (
              <Question key={f.id} f={f} value={c.q[f.id]} onPick={pick(f.id)} />
            ))}
            {later && <LaterQuestion key={later.id} q={later} />}
          </div>
        </section>

        {bodyCheckinOn(A) && (
          <section className="msec">
            <SecHead title="How your body felt" aside="optional" />
            <div>
              {BODY_QUESTIONS.map((f) => (
                <Question key={f.id} f={f} value={c.q[f.id]} onPick={pick(f.id)} />
              ))}
              {weightOn(A) && (
                <div className="qline">
                  <p className="strong">
                    Weekly weight <span className="hint">(optional)</span>
                  </p>
                  <div className="row gap-top">
                    <input
                      className="field grow"
                      type="number"
                      inputMode="decimal"
                      placeholder="Skip if you like"
                      aria-label="Weekly weight"
                      value={c.weight}
                      onChange={(e) => edit({ weight: e.target.value, unit: 'kg' })}
                    />
                    <span className="strong">kg</span>
                  </div>
                  <p className="hint gap-top">Shown only as a trend over several weeks. Single weigh-ins jump around, so Remy doesn’t react to them.</p>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="bill">
          <div className="dish-line">
            <h2 className="dish-name">Next week</h2>
            <Leader />
            <span className="dish-kcal">
              {changes.length} change{changes.length === 1 ? '' : 's'}
            </span>
          </div>
          <ul className="bill-list">
            {changes.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          {!checkinDue(A, planState.weekStartedAt) && (
            <div className="warnline">
              <Icon name="info" size={16} />
              <span>Your week isn’t over yet. Saving now replaces this week’s plan and grocery list. Your ratings are kept, so you can save at the end of the week instead.</span>
            </div>
          )}
          <p className="hint gap-top">Everything Remy learns shows up in Preferences, where you can delete it.</p>
        </section>
      </main>
      <footer className="foot">
        <span className="grow hint">
          {rated} of {meals.length} rated
        </span>
        <button type="button" className="btn" onClick={actions.saveCheckin}>
          <Icon name="check" size={18} /> Save and plan next week
        </button>
      </footer>
      <BottomNav />
    </>
  );
}

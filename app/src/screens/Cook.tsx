import { useEffect, useRef, useState } from 'react';
import { Header } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { StepLines, StepMeta } from '../components/Steps';
import { listText } from '../interview/helpers';
import { recipeSteps, scaledIngredients, timelineSteps, type CookStep } from '../planning/method';
import { clockTime, schedule } from '../planning/schedule';
import { useRemy } from '../store';

/** Keep the screen on while cooking (where the browser allows it). */
function useWakeLock() {
  useEffect(() => {
    type Lock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<Lock> } };
    if (!nav.wakeLock) return;
    let lock: Lock | null = null;
    const get = () => nav.wakeLock!.request('screen').then((l) => (lock = l)).catch(() => {});
    void get();
    const onVisible = () => document.visibilityState === 'visible' && void get();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, []);
}

/** Three short beeps and a buzz when a timer ends. */
function alarm() {
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
    const ctx = new AudioContext();
    [0, 0.4, 0.8].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    /* no sound available */
  }
}

const TIMER_KEY = 'remy-cook-timers';
const readTimers = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(TIMER_KEY) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
};
const writeTimers = (t: Record<string, number>) => {
  try {
    localStorage.setItem(TIMER_KEY, JSON.stringify(t));
  } catch {
    /* storage blocked: timers still run while the screen is open */
  }
};

/** A countdown for one step. It keeps its end time, so leaving and coming back doesn't lose it. */
function Timer({ id, minutes, label }: { id: string; minutes: number; label: string }) {
  const [endAt, setEndAt] = useState<number | null>(() => readTimers()[id] ?? null);
  const [now, setNow] = useState(Date.now());
  const rang = useRef(false);
  useEffect(() => {
    if (!endAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [endAt]);
  const left = endAt ? Math.max(0, Math.round((endAt - now) / 1000)) : minutes * 60;
  useEffect(() => {
    if (endAt && left === 0 && !rang.current) {
      rang.current = true;
      alarm();
    }
  }, [endAt, left]);
  const set = (v: number | null) => {
    const all = readTimers();
    if (v) all[id] = v;
    else delete all[id];
    writeTimers(all);
    rang.current = false;
    setEndAt(v);
    setNow(Date.now());
  };
  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  return (
    <div className={`timer${endAt && left === 0 ? ' timer-done' : ''}`} role="timer" aria-label={`${label} timer`}>
      <span className="timer-clock mono">{endAt && left === 0 ? 'Time’s up' : `${mm}:${ss}`}</span>
      {endAt ? (
        <button type="button" className="btn sm ghost" onClick={() => set(null)}>
          {left === 0 ? 'Clear' : 'Stop'}
        </button>
      ) : (
        <button type="button" className="btn sm soft" onClick={() => set(Date.now() + minutes * 60_000)}>
          <Icon name="clock" size={16} /> Start {minutes}-min timer
        </button>
      )}
    </div>
  );
}

/** One step at a time, big and readable, with amounts, a timer and the screen kept on. */
export function Cook() {
  const { planState, ctx, ui, actions } = useRemy();
  useWakeLock();
  const plan = planState.plan;
  const sc = plan ? schedule(plan, ctx.A) : null;
  const steps: CookStep[] = !plan || !sc ? [] : ui.prepView === 'timeline' ? timelineSteps(sc) : recipeSteps(plan, sc).flatMap((f) => f.steps.filter((s) => !s.alreadyDone));
  const done = planState.prepDone.week === planState.weekStartedAt ? planState.prepDone.done : {};
  const [i, setI] = useState(() => Math.max(0, steps.findIndex((s) => !done[s.id])));
  if (!plan || !sc) return null;

  const allDone = steps.length > 0 && steps.every((s) => done[s.id]);
  const step = steps[Math.min(i, steps.length - 1)];
  const meanwhile =
    ui.prepView === 'timeline' && step.lane === 'hands' && step.start !== undefined
      ? steps.filter((o) => o.lane !== 'hands' && o.start! < step.start! + step.minutes && o.start! + o.minutes > step.start!).map((o) => o.title.toLowerCase())
      : [];
  const next = () => {
    actions.markStep(step.id, true);
    if (i < steps.length - 1) setI(i + 1);
  };

  return (
    <>
      <Header title="Cook mode" sub={`Step ${Math.min(i, steps.length - 1) + 1} of ${steps.length} · ${ui.prepView === 'timeline' ? 'timeline order' : 'recipe by recipe'}`} back="prep" />
      <div className="cook-progress" aria-hidden="true">
        <span style={{ width: `${(100 * steps.filter((s) => done[s.id]).length) / Math.max(1, steps.length)}%` }} />
      </div>
      <main className="body cook" tabIndex={0}>
        {allDone ? (
          <div className="panel stack top-gap">
            <p className="cook-title">Prep day done 🎉</p>
            <p className="ink-2">Label every container with the dish and today’s date. The Prep screen shows what goes in the fridge and what goes in the freezer.</p>
            <button type="button" className="btn wide" onClick={() => actions.go('prep')}>
              Back to prep day
            </button>
            <button type="button" className="btn ghost wide" onClick={() => setI(0)}>
              Look through the steps again
            </button>
          </div>
        ) : null}
        {!allDone && (
          <>
            <div className="top-gap">
              <div className="row wrap">
                {step.start !== undefined && <span className="pill p-muted">{clockTime(step.start)}</span>}
                <StepMeta step={step} />
                {done[step.id] && <span className="pill p-ok"><Icon name="check" size={13} /> Done</span>}
              </div>
              <h2 className="cook-title">{step.title}</h2>
              {step.for.length > 0 && <p className="hint">For {listText(step.for)}</p>}
            </div>

            {step.lane === 'oven' && step.temp && (
              <div className="warnline">
                <Icon name="therm" size={16} />
                <span>Oven at {step.temp}°C.</span>
              </div>
            )}

            {step.lines.length ? (
              <StepLines lines={step.lines} big />
            ) : step.sources.length ? (
              <div className="panel stack gap-top-lg">
                <p className="hint">This recipe isn’t written out step by step yet. Its ingredients for this week:</p>
                {step.sources.map(({ r, batches, scale }) => (
                  <ul className="ing-list" key={r.id}>
                    {scaledIngredients(r, batches, scale).map((x) => (
                      <li key={x.k}>
                        <b>{x.amount}</b> {x.name}
                      </li>
                    ))}
                  </ul>
                ))}
                <button type="button" className="linkbtn self-start" onClick={() => actions.openRecipe(step.sources[0].r.id)}>
                  See the recipe
                </button>
              </div>
            ) : null}

            {step.lane !== 'hands' && step.minutes > 1 && <Timer key={step.id} id={`${planState.weekStartedAt}:${step.id}`} minutes={step.minutes} label={step.title} />}

            {meanwhile.length > 0 && <p className="meanwhile">Meanwhile: {listText(meanwhile.slice(0, 3))}</p>}
          </>
        )}
      </main>
      {!allDone && (
        <footer className="foot">
          <button type="button" className="btn ghost" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Previous step">
            <Icon name="left" size={18} />
          </button>
          <span className="grow" />
          {i < steps.length - 1 && (
            <button type="button" className="btn ghost" onClick={() => setI(i + 1)}>
              Skip
            </button>
          )}
          <button type="button" className="btn" onClick={next}>
            <Icon name="check" size={18} /> {i < steps.length - 1 ? 'Done, next' : 'Done'}
          </button>
        </footer>
      )}
    </>
  );
}

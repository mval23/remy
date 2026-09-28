import { BottomNav, Header } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { StepLines, StepMeta } from '../components/Steps';
import { listText, str } from '../interview/helpers';
import { R } from '../planning/data/recipes';
import { WEEKS } from '../planning/data/weeks';
import { gearList, isDetailed, recipeSteps, recipesToPrep, scaledIngredients, timelineSteps, type CookStep } from '../planning/method';
import { windowMinutes } from '../planning/rules';
import { clockTime, duration, packingCounts, packPlan, schedule } from '../planning/schedule';
import { DAY_FULL, type Day, type Lane } from '../planning/types';
import { useRemy } from '../store';
import { useMedia, WIDE } from '../useMedia';

const LANES: [Lane, string][] = [['hands', 'You'], ['oven', 'Oven'], ['stove', 'Stove'], ['chill', 'Chill']];

/** A step you can tick off, with its instructions tucked into an expandable row. */
function StepRow({ step, done, onToggle, onRecipe, time }: { step: CookStep; done: boolean; onToggle: () => void; onRecipe?: () => void; time?: string }) {
  return (
    <div className={`task step${done ? ' done' : ''}${step.lane !== 'hands' ? ' bg' : ''}`}>
      <button type="button" className="cb" aria-pressed={done} aria-label={`${done ? 'Untick' : 'Tick off'}: ${step.title}`} onClick={onToggle}>
        {done && <Icon name="check" size={16} />}
      </button>
      <details className="grow">
        <summary>
          {time && <span className="tm">{time}</span>}
          <span className="tt">
            {step.title}
            {step.for.length > 1 && <span className="hint"> (for {listText(step.for)})</span>}
          </span>
          <StepMeta step={step} />
        </summary>
        {step.alreadyDone ? (
          <p className="hint gap-top">Same step as for {step.alreadyDone} above: once covers both.</p>
        ) : step.lines.length ? (
          <StepLines lines={step.lines} />
        ) : (
          <p className="hint gap-top">
            Detailed steps for this recipe are coming soon.{' '}
            {onRecipe && (
              <button type="button" className="linkbtn inline" onClick={onRecipe}>
                See the recipe
              </button>
            )}
          </p>
        )}
      </details>
    </div>
  );
}

export function Prep() {
  const { planState, ctx, ui, actions } = useRemy();
  const plan = planState.plan;
  if (!plan) return null;
  const A = ctx.A;
  const sc = schedule(plan, A);
  const [, windowMax] = windowMinutes(A);
  const over = sc.total - windowMax;
  const packs = packingCounts(plan, A);
  const byRecipe = packPlan(plan);
  const span = Math.max(sc.total, ...sc.tasks.map((t) => t.e));
  const variety = planState.variety ?? 'balanced';
  const lighter = variety === 'variety' ? 'balanced' : 'favorites';

  const done = planState.prepDone.week === planState.weekStartedAt ? planState.prepDone.done : {};
  const timeline = timelineSteps(sc);
  const flows = recipeSteps(plan, sc);
  const doneCount = timeline.filter((s) => done[s.id]).length;
  const toPrep = recipesToPrep(plan, sc);
  const gear = gearList(plan, sc);
  const firstOven = sc.tasks.find((t) => t.l === 'oven');
  const view = ui.prepView;
  const toggle = (id: string) => actions.markStep(id, !done[id]);
  const wide = useMedia(WIDE);

  // Sideways on an iPad the overview sits on the left and the steps on the right; otherwise one column in this order.
  const overview = (
    <>
      {over > 0 ? (
        <div className="warnline top-gap roomy">
          <Icon name="info" size={18} />
          <div>
            <b>Runs {duration(over)} over your {str(A.preptime) || '3–4 hour'} window.</b>
            <p className="gap-top">I won’t rush you. Pick a fix:</p>
            <div className="row wrap gap-top">
              {variety !== 'favorites' && (
                <button type="button" className="btn sm" onClick={() => actions.setVariety(lighter)}>
                  Switch to {WEEKS[lighter].label}
                </button>
              )}
              <button type="button" className="btn sm ghost" onClick={() => actions.go('planner')}>
                Edit meals
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="panel row top-gap">
          <div className="grow">
            <div className="stat">{duration(sc.total)}</div>
            <p className="hint">Starts 1:00 PM, done by {clockTime(sc.total)} · {sc.recipes} recipes</p>
          </div>
          <span className="pill p-ok"><Icon name="check" size={13} /> Fits {str(A.preptime) || 'your window'}</span>
        </div>
      )}

      <div className="panel stack gap-top-lg">
        <button type="button" className="btn wide" onClick={() => actions.go('cook')}>
          <Icon name="clock" size={18} /> {doneCount ? 'Continue cooking' : 'Start cook mode'}
        </button>
        <div className="row">
          <p className="hint grow">
            {doneCount ? `${doneCount} of ${timeline.length} steps done` : 'One step at a time, with amounts, timers and the screen kept on.'}
          </p>
          {doneCount > 0 && (
            <button type="button" className="linkbtn tight" onClick={actions.resetPrep}>
              Start over
            </button>
          )}
        </div>
      </div>

      <section className="sec">
        <h2>Before you start</h2>
        <div className="panel stack">
          {firstOven && (
            <p className="ink-2">
              <b>Preheat the oven to {firstOven.temp}°C</b> at the start.
            </p>
          )}
          {gear.length > 0 && (
            <div>
              <p className="hint strong">Equipment</p>
              <div className="chips tight gap-top">
                {gear.map((g) => (
                  <span className="pill p-muted" key={g}>{g}</span>
                ))}
                <span className="pill p-muted">{packs.containers} containers</span>
                {packs.bags + packs.foil > 0 && <span className="pill p-muted">{packs.bags + packs.foil} bags and foil</span>}
              </div>
            </div>
          )}
          <details>
            <summary className="linkbtn">Ingredients to set out, by recipe</summary>
            <div className="stack gap-top">
              {toPrep.map(({ r, batches, scale }) => (
                <div key={r.id}>
                  <p className="strong">
                    {r.e} {r.short}
                    {batches > 1 && <span className="pill p-warn"> ×{batches} batches</span>}
                  </p>
                  <ul className="ing-list">
                    {scaledIngredients(r, batches, scale).map((x) => (
                      <li key={x.k}>
                        <b>{x.amount}</b> {x.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        </div>
      </section>
    </>
  );

  const steps = (
    <>
      <div className="seg gap-top-lg" role="group" aria-label="How to show prep day">
        <button type="button" aria-pressed={view === 'timeline'} onClick={() => actions.setPrepView('timeline')}>
          Timeline
        </button>
        <button type="button" aria-pressed={view === 'recipe'} onClick={() => actions.setPrepView('recipe')}>
          Recipe by recipe
        </button>
      </div>
      <p className="hint gap-top">
        {view === 'timeline'
          ? 'The fastest order: hands-on work fills the gaps while things bake and simmer. Tap a step for instructions.'
          : 'Each dish from start to finish. Simpler to follow, but takes longer than the timeline.'}
      </p>

      {view === 'timeline' ? (
        <>
          <section className="sec">
            <h2>What runs at the same time</h2>
            <div className="gantt" role="img" aria-label="Timeline of hands-on, oven, stove and chilling tasks">
              {LANES.map(([lane, label]) => (
                <div className="lane" key={lane}>
                  <b>{label}</b>
                  <div className="track">
                    {sc.tasks.filter((t) => t.l === lane).map((t, i) => (
                      <span key={i} className={`bar b-${lane}`} title={t.t} style={{ left: `${(100 * t.s) / span}%`, width: `${(100 * (t.e - t.s)) / span}%` }} />
                    ))}
                  </div>
                </div>
              ))}
              <div className="axis">
                <span />
                <div className="ticks">
                  {[0, 60, 120, 180, 240, 300, 360].filter((x) => x <= span).map((x) => (
                    <span key={x} style={{ left: `${(100 * x) / span}%` }}>{x / 60}h</span>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="sec">
            <h2>Timeline</h2>
            <div className="panel tasks">
              {timeline.map((step) => (
                <StepRow
                  key={step.id}
                  step={step}
                  done={!!done[step.id]}
                  onToggle={() => toggle(step.id)}
                  time={clockTime(step.start ?? 0).replace(/ (AM|PM)$/, '')}
                  onRecipe={sc.tasks.find((t) => t.id === step.id)?.refs[0] ? () => actions.openRecipe(sc.tasks.find((t) => t.id === step.id)!.refs[0].r.id) : undefined}
                />
              ))}
            </div>
          </section>
        </>
      ) : (
        flows.map(({ r, batches, steps }) => (
          <section className="sec" key={r.id}>
            <h2>
              <span className="grow">
                {r.e} {r.short}
              </span>
              {batches > 1 && <span className="pill p-warn">×{batches} batches</span>}
            </h2>
            <div className="panel tasks">
              {steps.map((step, i) => (
                <StepRow key={`${step.id}-${i}`} step={step} done={!!done[step.id]} onToggle={() => toggle(step.id)} onRecipe={() => actions.openRecipe(r.id)} />
              ))}
            </div>
            {!isDetailed(r) && r.steps.length > 0 && (
              <ol className="how gap-top">
                {r.steps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            )}
          </section>
        ))
      )}
    </>
  );

  const packing = (
    <>
      <section className="sec">
        <h2>Pack and label</h2>
        <div className="list">
          {Object.entries(byRecipe).map(([id, o]) => {
            const r = R[id];
            return (
              <div className="li" key={id}>
                <span className="em-lg" aria-hidden="true">{r.e}</span>
                <div className="grow">
                  <div className="t">
                    {r.short} <span className="mono hint">×{o.fridge.length + o.freezer.length + o.room.length}</span>
                  </div>
                  <div className="chips tight gap-top">
                    {o.fridge.length > 0 && <span className="pill p-fridge"><Icon name="fridge" size={12} /> Fridge: {o.fridge.join(', ')}</span>}
                    {o.freezer.length > 0 && <span className="pill p-freeze"><Icon name="snow" size={12} /> Freezer: {o.freezer.join(', ')}</span>}
                    {o.room.length > 0 && <span className="pill p-muted">Pantry: {o.room.join(', ')}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {packs.containers > packs.containerCap && (
          <div className="warnline">
            <Icon name="info" size={16} />
            <span>You have about {packs.containerCap} containers. Use freezer bags for the {packs.containers - packs.containerCap} extra portions.</span>
          </div>
        )}
        {packs.freezer > packs.freezerCap && (
          <div className="warnline">
            <Icon name="snow" size={16} />
            <span>That’s more than your freezer holds. Move the last two days to a 20-minute mid-week top-up.</span>
          </div>
        )}
        <p className="hint gap-top">Label every container with the dish and the prep date.</p>
      </section>

      <section className="sec">
        <h2>Food safety rules I follow</h2>
        <div className="panel">
          <ul className="rules">
            <li>Cool food in shallow containers and refrigerate within 2 hours of cooking. Cool rice quickly and refrigerate it within about an hour.</li>
            <li>Fridge at 4°C or colder. Cooked meals are eaten within 3–4 days; anything later goes in the freezer on prep day.</li>
            <li>Freezer at −18°C. Frozen food stays safe; quality is best within 2–3 months.</li>
            <li>Thaw in the fridge, in cold water, or in the microwave. Never on the counter.</li>
            <li>Reheat leftovers until steaming, 74°C in the center.</li>
          </ul>
        </div>
      </section>

      {A.cleanup === 'As little as possible' && (
        <section className="sec">
          <h2>Less cleanup</h2>
          <div className="panel">
            <ul className="rules">
              <li>Line every sheet pan with baking paper.</li>
              <li>Rinse mixing bowls while things roast, so the sink never piles up.</li>
              <li>The blender goes straight into the dishwasher after the sauce.</li>
            </ul>
          </div>
        </section>
      )}
    </>
  );

  return (
    <>
      <Header title="Prep day" sub={`${DAY_FULL[(str(A.prepday) || 'Sun') as Day]} · 1:00 PM start`} />
      <main className="body wide" tabIndex={0}>
        {wide ? (
          <div className="cols">
            <div>
              {overview}
              {packing}
            </div>
            <div>{steps}</div>
          </div>
        ) : (
          <>
            {overview}
            {steps}
            {packing}
          </>
        )}
      </main>
      <BottomNav />
    </>
  );
}

import { BottomNav, Header } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { listText, str } from '../interview/helpers';
import { R } from '../planning/data/recipes';
import { WEEKS } from '../planning/data/weeks';
import { windowMinutes } from '../planning/rules';
import { clockTime, duration, fahrenheitToCelsius, packingCounts, packPlan, schedule } from '../planning/schedule';
import { DAY_FULL, type Day, type Lane } from '../planning/types';
import { useRemy } from '../store';

const LANES: [Lane, string][] = [['hands', 'You'], ['oven', 'Oven'], ['stove', 'Stove'], ['chill', 'Chill']];
const LANE_TAG: Record<Lane, string> = { hands: 'Hands-on', oven: 'Oven', stove: 'Stovetop', chill: 'Fridge/freezer' };

export function Prep() {
  const { planState, ctx, actions } = useRemy();
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

  return (
    <>
      <Header title="Prep day" sub={`${DAY_FULL[(str(A.prepday) || 'Sun') as Day]} · 1:00 PM start`} />
      <main className="body">
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
          <div className="panel stats3">
            <div><div className="stat">{packs.containers}</div><p className="hint">containers</p></div>
            <div><div className="stat">{packs.bags + packs.foil}</div><p className="hint">bags and foil</p></div>
            <div><div className="stat">{packs.freezer}</div><p className="hint">freezer portions</p></div>
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
        </section>

        <section className="sec">
          <h2>Timeline</h2>
          <div className="panel tasks">
            {sc.tasks.map((t, i) => {
              const background = t.l !== 'hands';
              const meanwhile = background ? [] : sc.tasks.filter((o) => o !== t && o.l !== 'hands' && o.s < t.e && o.e > t.s).map((o) => o.t.split(' (')[0].toLowerCase());
              return (
                <div className={`task${background ? ' bg' : ''}`} key={i}>
                  <div className="tm">{clockTime(t.s).replace(/ (AM|PM)$/, '')}</div>
                  <div>
                    <div className="tt">
                      {t.t}
                      {t.for.length > 1 && <span className="hint"> (for {listText(t.for)})</span>}
                    </div>
                    <div className="meta">
                      <span className={`lane-tag lt-${t.l}`}>{t.l === 'oven' ? `Oven ${t.temp}°F` : LANE_TAG[t.l]}</span>
                      <span className="mono hint">{t.e - t.s} min</span>
                      {background && <span className="hint">runs in the background</span>}
                      {t.setTemp && t.temp && <span className="pill p-oven">set oven to {t.temp}°F / {fahrenheitToCelsius(t.temp)}°C</span>}
                      {t.l === 'chill' && t.e > sc.total && <span className="hint">finishes after you’re done</span>}
                    </div>
                    {meanwhile.length > 0 && <p className="meanwhile">Meanwhile: {listText(meanwhile.slice(0, 3))}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

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
          <p className="hint gap-top">Label every container with the dish and the prep date.</p>
        </section>

        <section className="sec">
          <h2>Food safety rules I follow</h2>
          <div className="panel">
            <ul className="rules">
              <li>Cool food in shallow containers and refrigerate within 2 hours of cooking. Cool rice quickly and refrigerate it within about an hour.</li>
              <li>Fridge at 40°F / 4°C or colder. Cooked meals are eaten within 3–4 days; anything later goes in the freezer on prep day.</li>
              <li>Freezer at 0°F / −18°C. Frozen food stays safe; quality is best within 2–3 months.</li>
              <li>Thaw in the fridge, in cold water, or in the microwave. Never on the counter.</li>
              <li>Reheat leftovers until steaming, 165°F / 74°C in the center.</li>
            </ul>
          </div>
        </section>

        {A.cleanup === 'As little as possible' && (
          <section className="sec">
            <h2>Less cleanup</h2>
            <div className="panel">
              <ul className="rules">
                <li>Line every sheet pan with parchment.</li>
                <li>Rinse mixing bowls while things roast, so the sink never piles up.</li>
                <li>The blender goes straight into the dishwasher after the sauce.</li>
              </ul>
            </div>
          </section>
        )}
      </main>
      <BottomNav />
    </>
  );
}

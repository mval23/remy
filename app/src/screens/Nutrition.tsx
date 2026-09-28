import { BottomNav, Header } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { allRatings, listText } from '../interview/helpers';
import { FOODS } from '../interview/questions';
import { bodyCheckinOn, weightOn, weightTrend } from '../learning/learning';
import { fraction } from '../planning/grocery';
import { balanceOn, dayNutrition, estimatesOn, kcalRange, LIGHT_DAY_KCAL } from '../planning/nutrition';
import { SLOT_SHORT } from '../planning/types';
import { useRemy } from '../store';

function Plate() {
  return (
    <svg viewBox="0 0 170 170" width="150" height="150" role="img" aria-label="Plate guide: half fruit and vegetables, a quarter protein, a quarter starch" className="plate">
      <circle cx="85" cy="85" r="80" className="plate-rim" strokeWidth="2" />
      <path d="M85 13 A72 72 0 0 1 85 157 Z" className="plate-produce" strokeWidth="3" />
      <path d="M85 85 L85 13 A72 72 0 0 0 13 85 Z" className="plate-protein" strokeWidth="3" />
      <path d="M85 85 L13 85 A72 72 0 0 0 85 157 Z" className="plate-starch" strokeWidth="3" />
      <text x="121" y="82" textAnchor="middle" className="plate-t t-produce">½ fruit</text>
      <text x="121" y="97" textAnchor="middle" className="plate-t t-produce">&amp; veg</text>
      <text x="52" y="62" textAnchor="middle" className="plate-t t-protein">¼ protein</text>
      <text x="52" y="116" textAnchor="middle" className="plate-t t-starch">¼ starch</text>
    </svg>
  );
}

const dateText = (at: number) => new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Progress without a scale: hunger, energy and fit from check-ins. Weight only as a multi-week trend. */
function Progress() {
  const { planState, ctx, actions } = useRemy();
  const A = ctx.A;
  if (!bodyCheckinOn(A))
    return (
      <section className="sec">
        <h2>Progress</h2>
        <div className="panel">
          <p className="hint">Tracking is off, as you asked. Remy still uses your meal ratings.</p>
        </div>
      </section>
    );
  const entries = planState.progress.slice(0, 4);
  const trend = weightOn(A) ? weightTrend(planState.progress) : null;
  const weighIns = planState.progress.filter((p) => p.weight).length;
  return (
    <section className="sec">
      <h2>Progress</h2>
      {trend && (
        <div className="panel gap-bottom">
          <p className="trend">
            {trend.change === 0 ? 'No change' : `${trend.change > 0 ? 'Up' : 'Down'} about ${Math.abs(trend.change)} ${trend.unit}`} over your last {trend.entries} weigh-ins
          </p>
          <p className="hint gap-top">Remy looks at 3–4 week trends, not single weeks. Hunger, energy and how clothes fit matter just as much.</p>
        </div>
      )}
      <div className="list">
        {entries.length ? (
          entries.map((p) => (
            <div className="li" key={p.at}>
              <div className="grow">
                <div className="t">{dateText(p.at)}</div>
                <div className="chips tight gap-top">
                  {([['Hunger', p.hunger], ['Energy', p.energy], ['Fit', p.fit]] as const)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <span className="pill p-muted" key={k}>
                        {k}: {v!.toLowerCase()}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty">Your first check-in comes at the end of the week.</div>
        )}
      </div>
      {weightOn(A) && !trend && (
        <p className="hint gap-top">
          Weight shows as a trend after 3 weekly weigh-ins{weighIns ? ` (${weighIns} so far)` : ''}. Single weigh-ins jump around, so Remy doesn’t show or react to them.
        </p>
      )}
      <button type="button" className="btn ghost wide gap-top-lg" onClick={() => actions.go('checkin')}>
        <Icon name="heart" size={17} /> Weekly check-in
      </button>
    </section>
  );
}

export function Nutrition() {
  const { planState, ctx, actions } = useRemy();
  const plan = planState.plan;
  if (!plan) return null;
  const A = ctx.A;
  const n = planState.nutrition;
  const on = balanceOn(A);
  const nums = estimatesOn(n, A);
  const days = plan.map((d, i) => ({ d: d.d, i, ...dayNutrition(d, ctx.hungry) }));
  const balanced = days.filter((x) => x.ok).length;
  const rat = allRatings(A);
  const accepted = (f: string) => ['love', 'like', 'okay', 'ways'].includes(rat[f]);
  const proteins = ['chicken', 'beef', 'turkey', 'eggs', 'yogurt', 'cheese'].filter(accepted).map((f) => FOODS[f].n.toLowerCase());
  const produce = Object.keys(rat).filter((f) => (FOODS[f]?.veg || ['berries', 'bananas', 'apples', 'grapes'].includes(f)) && accepted(f)).map((f) => FOODS[f].n.toLowerCase());
  const counted = days.filter((x) => !x.out);
  const avgKcal = counted.length ? Math.round(counted.reduce((s, x) => s + x.kcal, 0) / counted.length) : 0;
  const avgPro = counted.length ? Math.round(counted.reduce((s, x) => s + x.pro, 0) / counted.length) : 0;

  return (
    <>
      <Header title="Nutrition balance" sub="General guidance, built on foods you accept" back="planner" />
      <main className="body">
        <div className="panel row top-gap align-start">
          <Icon name="info" size={18} />
          <p className="hint ink-2">
            Remy isn’t a dietitian. These are general balance checks based on widely used guidance. For personal targets, a registered dietitian is the right person, and you can enter their numbers below.
          </p>
        </div>
        {!on && (
          <div className="warnline">
            <Icon name="info" size={16} />
            <span className="grow">Balance checks are off because you chose “No thanks”.</span>
            <button type="button" className="linkbtn tight" onClick={() => actions.setBalanceMode('Just show me')}>
              Turn on
            </button>
          </div>
        )}

        <section className="sec">
          <h2>This week</h2>
          <div className="panel">
            <div className="stat">
              {balanced} <span className="stat-sub">of 7 days</span>
            </div>
            <p className="hint">have protein at every main meal and at least 3 servings of fruit or vegetables</p>
            {balanced < 7 && (
              <>
                <button type="button" className="btn soft wide gap-top-lg" onClick={() => actions.balance([0, 1, 2, 3, 4, 5, 6])}>
                  <Icon name="plus" size={17} /> Balance the whole week
                </button>
                <p className="hint gap-top">Adds sides from foods you accept. Each one can be removed in the planner.</p>
              </>
            )}
          </div>
          <div className="list gap-top-lg">
            {days.map((x) => (
              <button
                type="button"
                className="li li-btn"
                key={x.d}
                onClick={() => {
                  actions.selectDay(x.i);
                  actions.go('planner');
                }}
              >
                <div className="day-label">{x.d}</div>
                <div className="grow">
                  <div className="chips tight">
                    <span className={`pill ${x.proteinOk ? 'p-ok' : 'p-warn'}`}>{x.proteinOk ? 'Protein ✓' : `Protein: ${x.low.map((s) => SLOT_SHORT[s].toLowerCase()).join(', ')}`}</span>
                    <span className={`pill ${x.produceOk ? 'p-ok' : 'p-warn'}`}>Fruit &amp; veg {fraction(x.prod)}</span>
                    {x.light && <span className="pill p-bad">Light day</span>}
                  </div>
                  {nums && (
                    <div className="mono hint gap-top">
                      ≈{kcalRange(x.kcal)} kcal · {x.pro} g protein{x.out ? ' · meal out not counted' : ''}
                    </div>
                  )}
                </div>
                <Icon name="right" size={18} />
              </button>
            ))}
          </div>
        </section>

        <section className="sec">
          <h2>Portion guide</h2>
          <div className="panel">
            <div className="row wrap plate-row">
              <Plate />
              <div className="grow plate-text">
                <p className="strong">A simple way to build a plate or container.</p>
                <p className="hint gap-top">Your prep-day containers already follow this where they can. You don’t need to measure.</p>
              </div>
            </div>
            <div className="kv gap-top">
              <div>
                <span className="c-carrot"><Icon name="spark" size={18} /></span>
                <div className="grow">
                  <div className="k">Your protein foods</div>
                  <div className="v">{proteins.length ? listText(proteins) : 'Not enough ratings yet'}</div>
                  <div className="hint">Protein helps you stay full and keep muscle while losing fat.</div>
                </div>
              </div>
              <div>
                <span className="c-basil"><Icon name="heart" size={18} /></span>
                <div className="grow">
                  <div className="k">Your fruit and vegetables</div>
                  <div className="v">{produce.length ? listText(produce) : 'Not enough ratings yet'}</div>
                  <div className="hint">
                    Vegetables come roasted crispy or blended into sauces{A.visible === 'Hidden is fine if I can’t taste it' ? ', since hidden is fine for you' : ''}. Fruit counts too.
                  </div>
                </div>
              </div>
              <div>
                <span className="c-berry"><Icon name="heart" size={18} /></span>
                <div className="grow">
                  <div className="k">Sweets</div>
                  <div className="v">Planned and pre-portioned, not earned</div>
                  <div className="hint">A small, satisfying portion you look forward to makes the plan easier to keep.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec">
          <h2>Estimates and targets</h2>
          <div className="panel stack">
            <div className="row">
              <div className="grow">
                <b>Show calorie and protein estimates</b>
                <p className="hint">
                  Rough ranges from typical ingredients.
                  {n.nums === null && ` Default: ${A.pace === 'Detailed' ? 'on (you chose detailed)' : 'off'}.`}
                </p>
              </div>
              <div className="seg narrow" role="group" aria-label="Show estimates">
                <button type="button" aria-pressed={nums} onClick={() => actions.setEstimates(true)}>On</button>
                <button type="button" aria-pressed={!nums} onClick={() => actions.setEstimates(false)}>Off</button>
              </div>
            </div>
            <div>
              <p className="strong">
                Targets from a dietitian or doctor <span className="hint">(optional)</span>
              </p>
              <div className="row gap-top">
                <input className="field grow" type="number" inputMode="numeric" placeholder="kcal per day" aria-label="Daily calorie target" value={n.kcal} onChange={(e) => actions.setTargets(e.target.value, n.pro)} />
                <input className="field grow" type="number" inputMode="numeric" placeholder="g protein" aria-label="Daily protein target" value={n.pro} onChange={(e) => actions.setTargets(n.kcal, e.target.value)} />
              </div>
              {n.kcal || n.pro ? (
                <>
                  <p className="hint ink-2 gap-top">
                    This week averages about {kcalRange(avgKcal)} kcal and {avgPro} g protein a day (days without a meal out).
                    {n.kcal && ` Your target: ${n.kcal} kcal.`}
                    {n.pro && ` Protein target: ${n.pro} g.`} Remy shows how the week compares; changing portions is up to you and your professional.
                  </p>
                  {n.kcal && Number(n.kcal) < LIGHT_DAY_KCAL && (
                    <div className="warnline">
                      <Icon name="info" size={16} />
                      <span>That’s below about 1,200 kcal, which Remy won’t plan on its own. Keep it only if a professional set it for you.</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="hint gap-top">Leave these empty unless a professional gave you numbers. Remy never needs your weight to plan.</p>
              )}
            </div>
          </div>
        </section>
        <Progress />
      </main>
      <BottomNav />
    </>
  );
}

import { BottomNav, Header } from '../components/Chrome';
import { Lead, Leader, LeadLink, Mast, SecHead } from '../components/Dish';
import { Icon } from '../components/Icon';
import { allRatings, listText } from '../interview/helpers';
import { FOODS } from '../interview/questions';
import { bodyCheckinOn, weightOn, weightTrend } from '../learning/learning';
import { fraction } from '../planning/grocery';
import { balanceOn, dayNutrition, estimatesOn, FIBER_TARGET, kcalRange, LIGHT_DAY_KCAL } from '../planning/nutrition';
import { DAY_FULL, SLOT_SHORT } from '../planning/types';
import { goalsOf, hasGoals } from '../planning/goals';
import { noWeightLoss } from '../profile/screen';
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
      <section className="msec">
        <SecHead title="Progress" />
        <p className="lead-note gap-top">Tracking is off, as you asked. Remy still uses your meal ratings.</p>
      </section>
    );
  const entries = planState.progress.slice(0, 4);
  const trend = weightOn(A) ? weightTrend(planState.progress) : null;
  const weighIns = planState.progress.filter((p) => p.weight).length;
  return (
    <section className="msec">
      <SecHead title="Progress" />
      {trend && (
        <>
          <Lead k="Weight trend" v={trend.change === 0 ? 'No change' : `${trend.change > 0 ? 'Up' : 'Down'} about ${Math.abs(trend.change)} ${trend.unit}`} />
          <p className="lead-note">
            Over your last {trend.entries} weigh-ins. Remy looks at 3–4 week trends, not single weeks. Hunger, energy and how clothes fit matter just as much.
          </p>
        </>
      )}
      {entries.length ? (
        entries.map((p) => (
          <div key={p.at}>
            <div className="lead">
              <span className="k">{dateText(p.at)}</span>
            </div>
            <div className="day-note">
              {([['Hunger', p.hunger], ['Energy', p.energy], ['Fit', p.fit]] as const)
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <span className="pill p-muted" key={k}>
                    {k}: {v!.toLowerCase()}
                  </span>
                ))}
            </div>
          </div>
        ))
      ) : (
        <p className="lead-note gap-top">Your first check-in comes at the end of the week.</p>
      )}
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

/** The week's balance as lines on a check: each day, then the daily average; goals typed on the dotted line. */
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
  const goals = goalsOf(n, A);
  const avgPro = counted.length ? Math.round(counted.reduce((s, x) => s + x.pro, 0) / counted.length) : 0;
  const avgFiber = counted.length ? Math.round(counted.reduce((s, x) => s + x.fiber, 0) / counted.length) : 0;
  const round10 = (x: number) => (Math.round(x / 10) * 10).toLocaleString('en-US');

  return (
    <>
      <Header title="Nutrition balance" back="planner" />
      <main className="body wide">
        <Mast kicker="This week" icon="heart" title={`${balanced} of 7`} sub="days have protein at every main meal and at least 3 servings of fruit or vegetables">
          {balanced < 7 && (
            <div className="mast-acts">
              <button type="button" className="btn sm soft" onClick={() => actions.balance([0, 1, 2, 3, 4, 5, 6])}>
                <Icon name="plus" size={16} /> Balance the whole week
              </button>
            </div>
          )}
        </Mast>
        <p className="hint center-hint">
          Remy isn’t a dietitian. These are general balance checks based on widely used guidance. For personal targets, a registered dietitian is the right person, and you can enter
          their numbers below.
        </p>
        {balanced < 7 && <p className="hint center-hint">Balancing adds sides from foods you accept. Each one can be removed in the planner.</p>}
        {!on && (
          <div className="warnline">
            <Icon name="info" size={16} />
            <span className="grow">Balance checks are off because you chose “No thanks”.</span>
            <button type="button" className="linkbtn tight" onClick={() => actions.setBalanceMode('Just show me')}>
              Turn on
            </button>
          </div>
        )}

        <div className="masonry">
          <section className="msec">
            <SecHead title="Day by day" aside="tap a day to open it" />
            {days.map((x) => (
              <div key={x.d}>
                <LeadLink
                  k={DAY_FULL[x.d]}
                  v={nums ? `${round10(x.kcal)} kcal` : x.ok ? 'Balanced' : 'Needs balance'}
                  onClick={() => {
                    actions.selectDay(x.i);
                    actions.go('planner');
                  }}
                />
                <div className="day-note">
                  <span>
                    {nums ? `${x.pro} g protein · ${x.fiber} g fiber · ` : ''}fruit &amp; veg {fraction(x.prod)}
                    {x.produceOk ? ' ✓' : ''}
                    {x.out ? ' · meal out not counted' : ''}
                  </span>
                  {!x.proteinOk && <span className="pill p-warn">Protein light: {x.low.map((s) => SLOT_SHORT[s].toLowerCase()).join(', ')}</span>}
                  {!x.produceOk && <span className="pill p-warn">Under 3 fruit &amp; veg</span>}
                  {!x.out && !x.fiberOk && <span className="pill p-muted">Fiber light</span>}
                  {x.light && <span className="pill p-bad">Light day</span>}
                </div>
              </div>
            ))}
            {nums && (
              <div className="bill">
                <div className="dish-line">
                  <span className="dish-name">Daily average</span>
                  <Leader />
                  <span className="dish-kcal">≈{round10(avgKcal)} kcal</span>
                </div>
                <p className="bill-note">
                  {avgPro} g protein and {avgFiber} g fiber a day, on days without a meal out (fiber guide: about {FIBER_TARGET} g). Rough estimates added up from the ingredients.
                </p>
              </div>
            )}
          </section>

          <section className="msec">
            <SecHead title="Estimates and goals" />
            <div className="lead tall">
              <span className="k">Show calories and macros</span>
              <Leader />
              <div className="seg narrow" role="group" aria-label="Show estimates">
                <button type="button" aria-pressed={nums} onClick={() => actions.setEstimates(true)}>On</button>
                <button type="button" aria-pressed={!nums} onClick={() => actions.setEstimates(false)}>Off</button>
              </div>
            </div>
            <p className="lead-note">
              Calories, protein, carbs, fat and fiber for every meal, added up from the ingredients. Rough estimates.
              {n.nums === null && ` Default: ${A.pace === 'Detailed' ? 'on (you chose detailed)' : 'off'}.`}
            </p>
            {noWeightLoss(A) ? (
              <p className="lead-note gap-top">
                Because of what you shared in your profile, Remy doesn’t fit your week to calorie or protein goals. Your meals stay regular and balanced. A doctor or
                registered dietitian is the right guide for anything more.
              </p>
            ) : (
              <>
                <button type="button" className="btn soft wide gap-top" onClick={() => actions.openSheet('estimate')}>
                  <Icon name="heart" size={17} /> {n.from === 'estimate' ? 'Your daily estimate' : 'Work out a daily estimate'}
                </button>
                <p className="hint gap-top">
                  {n.from === 'estimate'
                    ? 'The goals below come from your estimate. Typing a different number makes it yours instead.'
                    : 'Optional: a starting point from your age, height, weight and activity, kept on this device. Or type numbers from a professional below.'}
                </p>
                <div className="lead tall">
                  <label className="k" htmlFor="goal-kcal">Calories a day</label>
                  <Leader />
                  <input id="goal-kcal" className="field goal-field" type="number" inputMode="numeric" placeholder="kcal" value={n.kcal} onChange={(e) => actions.setTargets(e.target.value, n.pro)} />
                </div>
                <div className="lead tall">
                  <label className="k" htmlFor="goal-pro">Protein a day</label>
                  <Leader />
                  <input id="goal-pro" className="field goal-field" type="number" inputMode="numeric" placeholder="g" value={n.pro} onChange={(e) => actions.setTargets(n.kcal, e.target.value)} />
                </div>
                {n.kcal || n.pro ? (
                  <>
                    <p className="lead-note gap-top">
                      This week averages about {kcalRange(avgKcal)} kcal and {avgPro} g protein a day (days without a meal out).
                    </p>
                    {hasGoals(goals) && (
                      <button type="button" className="btn soft wide gap-top" onClick={actions.fitGoals}>
                        <Icon name="spark" size={17} /> Fit my week to these goals
                      </button>
                    )}
                    <p className="hint gap-top">
                      Remy swaps meals you haven’t approved for lighter or heavier ones, adds protein sides, then adjusts main-meal portions by up to 20%. New weeks are fitted
                      automatically. It never plans a day under about {(goals.floor ?? LIGHT_DAY_KCAL).toLocaleString('en-US')} kcal, and your sweet always stays.
                    </p>
                    {n.kcal && Number(n.kcal) < LIGHT_DAY_KCAL && (
                      <div className="warnline">
                        <Icon name="info" size={16} />
                        <span>That’s below about 1,200 kcal, so Remy fits your week to about 1,200 instead. Go lower only with a professional’s guidance.</span>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="hint gap-top">Optional. With goals, Remy fits your menu toward them. Remy only uses your age, height or weight if you ask for the estimate above.</p>
                )}
              </>
            )}
          </section>

          <section className="msec">
            <SecHead title="Portion guide" />
            <div className="row wrap plate-row gap-top">
              <Plate />
              <div className="plate-leads">
                <Lead k="Fruit & veg" v="½" />
                <Lead k="Protein" v="¼" />
                <Lead k="Starch" v="¼" />
              </div>
            </div>
            <p className="lead-note gap-top">A simple way to build a plate or container. Your prep-day containers already follow this where they can. You don’t need to measure.</p>
            <p className="lead-note">
              <b>Your protein foods:</b> {proteins.length ? listText(proteins) : 'not enough ratings yet'}. Protein helps you stay full and keep muscle while losing fat.
            </p>
            <p className="lead-note">
              <b>Your fruit and vegetables:</b> {produce.length ? listText(produce) : 'not enough ratings yet'}. Vegetables come roasted crispy or blended into sauces
              {A.visible === 'Hidden is fine if I can’t taste it' ? ', since hidden is fine for you' : ''}. Fruit counts too.
            </p>
            <p className="lead-note">
              <b>Sweets:</b> planned and pre-portioned, not earned. A small, satisfying portion you look forward to makes the plan easier to keep.
            </p>
          </section>
          <Progress />
        </div>
      </main>
      <BottomNav />
    </>
  );
}

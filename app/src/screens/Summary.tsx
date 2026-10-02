import { BottomNav } from '../components/Chrome';
import { Avatar, Icon } from '../components/Icon';
import { activeAnswers, applies, formatAnswer, sequence } from '../interview/engine';
import { allRatings, arr, asPreparations, listText, real, str } from '../interview/helpers';
import { FOODS, LEVELS, QBY } from '../interview/questions';
import { inferences, laterQuestions, safetyRules, type Confidence } from '../profile/profile';
import { noWeightLoss, riskFlags } from '../profile/screen';
import { useRemy } from '../store';

const DAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

/** How sure Remy is, shown only when it's worth a second look. */
function ConfTag({ c }: { c: Confidence }) {
  if (c === 'high') return null;
  return <span className={`conf ${c}`}>{c === 'medium' ? 'Remy guessed' : 'Not sure'}</span>;
}

export function Summary() {
  const { interview: s, planState, actions } = useRemy();
  const A = activeAnswers(s);
  const safety = safetyRules(A);
  const rat = allRatings(A);
  const ways = asPreparations(A.ways);
  const inf = inferences(A, planState.hiddenInferences);
  const skippedQs = sequence(s.answers).filter((q) => s.skipped[q.id] && s.answers[q.id] === undefined);

  const Row = ({ label, id, value, conf = 'high', src }: { label: string; id: string; value?: string; conf?: Confidence; src?: string }) => {
    const q = QBY[id];
    if (!q || !applies(q, s.answers)) return null;
    const skipped = !!s.skipped[id] && s.answers[id] === undefined;
    const shown = skipped ? 'Not answered' : value ?? (A[id] !== undefined ? formatAnswer(q, A[id]) : '—');
    const c: Confidence = skipped ? 'low' : conf;
    return (
      <div>
        <div className="grow">
          <div className="k">{label}</div>
          <div className="v">{shown}</div>
          {(src || skipped) && <div className="hint">{skipped ? 'Skipped. Using a neutral default.' : src}</div>}
        </div>
        <ConfTag c={c} />
        <button type="button" className="iconbtn" aria-label={`Edit ${label}`} onClick={() => actions.edit(id)}>
          <Icon name="edit" size={17} />
        </button>
      </div>
    );
  };

  const hasSafety = safety.allergies.length + safety.diet.length + safety.intolerances.length > 0;
  const health = real(A.health).filter((x) => x !== 'Prefer not to say');
  const lowCalories = A.calories && Number(A.calories) < 1200;

  return (
    <>
      <header className="head">
        <button type="button" className="iconbtn" aria-label={s.confirmed ? 'Back to home' : 'Back to welcome'} onClick={() => actions.go(s.confirmed ? 'home' : 'welcome')}>
          <Icon name="left" size={22} />
        </button>
        <div className="ttl">
          <h1>Your taste profile</h1>
          <p>{s.confirmed ? 'Confirmed · edit anytime' : 'Please check before I plan'}</p>
        </div>
        <button type="button" className="iconbtn" aria-label="Sync and install" onClick={() => actions.go('account')}>
          <Icon name="cloud" size={22} />
        </button>
      </header>
      <main className="body wide">
        <div className="msg top-gap">
          <Avatar />
          <div className="bubble">
            {s.confirmed
              ? 'This is what I know about you. Change anything, anytime, and I’ll update the meals you haven’t approved yet.'
              : 'Here’s what I learned. Fix anything that’s off, then I’ll plan your week.'}
          </div>
        </div>

        <div className="masonry">
          <section className="sec">
            <div className="safety">
              <h2>
                <Icon name="lock" size={18} /> Hard safety rules
              </h2>
              <p className="safety-sub">Never suggested anywhere, including sauces, substitutions and replacements.</p>
              {hasSafety ? (
                <div className="chips">
                  {safety.allergies.map((x) => (
                    <span className="chip" key={x}>
                      <Icon name="shield" size={14} />
                      {x} allergy
                    </span>
                  ))}
                  {safety.diet.map((x) => (
                    <span className="chip" key={x}>{x}</span>
                  ))}
                  {safety.intolerances.map((x) => (
                    <span className="chip" key={x}>{x} intolerance</span>
                  ))}
                </div>
              ) : (
                <p className="strong">No allergies, intolerances or dietary rules.</p>
              )}
              {safety.allergies.length > 0 && safety.confirmation && <p className="safety-sub">Confirmed: “{safety.confirmation}”</p>}
              <div className="row">
                <button type="button" className="linkbtn danger" onClick={() => actions.edit('allergies')}>
                  <Icon name="edit" size={15} /> Change allergies
                </button>
                <button type="button" className="linkbtn danger" onClick={() => actions.edit('diet')}>
                  Dietary rules
                </button>
              </div>
            </div>
            <div className="panel kv gap-top">
              <Row label="Health" id="health" src="Kept out of anything sent to the AI" />
              <Row label="Age group" id="age" />
            </div>
            {noWeightLoss(A) ? (
              <div className="warnline">
                <Icon name="info" size={16} />
                <span>
                  From your answers, Remy won’t plan for weight loss, set calorie or protein goals, or track weight. Meals stay regular and balanced
                  {riskFlags(A).length ? ', and a few foods that need extra care are left out' : ''}. A doctor or registered dietitian is the right guide for anything more.
                </span>
              </div>
            ) : health.length > 0 ? (
              <div className="warnline">
                <Icon name="info" size={16} />
                <span>
                  You mentioned {listText(health).toLowerCase()}. Remy keeps meals general and can’t tailor them medically; please review the plan with your care team.
                </span>
              </div>
            ) : null}
          </section>

          <section className="sec">
            <h2>Goals</h2>
            <div className="panel kv">
              <Row label="Main goal" id="goal" />
              <Row label="Approach" id="pace" />
              {A.calories !== undefined && <Row label="Calorie estimate" id="calories" conf="medium" src="Optional estimate, not a target" />}
              <Row label="Plan structure" id="structure" />
              <Row label="Balance help" id="balance" src="Protein at each meal, fruit or vegetables daily" />
              <Row label="Progress tracking" id="progress" />
              <Row label="What got in the way before" id="past" />
            </div>
            {lowCalories && (
              <div className="warnline">
                <Icon name="info" size={16} />
                <span>{str(A.calories)} kcal is below what Remy plans on its own (about 1,200 a day). Keep it only if a doctor or dietitian set it for you.</span>
              </div>
            )}
            {s.confirmed && (A.pace === 'Some structure' || A.pace === 'Detailed') && !noWeightLoss(A) && planState.nutrition.from !== 'estimate' && (
              <div className="row gap-top">
                <button
                  type="button"
                  className="linkbtn"
                  onClick={() => {
                    actions.go('nutrition');
                    actions.openSheet('estimate');
                  }}
                >
                  <Icon name="heart" size={15} /> Want a starting estimate for calories and protein?
                </button>
              </div>
            )}
          </section>

          <section className="sec">
            <h2>
              <span className="grow">Foods</span>
              <button type="button" className="linkbtn tight" onClick={() => actions.edit('rateA')}>
                <Icon name="edit" size={15} /> Edit
              </button>
            </h2>
            <div className="panel kv">
              {LEVELS.map((l) => {
                let items = Object.keys(rat)
                  .filter((f) => rat[f] === l.id)
                  .map((f) => {
                    if (l.id !== 'ways') return FOODS[f].n;
                    const w = ways[f];
                    return `${FOODS[f].n}: ${w?.length ? w.join(', ').toLowerCase() : 'preparation not set'}`;
                  });
                if (l.id === 'love') items = items.concat(real(A.favorites).map((x) => `${x} (meal)`));
                if (l.id === 'never') for (const x of arr(A.never)) if (!items.some((i) => i.toLowerCase() === x.toLowerCase())) items.push(x);
                if (!items.length) return null;
                return (
                  <div key={l.id}>
                    <div className="grow">
                      <span className={`lvl l-${l.id}`}>{l.name}</span>
                      <div className="v gap-top">{items.join(' · ')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="sec">
            <h2>Flavor and texture</h2>
            <div className="panel kv">
              <Row label="Flavors" id="flavors" />
              <Row label="Sauces" id="sauces" />
              <Row label="Cuisines" id="cuisines" />
              <Row label="Textures that are a no" id="textures" />
              <Row label="Mixed dishes" id="mixed" />
              <Row label="Spice" id="spice" />
              <Row label="Hidden ingredients" id="visible" />
              <Row label="Smells to avoid" id="smells" />
              <Row label="Temperatures" id="temps" />
              <Row label="Why vegetables miss" id="vegwhy" />
            </div>
          </section>

          <section className="sec">
            <h2>Sweets</h2>
            <div className="panel kv">
              <Row label="Loves" id="sweets" />
              <Row label="Most satisfying" id="satisfy" />
              <Row label="How often" id="sweetfreq" />
              <Row label="Portion style" id="portion" />
              <Row label="Style" id="sweetstyle" />
            </div>
          </section>

          <section className="sec">
            <h2>Variety</h2>
            <div className="panel kv">
              <Row label="Repeats" id="repeats" />
              <Row label="Trying new foods" id="newfoods" />
              <Row label="Retrying dislikes" id="retry" />
            </div>
          </section>

          <section className="sec">
            <h2>Cooking day</h2>
            <div className="panel kv">
              <Row label="Prep day" id="prepday" value={DAY_FULL[str(A.prepday)]} />
              <Row label="Time available" id="preptime" />
              <Row label="Confidence" id="skill" />
              <Row label="Cooking methods" id="methods" />
              <Row label="Cleanup" id="cleanup" />
            </div>
          </section>

          <section className="sec">
            <h2>Equipment and storage</h2>
            <div className="panel kv">
              <Row label="Equipment" id="equipment" />
              <Row label="Freezer" id="freezer" />
              <Row label="Fridge" id="fridge" />
              <Row label="Containers" id="containers" />
              <Row label="Leftovers" id="leftovers" />
              <Row label="Components" id="components" />
              <Row label="Doesn’t reheat well" id="reheat" />
            </div>
          </section>

          <section className="sec">
            <h2>Budget and schedule</h2>
            <div className="panel kv">
              <Row label="Weekly budget" id="budget" />
              <Row label="Store" id="store" />
              <Row label="Household" id="household" />
              <Row label="Usual meals" id="schedule" />
              <Row label="From prep day" id="fromprep" />
              <Row label="Hungriest" id="appetite" />
              <Row label="Work week" id="work" />
              <Row label="Microwave at work" id="workmicro" />
              <Row label="Eaten away from home" id="away" />
              <Row label="Pantry" id="pantry" />
              <Row label="Frozen vegetables and fruit" id="frozenveg" src="From a weekly check-in" />
              <Row label="Trusted brands" id="brands" src="From a weekly check-in" />
              <Row label="Dishes from home" id="homedishes" src="From a weekly check-in" />
            </div>
          </section>

          {inf.length > 0 && (
            <section className="sec">
              <h2>What I inferred</h2>
              <div className="list">
                {inf.map((x) => (
                  <div className="li" key={x.id}>
                    <span className="c-basil"><Icon name="spark" size={18} /></span>
                    <div className="grow">
                      <div className="t">{x.text}</div>
                      <div className="s">{x.src}</div>
                    </div>
                    <ConfTag c={x.conf} />
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="sec">
            <h2>Could sharpen suggestions</h2>
            <div className="list">
              {skippedQs.map((q) => (
                <button type="button" className="li li-btn" key={q.id} onClick={() => actions.edit(q.id)}>
                  <span className="c-citrus"><Icon name="info" size={18} /></span>
                  <div className="grow">
                    <div className="t">{q.say(s.answers)}</div>
                    <div className="s">Skipped · tap to answer</div>
                  </div>
                  <Icon name="right" size={18} />
                </button>
              ))}
              {laterQuestions(A).map((q) => (
                <div className="li" key={q.id}>
                  <span className="c-muted"><Icon name="chat" size={18} /></span>
                  <div className="grow">
                    <div className="t">{q.say(A)}</div>
                    <div className="s">I’ll ask this in a weekly check-in</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <footer className="foot">
        <button type="button" className="btn ghost" onClick={() => actions.openSheet('map')}>
          Edit answers
        </button>
        <span className="grow" />
        {s.confirmed ? (
          <button type="button" className="btn" onClick={() => actions.go('planner')}>
            See my week <Icon name="right" size={18} />
          </button>
        ) : (
          <button type="button" className="btn" onClick={actions.confirm}>
            <Icon name="check" size={18} /> Plan my week
          </button>
        )}
      </footer>
      {s.confirmed && <BottomNav />}
    </>
  );
}

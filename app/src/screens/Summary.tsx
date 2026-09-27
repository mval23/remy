import { Avatar, Icon } from '../components/Icon';
import { activeAnswers, applies, formatAnswer, sequence } from '../interview/engine';
import { allRatings, arr, asPreparations, listText, real, str } from '../interview/helpers';
import { FOODS, LEVELS, QBY } from '../interview/questions';
import { inferences, LATER_QUESTIONS, safetyRules, type Confidence } from '../profile/profile';
import { useRemy } from '../store';

const DAY_FULL: Record<string, string> = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

export function Summary() {
  const { interview: s, actions } = useRemy();
  const A = activeAnswers(s);
  const safety = safetyRules(A);
  const rat = allRatings(A);
  const ways = asPreparations(A.ways);
  const inf = inferences(A);
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
        <span className={`conf ${c}`}>{c}</span>
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
        <button type="button" className="iconbtn" aria-label="Back to welcome" onClick={() => actions.go('welcome')}>
          <Icon name="left" size={22} />
        </button>
        <div className="ttl">
          <h1>Your taste profile</h1>
          <p>{s.confirmed ? 'Confirmed · edit anytime' : 'Please check before I plan'}</p>
        </div>
      </header>
      <main className="body">
        <div className="msg top-gap">
          <Avatar />
          <div className="bubble">
            {s.confirmed
              ? 'This is what I know about you. Change anything, anytime. Meal planning arrives in the next version of the app.'
              : 'Here’s what I learned. Fix anything that’s off, then confirm.'}
          </div>
        </div>

        <section className="sec">
          <div className="safety">
            <h3>
              <Icon name="lock" size={18} /> Hard safety rules
            </h3>
            <p className="safety-sub">Never suggested anywhere, including sauces, substitutions and replacements.</p>
            {hasSafety ? (
              <div className="chips">
                {safety.allergies.map((x) => (
                  <span className="chip" key={x}>
                    <Icon name="shield" size={14} />
                    {x} · allergy
                  </span>
                ))}
                {safety.diet.map((x) => (
                  <span className="chip" key={x}>{x}</span>
                ))}
                {safety.intolerances.map((x) => (
                  <span className="chip" key={x}>{x} · intolerance</span>
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
          {health.length > 0 && (
            <div className="warnline">
              <Icon name="info" size={16} />
              <span>
                You mentioned {listText(health).toLowerCase()}. Remy keeps meals general and can’t tailor them medically; please review the plan with your care team.
              </span>
            </div>
          )}
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
                  <span className="conf high">high</span>
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
                  <span className={`conf ${x.conf}`}>{x.conf}</span>
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
            {LATER_QUESTIONS.map((t) => (
              <div className="li" key={t}>
                <span className="c-muted"><Icon name="chat" size={18} /></span>
                <div className="grow">
                  <div className="t">{t}</div>
                  <div className="s">I’ll ask this in a later check-in</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="foot">
        <button type="button" className="btn ghost" onClick={() => actions.openSheet('map')}>
          Edit answers
        </button>
        <span className="grow" />
        {s.confirmed ? (
          <span className="pill p-ok">
            <Icon name="check" size={13} /> Confirmed
          </span>
        ) : (
          <button type="button" className="btn" onClick={actions.confirm}>
            <Icon name="check" size={18} /> Looks right
          </button>
        )}
      </footer>
    </>
  );
}

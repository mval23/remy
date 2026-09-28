import { useRef } from 'react';
import { BottomNav, Header, RowButton } from '../components/Chrome';
import { AiConsent } from '../components/AiIdea';
import { Icon } from '../components/Icon';
import { activeAnswers } from '../interview/engine';
import { allRatings, str } from '../interview/helpers';
import { FOODS, LEVELS } from '../interview/questions';
import { WEEKS } from '../planning/data/weeks';
import { eachMeal } from '../planning/planner';
import { inferences, safetyRules } from '../profile/profile';
import { useRemy } from '../store';

const SWEET_FREQ: [string, string][] = [
  ['Every day', 'Every day'],
  ['Most days', 'Most days'],
  ['A few times a week', 'Few / week'],
];

/** Everything Remy believes about the user, and every way to change or delete it. */
export function Preferences() {
  const { interview, planState, actions, sync } = useRemy();
  const A = activeAnswers(interview);
  const safety = safetyRules(A);
  const rat = allRatings(A);
  const inf = inferences(A, planState.hiddenInferences);
  const learned = planState.learned;
  const fileInput = useRef<HTMLInputElement>(null);
  const aiIds = Object.keys(planState.aiRecipes);
  const inPlan = new Set<string>();
  if (planState.plan) eachMeal(planState.plan, (m) => m.r && inPlan.add(m.r));
  const hasSafety = safety.allergies.length + safety.diet.length + safety.intolerances.length > 0;

  return (
    <>
      <Header
        title="Preferences"
        sub="What Remy knows, and how to change it"
        right={
          <button type="button" className="iconbtn" aria-label="Sync and install" onClick={() => actions.go('account')}>
            <Icon name={sync.signedIn && sync.status !== 'offline' ? 'cloud' : 'cloudOff'} size={22} />
          </button>
        }
      />
      <main className="body">
        <div className="safety top-gap">
          <h3>
            <Icon name="lock" size={18} /> Safety rules (locked)
          </h3>
          {hasSafety ? (
            <div className="chips">
              {safety.allergies.map((x) => (
                <span className="chip" key={x}>{x} · allergy</span>
              ))}
              {safety.diet.map((x) => (
                <span className="chip" key={x}>{x}</span>
              ))}
              {safety.intolerances.map((x) => (
                <span className="chip" key={x}>{x} · intolerance</span>
              ))}
            </div>
          ) : (
            <p className="strong">None set</p>
          )}
          <button type="button" className="linkbtn danger" onClick={() => actions.edit('allergies')}>
            <Icon name="edit" size={15} /> Change safety rules
          </button>
        </div>

        <section className="sec">
          <h2>
            <span className="grow">Foods</span>
            <span className="hint">Tap to change</span>
          </h2>
          <div className="panel kv">
            {LEVELS.map((l) => {
              const foods = Object.keys(rat).filter((f) => rat[f] === l.id && FOODS[f]);
              if (!foods.length) return null;
              return (
                <div key={l.id} className="stack-tight">
                  <span className={`lvl l-${l.id} self-start`}>{l.name}</span>
                  <div className="chips">
                    {foods.map((f) => (
                      <button type="button" key={f} className="chip food-chip" onClick={() => actions.openFood(f)}>
                        <span aria-hidden="true">{FOODS[f].e}</span>
                        {FOODS[f].n}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="sec">
          <h2>Learned about you</h2>
          <div className="list">
            {inf.length + learned.length === 0 && <div className="empty">Nothing learned yet. Your weekly check-ins add to this.</div>}
            {learned.map((x) => (
              <div className="li" key={x.id}>
                <div className="grow">
                  <div className="t">{x.text}</div>
                  <div className="s">{x.src}</div>
                </div>
                <span className={`conf ${x.conf}`}>{x.conf}</span>
                <button type="button" className="iconbtn" aria-label={`Delete: ${x.text}`} onClick={() => actions.forget(x.id)}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            ))}
            {inf.map((x) => (
              <div className="li" key={x.id}>
                <div className="grow">
                  <div className="t">{x.text}</div>
                  <div className="s">{x.src}</div>
                </div>
                <span className={`conf ${x.conf}`}>{x.conf}</span>
                <button type="button" className="iconbtn" aria-label={`Delete: ${x.text}`} onClick={() => actions.hideInference(x.id)}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            ))}
          </div>
          <p className="hint gap-top">Deleting an item also undoes what it changed. Remy never moves a food to “Never” on its own; it asks first.</p>
        </section>

        <section className="sec">
          <h2>Plan settings</h2>
          <div className="panel stack">
            <div>
              <p className="hint strong">Variety</p>
              <div className="seg gap-top" role="group" aria-label="Variety">
                {(['favorites', 'balanced', 'variety'] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={planState.variety === v} onClick={() => actions.setVariety(v)}>
                    {WEEKS[v].label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="hint strong">Something sweet</p>
              <div className="seg gap-top" role="group" aria-label="How often something sweet">
                {SWEET_FREQ.map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={str(A.sweetfreq) === v} onClick={() => actions.setAnswer('sweetfreq', v, `Sweets: ${v.toLowerCase()}`)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {sync.configured && (
          <section className="sec">
            <h2>AI ideas</h2>
            {planState.aiConsent ? (
              <div className="panel stack">
                <p className="hint ink-2">
                  On. Ask for a new idea from “Replace” on any meal in your plan. Uses Google Gemini’s free service; Google may use what’s sent (your food preferences and
                  request, never your name, email, weight or health answers) to improve its products.
                </p>
                <button type="button" className="btn ghost wide" onClick={() => actions.setAiConsent(false)}>
                  Turn off AI ideas
                </button>
              </div>
            ) : (
              <AiConsent />
            )}
            {aiIds.length > 0 && (
              <div className="list gap-top-lg">
                {aiIds.map((id) => {
                  const r = planState.aiRecipes[id];
                  const used = inPlan.has(id);
                  return (
                    <div className="li" key={id}>
                      <span className="em-lg" aria-hidden="true">{r.e}</span>
                      <button type="button" className="grow li-text-btn" onClick={() => actions.openRecipe(id)}>
                        <div className="t">{r.short}</div>
                        <div className="s">{r.slot} · {used ? 'in this week’s plan' : 'saved idea'}</div>
                      </button>
                      <button
                        type="button"
                        className="iconbtn"
                        disabled={used}
                        aria-label={used ? `${r.short} is in this week’s plan; replace it there first` : `Delete ${r.short}`}
                        onClick={() => actions.deleteAiRecipe(id)}
                      >
                        <Icon name="trash" size={17} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className="sec">
          <h2>Profile</h2>
          <div className="list">
            <RowButton icon="list" title="Full taste profile" sub="Every answer, with confidence levels" onClick={() => actions.go('summary')} />
            <RowButton icon="heart" title="Nutrition balance" sub="Balance checks, estimates, targets, progress" onClick={() => actions.go('nutrition')} />
            <RowButton icon="chat" title="Change an interview answer" sub="Jump to any question" onClick={() => actions.openSheet('map')} />
            <RowButton icon="cloud" title="Sync & install" sub={sync.signedIn ? `Signed in as ${sync.email}` : 'Use Remy on your phone and computer'} onClick={() => actions.go('account')} />
          </div>
        </section>

        <section className="sec">
          <h2>Your data</h2>
          <div className="panel stack">
            <p className="hint ink-2">
              {sync.signedIn
                ? 'Your data is saved on this device and synced to your account. Nobody else can read it.'
                : 'Your data is saved only in this browser on this device. Nothing is sent anywhere. A backup file lets you move it or keep a copy.'}
            </p>
            <button type="button" className="btn ghost wide" onClick={actions.exportData}>
              <Icon name="download" size={17} /> Download a backup
            </button>
            <button type="button" className="btn ghost wide" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={17} /> Restore from a backup
            </button>
            <input
              ref={fileInput}
              className="file-input"
              type="file"
              accept="application/json,.json"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void actions.importFile(f);
              }}
            />
            <button type="button" className="btn ghost wide" onClick={() => actions.openSheet('confirmForget')}>
              Delete learned preferences
            </button>
            <button type="button" className="btn ghost wide danger-outline" onClick={() => actions.openSheet('confirmRestart')}>
              <Icon name="trash" size={17} /> Delete everything
            </button>
          </div>
        </section>
      </main>
      <BottomNav />
    </>
  );
}

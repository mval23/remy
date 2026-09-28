import { useRef } from 'react';
import { BottomNav, Header } from '../components/Chrome';
import { AiConsent } from '../components/AiIdea';
import { DishLine, Leader, LeadLink, Mast, SecHead } from '../components/Dish';
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

  const count = (lv: string) => Object.keys(rat).filter((f) => rat[f] === lv && FOODS[f]).length;
  const loves = count('love');
  const nevers = count('never');
  const rules = [...safety.allergies.map((x) => `${x} allergy`), ...safety.diet, ...safety.intolerances.map((x) => `${x} intolerance`)];
  const shown = LEVELS.filter((l) => count(l.id) > 0);

  return (
    <>
      <Header
        title="Profile"
        sub="What Remy knows, and how to change it"
        right={
          <button type="button" className="iconbtn" aria-label="Sync and install" onClick={() => actions.go('account')}>
            <Icon name={sync.signedIn && sync.status !== 'offline' ? 'cloud' : 'cloudOff'} size={22} />
          </button>
        }
      />
      <main className="body wide">
        <Mast
          kicker="Remy’s notes"
          title="Your taste"
          sub={[loves && `${loves} food${loves > 1 ? 's' : ''} you love`, nevers && `${nevers} you never want`].filter(Boolean).join(' · ') || 'Rate foods in the interview to fill this in'}
        />
        <div className="masonry">
          <div>
            <section className="lock-box" aria-label="Safety rules (locked)">
              <div className="dish-line">
                <span className="dish-name">
                  <Icon name="lock" size={16} /> Safety rules
                </span>
                <Leader />
                <span className="v">{hasSafety ? rules.join(', ') : 'None set'}</span>
              </div>
              <button type="button" className="linkbtn danger" onClick={() => actions.edit('allergies')}>
                <Icon name="edit" size={15} /> Change safety rules
              </button>
            </section>

            {shown.map((l, i) => (
              <section className="msec" key={l.id}>
                <SecHead title={l.name} aside={i === 0 ? 'tap a food to change it' : undefined} />
                <div className="food-list">
                  {Object.keys(rat)
                    .filter((f) => rat[f] === l.id && FOODS[f])
                    .map((f) => (
                      <button type="button" key={f} className="food-link" onClick={() => actions.openFood(f)}>
                        <span aria-hidden="true">{FOODS[f].e}</span>
                        <span className="n">{FOODS[f].n}</span>
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </div>

          <section className="msec">
            <SecHead title="Learned about you" />
            {inf.length + learned.length === 0 && <p className="lead-note gap-top">Nothing learned yet. Your weekly check-ins add to this.</p>}
            {[...learned.map((x) => ({ ...x, forget: () => actions.forget(x.id) })), ...inf.map((x) => ({ ...x, forget: () => actions.hideInference(x.id) }))].map((x) => (
              <div className="learned-line" key={x.id}>
                <div className="grow">
                  <div className="dish-line">
                    <span className="t">{x.text}</span>
                    <Leader />
                    <span className={`conf ${x.conf}`}>{x.conf}</span>
                  </div>
                  <p className="hint">{x.src}</p>
                </div>
                <button type="button" className="iconbtn" aria-label={`Delete: ${x.text}`} onClick={x.forget}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            ))}
            <p className="hint gap-top">Deleting an item also undoes what it changed. Remy never moves a food to “Never” on its own; it asks first.</p>
          </section>

          <section className="msec">
            <SecHead title="Plan settings" />
            <div className="setting">
              <p className="hint strong">Variety</p>
              <div className="seg gap-top" role="group" aria-label="Variety">
                {(['favorites', 'balanced', 'variety'] as const).map((v) => (
                  <button key={v} type="button" aria-pressed={planState.variety === v} onClick={() => actions.setVariety(v)}>
                    {WEEKS[v].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="setting">
              <p className="hint strong">Something sweet</p>
              <div className="seg gap-top" role="group" aria-label="How often something sweet">
                {SWEET_FREQ.map(([v, label]) => (
                  <button key={v} type="button" aria-pressed={str(A.sweetfreq) === v} onClick={() => actions.setAnswer('sweetfreq', v, `Sweets: ${v.toLowerCase()}`)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {sync.configured && (
            <section className="msec">
              <SecHead title="AI ideas" aside={planState.aiConsent ? 'on' : 'off'} />
              {planState.aiConsent ? (
                <div className="stack gap-top">
                  <p className="lead-note">
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
              {aiIds.map((id) => {
                const r = planState.aiRecipes[id];
                const used = inPlan.has(id);
                return (
                  <div className="dish" key={id}>
                    <span className="dish-emoji" aria-hidden="true">{r.e}</span>
                    <div className="dish-body">
                      <DishLine name={r.short} onOpen={() => actions.openRecipe(id)} />
                      <p className="dish-desc">
                        {r.slot} · {used ? 'in this week’s plan' : 'saved idea'}
                      </p>
                    </div>
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
            </section>
          )}

          <section className="msec">
            <SecHead title="More" />
            <LeadLink k="Full taste profile" v="every answer" onClick={() => actions.go('summary')} />
            <LeadLink k="Nutrition balance" v="checks and goals" onClick={() => actions.go('nutrition')} />
            <LeadLink k="Change an interview answer" onClick={() => actions.openSheet('map')} />
            <LeadLink k="Reminders" onClick={() => actions.go('reminders')} />
            <LeadLink k="Sync & install" v={sync.signedIn ? 'signed in' : undefined} onClick={() => actions.go('account')} />
          </section>

          <section className="msec">
            <SecHead title="Your data" />
            <div className="stack gap-top">
              <p className="lead-note">
                {sync.signedIn
                  ? `Your data is saved on this device and synced to your account (${sync.email}). Nobody else can read it.`
                  : 'Your data is saved only in this browser on this device. Nothing is sent anywhere. A backup file lets you move it or keep a copy.'}
              </p>
              <button type="button" className="linkbtn self-start" onClick={() => actions.go('privacy')}>
                <Icon name="lock" size={16} /> Read the privacy note
              </button>
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
        </div>
      </main>
      <BottomNav />
    </>
  );
}

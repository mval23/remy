import { ACTIVITY, energyTargets, type BodyProfile, type Pace, type Sex } from '../planning/energy';
import { useRemy } from '../store';
import { Lead, Leader, Mast, SecHead } from './Dish';
import { Icon } from './Icon';
import { SheetFrame } from './PlanSheets';

const SEXES: { v: Sex; label: string }[] = [
  { v: 'female', label: 'Female' },
  { v: 'male', label: 'Male' },
  { v: 'average', label: 'Use the average' },
];
const PACES: { v: Pace; label: string }[] = [
  { v: 'gentle', label: 'Gentle' },
  { v: 'steady', label: 'Steady' },
];
const SEX_TERM: Record<Sex, string> = { female: '− 161', male: '+ 5', average: '− 78' };

const kcal = (x: number) => x.toLocaleString('en-US');
const num = (v: string): number | null => (v.trim() === '' ? null : Number(v));

function NumberLine({ id, label, unit, value, onChange }: { id: string; label: string; unit: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div className="lead tall">
      <label className="k" htmlFor={id}>
        {label}
      </label>
      <Leader />
      <input id={id} className="field goal-field" type="number" inputMode="decimal" placeholder={unit} value={value ?? ''} onChange={(e) => onChange(num(e.target.value))} />
    </div>
  );
}

/** The optional daily estimate: details in, a calorie and protein target out, with the working shown. */
export function EstimateSheet() {
  const { health: b, ctx, actions } = useRemy();
  const r = energyTargets(b, ctx.A);
  const set = (p: Partial<BodyProfile>) => actions.setBody(p);
  const hasDetails = b.ageYears !== null || b.heightCm !== null || b.weightKg !== null || b.consent;
  const activity = ACTIVITY.find((a) => a.pal === b.pal);
  return (
    <SheetFrame label="Your daily estimate">
      <Mast kicker="Optional" icon="heart" title="Your daily estimate" sub="A starting point for calories and protein from a few details. Roughly ±10%, and not medical advice." />
      <section className="msec">
        <p className="lead-note">
          Remy uses these details only for this estimate. They stay on this device: they aren’t synced to your account or sent to the AI. Backup files include them, and you can
          delete them here any time.
        </p>
        <NumberLine id="est-age" label="Age" unit="years" value={b.ageYears} onChange={(v) => set({ ageYears: v })} />
        <NumberLine id="est-height" label="Height" unit="cm" value={b.heightCm} onChange={(v) => set({ heightCm: v })} />
        <NumberLine id="est-weight" label="Weight" unit="kg" value={b.weightKg} onChange={(v) => set({ weightKg: v })} />
      </section>

      <section className="msec">
        <SecHead title="Sex used for the equation" />
        <div className="seg" role="group" aria-label="Sex used for the equation">
          {SEXES.map((s) => (
            <button key={s.v} type="button" aria-pressed={b.sex === s.v} onClick={() => set({ sex: s.v })}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="hint gap-top">The equation has a version for each. “Use the average” sits between them, about 80 kcal from either.</p>
      </section>

      <section className="msec">
        <SecHead title="Usual activity" />
        <div className="opts" role="radiogroup" aria-label="Usual activity">
          {ACTIVITY.map((a) => (
            <button key={a.pal} type="button" className="opt" role="radio" aria-checked={b.pal === a.pal} onClick={() => set({ pal: a.pal })}>
              <span className="dot">{b.pal === a.pal && <Icon name="check" size={12} />}</span>
              <span>
                {a.label}
                <small>{a.d}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="msec">
        <SecHead title="Pace" />
        <div className="seg" role="group" aria-label="Pace">
          {PACES.map((p) => (
            <button key={p.v} type="button" aria-pressed={b.pace === p.v} onClick={() => set({ pace: p.v })}>
              {p.label}
            </button>
          ))}
        </div>
        <p className="hint gap-top">Gentle aims about 10% under what you use; steady about 15%, never more than 500 kcal. There’s no faster setting.</p>
      </section>

      <section className="msec">
        <SecHead title="Your estimate" />
        {r.ok ? (
          <>
            <div className="bill">
              <div className="dish-line">
                <span className="dish-name">Calories a day</span>
                <Leader />
                <span className="dish-kcal">≈{kcal(r.plan.target)}</span>
              </div>
              <p className="bill-note">
                Somewhere between {kcal(r.plan.range[0])} and {kcal(r.plan.range[1])} kcal. Remy never plans a day under {kcal(r.plan.floor)}.
              </p>
            </div>
            <Lead k="Protein" v={r.plan.proteinG ? `about ${r.plan.proteinG} g` : 'from your doctor or dietitian'} />
            <Lead k="Fiber" v={`at least ${r.plan.fiberG} g`} />
            <Lead k="Evening sweet" v={`about ${r.plan.sweetKcal} kcal`} />
            {r.plan.notes.map((n) => (
              <p className="lead-note" key={n}>
                {n}
              </p>
            ))}
            <details className="gap-top">
              <summary className="linkbtn">How Remy worked this out</summary>
              <ul className="hint">
                <li>
                  Resting energy (the Mifflin-St Jeor equation): 10 × {b.weightKg} kg + 6.25 × {b.heightCm} cm − 5 × {b.ageYears} years {SEX_TERM[b.sex!]} ≈ {kcal(r.plan.ree)} kcal.
                </li>
                <li>
                  × {b.pal} for “{activity?.label.toLowerCase()}” ≈ {kcal(r.plan.tdee)} kcal a day.
                </li>
                <li>
                  − {Math.round(r.plan.deficit * 100)}% for a {r.plan.deficit > 0.1 ? 'steady' : 'gentle'} pace (at most 500 kcal), rounded to 50: {kcal(r.plan.target)} kcal.
                </li>
                <li>Never under {kcal(r.plan.floor)} kcal: the minimum for the equation you chose, or your resting energy if that’s higher.</li>
                {r.plan.proteinG && (
                  <li>
                    Protein: 1.4 g × {r.plan.refKg} kg{r.plan.refKg < (b.weightKg ?? 0) ? ' (your weight at a BMI of 25)' : ''} ≈ {r.plan.proteinG} g.
                  </li>
                )}
                <li>It’s a starting point, not a prescription. Open this again to update it when your weight or activity changes.</li>
              </ul>
            </details>
            <button type="button" className="btn wide gap-top-lg" onClick={actions.useEstimate}>
              <Icon name="check" size={17} /> Use this estimate
            </button>
            <p className="hint gap-top">
              Remy fits this week and the weeks ahead to it: lighter or heavier recipes you like, protein sides, then portions. Meals you approved keep their recipe, and your
              sweet always stays.
            </p>
          </>
        ) : (
          <p className="lead-note">{r.reason}</p>
        )}
        {hasDetails && (
          <button type="button" className="btn ghost wide gap-top" onClick={actions.forgetBody}>
            <Icon name="trash" size={16} /> Delete my details
          </button>
        )}
      </section>
    </SheetFrame>
  );
}

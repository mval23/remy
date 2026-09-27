import { BottomNav, Header, StoragePill } from '../components/Chrome';
import { Icon } from '../components/Icon';
import { allRatings } from '../interview/helpers';
import { LEVELS } from '../interview/questions';
import { ING } from '../planning/data/ingredients';
import { R } from '../planning/data/recipes';
import { fraction, quantityText } from '../planning/grocery';
import { estimatesOn, proteinTarget } from '../planning/nutrition';
import { eachMeal, portions } from '../planning/planner';
import { check, matches, storage } from '../planning/rules';
import type { StorageInfo } from '../planning/types';
import { useRemy } from '../store';

export function Recipe() {
  const { planState, ctx, ui } = useRemy();
  const r = ui.recipeId ? R[ui.recipeId] : null;
  if (!r || !planState.plan) return null;
  const A = ctx.A;
  const rat = allRatings(A);
  const plan = planState.plan;
  const count = portions(plan)[r.id] ?? 0;
  const batches = Math.max(1, Math.ceil(count / r.serves));
  const handsOn = r.tasks.filter((t) => t.l === 'hands').reduce((s, t) => s + t.m, 0);
  const nums = estimatesOn(planState.nutrition, A);
  const target = proteinTarget(r.slot, ctx.hungry);
  const found = matches(r, A);

  const days: { d: string; st: StorageInfo }[] = [];
  eachMeal(plan, (m, _slot, i, day) => {
    if (m.r === r.id) days.push({ d: day.d, st: storage(r, i + 1) });
  });

  // Substitutions only suggest foods rated Okay or better that pass the safety rules.
  const levelName = (lv: string) => LEVELS.find((l) => l.id === lv)?.name.toLowerCase() ?? lv;
  const subs = (r.subs ?? []).flatMap(([from, to, food]) => {
    if (!food) return [{ from, to, note: '' }];
    const lv = rat[food];
    if (!lv || lv === 'dislike' || lv === 'never') return [];
    const swapped = { ...r, foods: { [food]: 1 as const }, ing: [] };
    if (!check(swapped, A).ok) return [];
    return [{ from, to, note: `you rated it ${levelName(lv)}` }];
  });

  const fridgeText = r.store ? 'Keep frozen until eating.' : r.room ? `Airtight bag at room temperature, up to ${r.fridge} days.` : r.fridge ? `Up to ${r.fridge} day${r.fridge > 1 ? 's' : ''} after prep day, at 40°F / 4°C or colder.` : 'Not stored in the fridge. It goes straight to the freezer.';
  const freezerText = r.freezer ? `Up to ${r.freezer} months for best quality, at 0°F / −18°C.` : 'Don’t freeze; the texture suffers.';

  return (
    <>
      <Header title={r.short} sub={r.slot} back={ui.recipeBack} />
      <main className="body">
        <div className="row recipe-top">
          <div className="recipe-emoji" aria-hidden="true">{r.e}</div>
          <div>
            <h2 className="recipe-name">{r.name}</h2>
            <div className="chips tight gap-top">
              <span className="pill p-muted">{r.slot}</span>
              <span className="pill p-muted">{r.store ? 'Store-bought' : `${handsOn} min hands-on`}</span>
              <span className="pill p-muted">Makes {r.serves}</span>
            </div>
          </div>
        </div>

        <section className="sec">
          <h2>Why Remy picked this</h2>
          <div className="list">
            {r.why.map((w) => (
              <div className="li compact" key={w}>
                <span className="c-basil"><Icon name="check" size={18} /></span>
                <div className="grow">{w}</div>
              </div>
            ))}
            {found.length > 0 && (
              <div className="li compact">
                <span className="c-basil"><Icon name="spark" size={18} /></span>
                <div className="grow">
                  <span className="hint">Matches your profile: </span>
                  {found.join(', ')}
                </div>
              </div>
            )}
          </div>
        </section>
        {r.note && (
          <div className="warnline">
            <Icon name="info" size={16} />
            <span>{r.note}</span>
          </div>
        )}

        {days.length > 0 && (
          <section className="sec">
            <h2>This week</h2>
            <div className="chips">
              {days.map((x, i) => (
                <span className="chip static" key={i}>
                  {x.d} <StoragePill st={x.st} />
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="sec">
          <h2>
            <span className="grow">Ingredients</span>
            {batches > 1 && <span className="pill p-warn">×{batches} batches this week</span>}
          </h2>
          <div className="list">
            {r.ing.map(([k, q]) => (
              <div className="li compact" key={k}>
                <div className="grow">{ING[k].n}</div>
                <span className="mono hint">{quantityText(q, ING[k].u)}</span>
              </div>
            ))}
          </div>
        </section>

        {r.steps.length > 0 && (
          <section className="sec">
            <h2>Steps</h2>
            <ol className="panel steps">
              {r.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
        )}

        <section className="sec">
          <h2>Storage and reheating</h2>
          <div className="panel kv">
            <div>
              <span className="c-blue"><Icon name="fridge" size={18} /></span>
              <div className="grow"><div className="k">Fridge</div><div className="v">{fridgeText}</div></div>
            </div>
            <div>
              <span className="c-blue"><Icon name="snow" size={18} /></span>
              <div className="grow"><div className="k">Freezer</div><div className="v">{freezerText}</div></div>
            </div>
            {r.thaw && (
              <div>
                <span className="c-blue"><Icon name="clock" size={18} /></span>
                <div className="grow"><div className="k">Thawing</div><div className="v">{r.thaw}</div></div>
              </div>
            )}
            <div>
              <span className="c-carrot"><Icon name="therm" size={18} /></span>
              <div className="grow"><div className="k">Reheating</div><div className="v">{r.reheat}</div></div>
            </div>
          </div>
        </section>

        {subs.length > 0 && (
          <section className="sec">
            <h2>Substitutions</h2>
            <div className="list">
              {subs.map((s) => (
                <div className="li compact" key={s.from + s.to}>
                  <Icon name="swap" size={17} />
                  <div className="grow">
                    {s.from} → <b>{s.to}</b>
                    {s.note && <span className="hint"> ({s.note})</span>}
                  </div>
                </div>
              ))}
            </div>
            <p className="hint gap-top">Only foods you rated Okay or better, and never anything that conflicts with your safety rules.</p>
          </section>
        )}

        <section className="sec">
          <h2>Nutrition</h2>
          <div className="panel kv">
            {r.plate && (
              <div>
                <span className="c-basil"><Icon name="box" size={18} /></span>
                <div className="grow"><div className="k">Portion</div><div className="v">{r.plate}</div></div>
              </div>
            )}
            <div>
              <span className="c-carrot"><Icon name="spark" size={18} /></span>
              <div className="grow">
                <div className="k">Protein</div>
                <div className="v">
                  {target ? (r.pro >= target ? `Good source for a ${r.slot.toLowerCase()}` : 'On the light side. Pair it with a protein side.') : r.pro >= 10 ? 'Some protein' : 'Not a focus for this slot'}
                  {nums && <span className="mono hint"> ≈{r.pro} g</span>}
                </div>
              </div>
            </div>
            <div>
              <span className="c-basil"><Icon name="heart" size={18} /></span>
              <div className="grow">
                <div className="k">Fruit and vegetables</div>
                <div className="v">{r.prod ? `${fraction(r.prod)} serving${r.prod > 1 ? 's' : ''}` : 'None'}</div>
              </div>
            </div>
            {nums && (
              <div>
                <span className="c-muted"><Icon name="info" size={18} /></span>
                <div className="grow">
                  <div className="k">Estimate</div>
                  <div className="v">About {r.kcal} kcal per portion <span className="hint">(brands and portions vary)</span></div>
                </div>
              </div>
            )}
          </div>
          {!nums && <p className="hint gap-top">Calorie estimates are off. Turn them on in Nutrition balance if you want them.</p>}
        </section>
      </main>
      <BottomNav />
    </>
  );
}

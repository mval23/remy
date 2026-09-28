import { useState } from 'react';
import { BottomNav, Header, StoragePill } from '../components/Chrome';
import { Lead, Mast, SecHead } from '../components/Dish';
import { Icon } from '../components/Icon';
import { LaneTag, StepLines } from '../components/Steps';
import { allRatings } from '../interview/helpers';
import { LEVELS } from '../interview/questions';
import { ING } from '../planning/data/ingredients';
import { R } from '../planning/data/recipes';
import { fraction, quantityText } from '../planning/grocery';
import { isDetailed, taskLines } from '../planning/method';
import { estimatesOn, proteinTarget } from '../planning/nutrition';
import { eachMeal, portions, portionSizes } from '../planning/planner';
import { check, matchReasons, storage } from '../planning/rules';
import { duration } from '../planning/schedule';
import { DAY_FULL, type Day, type StorageInfo } from '../planning/types';
import { useRemy } from '../store';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** One recipe, laid out like a dish on a menu: name, calories and macros up top, amounts on dotted lines. */
export function Recipe() {
  const { planState, ctx, ui } = useRemy();
  // Amounts for this week’s batches, or for one batch.
  const [oneBatch, setOneBatch] = useState(false);
  const r = ui.recipeId ? R[ui.recipeId] : null;
  if (!r || !planState.plan) return null;
  const A = ctx.A;
  const rat = allRatings(A);
  const plan = planState.plan;
  const count = portions(plan)[r.id] ?? 0;
  const batches = Math.max(1, Math.ceil(count / r.serves));
  // Goals can make this week's portions a little smaller or bigger; the week's amounts follow.
  const size = portionSizes(plan)[r.id] ?? 1;
  const scale = oneBatch ? 1 : batches * size;
  const handsOn = r.tasks.filter((t) => t.l === 'hands').reduce((s, t) => s + t.m, 0);
  const nums = estimatesOn(planState.nutrition, A);
  const target = proteinTarget(r.slot, ctx.hungry);
  const found = matchReasons(r, A).filter((x) => !r.why.slice(1).some((w) => w.toLowerCase().startsWith(x.name.toLowerCase())));

  const days: { d: Day; st: StorageInfo }[] = [];
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
    return [{ from, to, note: levelName(lv) }];
  });

  const fridge = r.store ? 'Keep frozen' : r.room ? `${plural(r.fridge, 'day')}, pantry` : r.fridge ? plural(r.fridge, 'day') : 'Straight to the freezer';
  const freezer = r.freezer ? plural(r.freezer, 'month') : r.store ? 'Until eating' : 'Don’t freeze';
  const keepNote = r.store
    ? 'Keep frozen until eating.'
    : `${r.room ? 'In an airtight bag at room temperature.' : r.fridge ? 'Days count from prep day, in the fridge at 4°C or colder.' : 'It goes straight to the freezer after prep.'}${r.freezer ? ' In the freezer at −18°C, best within that time.' : ' It doesn’t freeze well; the texture suffers.'}`;
  // Days with the same storage share a line: "Mon, Tue, Wed ........ Fridge".
  const byStorage: { days: Day[]; st: StorageInfo }[] = [];
  for (const x of days) {
    const g = byStorage.find((y) => y.st.l === x.st.l && y.st.k === x.st.k);
    if (g) g.days.push(x.d);
    else byStorage.push({ days: [x.d], st: x.st });
  }
  const [why, ...moreWhy] = r.why;

  return (
    <>
      <Header title="Recipe" back={ui.recipeBack} />
      <main className="body wide" tabIndex={0}>
        <div className="cols">
          <div>
            <Mast icon={null} kicker={`${r.e} ${r.slot} · makes ${r.serves}${count ? ` · ${count} this week` : ''}`} title={r.short} sub={r.name !== r.short ? r.name : undefined}>
              {nums && (
                <div className="macro-tiles" role="group" aria-label="Per portion">
                  <div><b>{r.kcal.toLocaleString('en-US')}</b><span>kcal</span></div>
                  <div><b>{r.pro} g</b><span>protein</span></div>
                  <div><b>{r.carb} g</b><span>carbs</span></div>
                  <div><b>{r.fat} g</b><span>fat</span></div>
                </div>
              )}
              <div className="chips tight">
                <span className="pill p-muted">{r.store ? 'Store-bought' : `${handsOn} min hands-on`}</span>
                {!r.store && r.fridge > 0 && <span className="pill p-fridge">{r.room ? 'Pantry' : 'Fridge'} {plural(r.fridge, 'day')}</span>}
                {r.freezer > 0 && <span className="pill p-fridge">Freezer {plural(r.freezer, 'month')}</span>}
              </div>
            </Mast>

            {why && <p className="why-line">“{why}”</p>}
            {r.note && (
              <div className="warnline">
                <Icon name="info" size={16} />
                <span>{r.note}</span>
              </div>
            )}

            {days.length > 0 && (
              <section className="msec">
                <SecHead title="This week" aside={count > 1 ? `${count} portions` : undefined} />
                {byStorage.map((g) => (
                  <Lead key={g.days.join()} k={g.days.length === 1 ? DAY_FULL[g.days[0]] : g.days.join(', ')} v={<StoragePill st={g.st} />} />
                ))}
              </section>
            )}

            <section className="msec">
              <SecHead title="Ingredients" aside={oneBatch || batches === 1 ? 'one batch' : 'for this week'} />
              {batches > 1 && (
                <div className="seg" role="group" aria-label="Amounts for">
                  <button type="button" aria-pressed={!oneBatch} onClick={() => setOneBatch(false)}>
                    This week (×{batches})
                  </button>
                  <button type="button" aria-pressed={oneBatch} onClick={() => setOneBatch(true)}>
                    One batch ({r.serves})
                  </button>
                </div>
              )}
              {r.ing.map(([k, q]) => (
                <Lead key={k} k={ING[k].n} v={quantityText(q * scale, ING[k].u)} />
              ))}
              <p className="hint gap-top">
                Makes {r.serves * (oneBatch ? 1 : batches)} portions{!oneBatch && size !== 1 ? `, each ${Math.round(size * 100)}% of the usual size to fit your goals` : ''}. Tbsp and tsp are
                standard 15 ml and 5 ml spoons.
              </p>
            </section>
          </div>

          <div>
            {isDetailed(r) ? (
              <section className="msec">
                <SecHead title="Preparation" aside={r.store ? undefined : `${handsOn} min hands-on`} />
                {r.tasks.map((t, i) => (
                  <div className="mstep" key={i}>
                    <div className="dish-line">
                      <span className="num">{i + 1}</span>
                      <span className="dish-name">{t.t}</span>
                      <span className="leader" aria-hidden="true" />
                      <span className="min">{duration(t.m)}</span>
                    </div>
                    <LaneTag lane={t.l} temp={t.temp} />
                    <StepLines lines={taskLines(t, [{ r, batches: scale }])} />
                  </div>
                ))}
                {!r.store && <p className="hint gap-top">On prep day these steps run alongside your other recipes; the Prep screen shows the fastest order.</p>}
              </section>
            ) : (
              r.steps.length > 0 && (
                <section className="msec">
                  <SecHead title="Steps" />
                  <ol className="msteps-simple">
                    {r.steps.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ol>
                </section>
              )
            )}

            {(moreWhy.length > 0 || found.length > 0) && (
              <section className="msec">
                <SecHead title="Why Remy picked it" />
                {moreWhy.length > 0 && (
                  <ul className="note-list">
                    {moreWhy.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                {found.map((x) => (
                  <Lead key={x.name} k={x.name} v={x.why} />
                ))}
              </section>
            )}

            <section className="msec">
              <SecHead title="Keeping it" />
              <Lead k="Fridge" v={fridge} />
              <Lead k="Freezer" v={freezer} />
              <p className="lead-note">{keepNote}</p>
              {r.thaw && (
                <p className="lead-note">
                  <b>Thawing:</b> {r.thaw}
                </p>
              )}
              <p className="lead-note">
                <b>Reheating:</b> {r.reheat}
              </p>
            </section>

            {subs.length > 0 && (
              <section className="msec">
                <SecHead title="Substitutions" />
                {subs.map((s) => (
                  <div key={s.from + s.to}>
                    <Lead k={s.from} v={s.to} wrap />
                    {s.note && <p className="lead-note">You rated it {s.note}.</p>}
                  </div>
                ))}
                <p className="hint gap-top">Only foods you rated Okay or better, and never anything that conflicts with your safety rules.</p>
              </section>
            )}

            <section className="msec">
              <SecHead title="Per portion" />
              {nums && (
                <>
                  <Lead k="Calories" v={`${r.kcal.toLocaleString('en-US')} kcal`} />
                  <Lead k="Protein" v={`${r.pro} g`} />
                  <Lead k="Carbs" v={`${r.carb} g`} />
                  <Lead k="Fat" v={`${r.fat} g`} />
                </>
              )}
              <Lead k="Fruit and vegetables" v={r.prod ? `${fraction(r.prod)} serving${r.prod > 1 ? 's' : ''}` : 'None'} />
              <p className="lead-note">
                <b>Protein:</b>{' '}
                {target ? (r.pro >= target ? `good source for a ${r.slot.toLowerCase()}.` : 'on the light side. Pair it with a protein side.') : r.pro >= 10 ? 'some protein.' : 'not a focus for this slot.'}
              </p>
              {r.plate && (
                <p className="lead-note">
                  <b>Portion:</b> {r.plate}
                  {r.slot === 'Evening sweet' && planState.sweetPortion && (
                    <>
                      {' '}
                      {planState.sweetPortion === 'more'
                        ? 'You said this portion felt small, so go a little bigger, about a quarter more. Satisfying beats strict.'
                        : 'You said this portion felt like too much, so cut it a little smaller. Any extra keeps for another day.'}
                    </>
                  )}
                </p>
              )}
              {nums ? (
                <p className="hint gap-top">
                  Per portion as written. Rough estimates added up from the ingredients; brands and portions vary.
                  {size !== 1 && ` This week your portions are ${Math.round(size * 100)}% of this, to fit your goals.`}
                </p>
              ) : (
                <p className="hint gap-top">Calories and macros are hidden. Turn on estimates in Nutrition balance to see calories, protein, carbs and fat.</p>
              )}
            </section>
          </div>
        </div>
      </main>
      <BottomNav />
    </>
  );
}

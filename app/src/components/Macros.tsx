import type { MacroShown } from '../planning/macros';

/** Grams as shown: to the nearest 5 g above 20 g, since these are rough estimates ("35 g", not "37 g"). */
export const gramsShown = (x: number) => (x > 20 ? Math.round(x / 5) * 5 : Math.round(x));
/** Fiber to the nearest gram. */
const fiberShown = (x: number) => Math.round(x);

/** "540 kcal · 40 g protein · 55 g carbs · 20 g fat · 6 g fiber" */
export const macroText = (n: MacroShown) =>
  `${n.kcal.toLocaleString('en-US')} kcal · ${gramsShown(n.pro)} g protein · ${gramsShown(n.carb)} g carbs · ${gramsShown(n.fat)} g fat${n.fiber !== undefined ? ` · ${fiberShown(n.fiber)} g fiber` : ''}`;

/** Calories and macros in small columns. Only shown when estimates are on. */
export function MacroRow({ n, note }: { n: MacroShown; note?: string }) {
  return (
    <div className="macros" role="group" aria-label={`About ${macroText(n)}${note ? `, ${note}` : ''}`}>
      <div><b>{n.kcal.toLocaleString('en-US')}</b><span>kcal</span></div>
      <div><b>{gramsShown(n.pro)} g</b><span>protein</span></div>
      <div><b>{gramsShown(n.carb)} g</b><span>carbs</span></div>
      <div><b>{gramsShown(n.fat)} g</b><span>fat</span></div>
      {n.fiber !== undefined && <div><b>{fiberShown(n.fiber)} g</b><span>fiber</span></div>}
    </div>
  );
}

/** The same numbers as a sentence, bold figures: "35 g protein · 55 g carbs · 20 g fat · 6 g fiber". */
export function MacroFigures({ n }: { n: MacroShown }) {
  return (
    <>
      <b>{gramsShown(n.pro)} g</b> protein · <b>{gramsShown(n.carb)} g</b> carbs · <b>{gramsShown(n.fat)} g</b> fat
      {n.fiber !== undefined && (
        <>
          {' '}· <b>{fiberShown(n.fiber)} g</b> fiber
        </>
      )}
    </>
  );
}

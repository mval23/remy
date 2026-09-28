import type { Macros } from '../planning/macros';

/** "540 kcal · 38 g protein · 55 g carbs · 18 g fat" */
export const macroText = (n: Macros) => `${n.kcal.toLocaleString('en-US')} kcal · ${n.pro} g protein · ${n.carb} g carbs · ${n.fat} g fat`;

/** Calories and macros in four small columns. Only shown when estimates are on. */
export function MacroRow({ n, note }: { n: Macros; note?: string }) {
  return (
    <div className="macros" role="group" aria-label={`About ${macroText(n)}${note ? `, ${note}` : ''}`}>
      <div><b>{n.kcal.toLocaleString('en-US')}</b><span>kcal</span></div>
      <div><b>{n.pro} g</b><span>protein</span></div>
      <div><b>{n.carb} g</b><span>carbs</span></div>
      <div><b>{n.fat} g</b><span>fat</span></div>
    </div>
  );
}

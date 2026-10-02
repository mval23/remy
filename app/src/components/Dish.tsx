import type { ReactNode } from 'react';
import { ingredientName } from '../planning/method';
import type { MacroShown } from '../planning/macros';
import type { Recipe } from '../planning/types';
import { Icon, type IconName } from './Icon';
import { MacroFigures, macroText } from './Macros';

/** Pantry basics left out of a dish's description. */
const BASICS = new Set(['oil', 'spices', 'bakingpowder', 'vanilla', 'cumin', 'paprika', 'herbs', 'cinnamon', 'taco', 'garlic', 'sugar']);

/** What's in a dish, the way a menu says it: "Rolled oats, milk, vanilla Greek yogurt, …". */
export function describe(r: Recipe): string {
  const text = r.ing
    .filter(([k]) => !BASICS.has(k))
    .map(([k]) => ingredientName(k, 2))
    .join(', ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The dotted line between a name and its value. */
export const Leader = () => <span className="leader" aria-hidden="true" />;

/** "17 g protein · 70 g carbs · 7 g fat · 7 g fiber", numbers in bold. */
export function MacroLine({ n, note }: { n: MacroShown; note?: string }) {
  return (
    <p className="macro-line" aria-label={`About ${macroText(n)}${note ? `, ${note}` : ''}`}>
      <MacroFigures n={n} />
      {note ? ` · ${note}` : ''}
    </p>
  );
}

/**
 * Name ........ 550 kcal. The name opens the recipe when `onOpen` is given. With estimates off (no kcal) the dots end in
 * `value` instead ("3 min", "cold"), or there are no dots.
 */
export function DishLine({ name, kcal, value, onOpen }: { name: string; kcal?: number | null; value?: ReactNode; onOpen?: () => void }) {
  return (
    <div className="dish-line">
      {onOpen ? (
        <button type="button" className="dish-name" onClick={onOpen}>
          {name}
        </button>
      ) : (
        <span className="dish-name">{name}</span>
      )}
      {kcal != null ? (
        <>
          <Leader />
          <span className="dish-kcal">{kcal.toLocaleString('en-US')} kcal</span>
        </>
      ) : (
        value != null && (
          <>
            <Leader />
            <span className="dish-kcal alt">{value}</span>
          </>
        )
      )}
    </div>
  );
}

/** Label ........ value */
export function Lead({ k, v, wrap }: { k: ReactNode; v: ReactNode; wrap?: boolean }) {
  return (
    <div className="lead">
      <span className="k">{k}</span>
      <Leader />
      <span className={`v${wrap ? ' wrap' : ''}`}>{v}</span>
    </div>
  );
}

/** Label ........ value  › that opens another screen. */
export function LeadLink({ k, v, onClick }: { k: ReactNode; v?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="lead lead-link" onClick={onClick}>
      <span className="k">{k}</span>
      <Leader />
      {v != null && v !== '' && <span className="v">{v}</span>}
      <Icon name="right" size={16} />
    </button>
  );
}

/** A framed note from the chef, its kicker set into the frame. */
export function ChefNote({ kicker, icon = 'spark', children }: { kicker: string; icon?: IconName; children: ReactNode }) {
  return (
    <section className="chef-note" aria-label={kicker}>
      <span className="chef-note-kicker">
        <Icon name={icon} size={15} /> {kicker}
      </span>
      {children}
    </section>
  );
}

/** A screen's masthead: small kicker, big headline, a line under it, then anything else. */
export function Mast({ kicker, icon = 'toque', title, sub, compact, children }: { kicker: ReactNode; icon?: IconName | null; title: string; sub?: ReactNode; compact?: boolean; children?: ReactNode }) {
  return (
    <div className="mast">
      <span className="mast-kicker">
        {icon && <Icon name={icon} size={16} />} {kicker}
      </span>
      <h2 className={compact || title.length > 13 ? 'long' : undefined}>{title}</h2>
      {sub && <p className="mast-sub">{sub}</p>}
      {children}
    </div>
  );
}

/** A menu section heading with a rule under it and something small on the right. */
export function SecHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="msec-head">
      <h3>{title}</h3>
      {aside != null && <span className="aside">{aside}</span>}
    </div>
  );
}

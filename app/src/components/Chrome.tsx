import type { ReactNode } from 'react';
import type { StorageInfo } from '../planning/types';
import { useRemy, type Screen } from '../store';
import { Icon, type IconName } from './Icon';

export function Header({ title, sub, back, right }: { title: string; sub?: string; back?: Screen; right?: ReactNode }) {
  const { actions } = useRemy();
  return (
    <header className="head">
      {back && (
        <button type="button" className="iconbtn" aria-label="Back" onClick={() => actions.go(back)}>
          <Icon name="left" size={22} />
        </button>
      )}
      <div className="ttl">
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {right}
    </header>
  );
}

const TABS: { id: Screen; icon: IconName; label: string; also: Screen[] }[] = [
  { id: 'home', icon: 'home', label: 'Home', also: [] },
  { id: 'planner', icon: 'cal', label: 'Plan', also: ['nutrition', 'recipe'] },
  { id: 'grocery', icon: 'cart', label: 'Grocery', also: [] },
  { id: 'prep', icon: 'clock', label: 'Prep', also: [] },
  { id: 'summary', icon: 'user', label: 'Profile', also: ['account'] },
];

export function BottomNav() {
  const { ui, actions } = useRemy();
  return (
    <nav className="nav" aria-label="Remy sections">
      {TABS.map((t) => {
        const on = ui.screen === t.id || t.also.includes(ui.screen);
        return (
          <button key={t.id} type="button" className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} onClick={() => actions.go(t.id)}>
            <Icon name={t.icon} size={22} />
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

export function StoragePill({ st }: { st: StorageInfo }) {
  if (st.k === 'fridge') return <span className="pill p-fridge"><Icon name="fridge" size={13} /> {st.l}</span>;
  if (st.k === 'freezer') return <span className="pill p-freeze"><Icon name="snow" size={13} /> {st.l}</span>;
  if (st.k === 'room') return <span className="pill p-muted">{st.l}</span>;
  if (st.k === 'unsafe') return <span className="pill p-bad"><Icon name="info" size={13} /> {st.l}</span>;
  return null;
}

/** A tappable list row. */
export function RowButton({ icon, tone, title, sub, onClick, children }: { icon?: IconName; tone?: string; title: string; sub?: string; onClick: () => void; children?: ReactNode }) {
  return (
    <button type="button" className="li li-btn" onClick={onClick}>
      {icon && <span className={tone}><Icon name={icon} size={22} /></span>}
      {children}
      <div className="grow">
        <div className="t">{title}</div>
        {sub && <div className="s">{sub}</div>}
      </div>
      <Icon name="right" size={18} />
    </button>
  );
}

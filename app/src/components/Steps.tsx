import type { CookStep, Part } from '../planning/method';
import type { Lane } from '../planning/types';

const LANE_TAG: Record<Lane, string> = { hands: 'Hands-on', oven: 'Oven', stove: 'Stovetop', chill: 'Fridge/freezer' };

/** One instruction line, with amounts in bold. */
export function Line({ parts }: { parts: Part[] }) {
  return <>{parts.map((p, i) => (p.amount ? <b key={i}>{p.t}</b> : <span key={i}>{p.t}</span>))}</>;
}

/** Where the step happens: Hands-on, Stovetop, Oven 200°C, Fridge/freezer. */
export function LaneTag({ lane, temp }: Pick<CookStep, 'lane' | 'temp'>) {
  return <span className={`lane-tag lt-${lane}`}>{lane === 'oven' && temp ? `Oven ${temp}°C` : LANE_TAG[lane]}</span>;
}

/** Numbered instruction lines. */
export function StepLines({ lines, big }: { lines: Part[][]; big?: boolean }) {
  if (!lines.length) return null;
  return (
    <ol className={`how${big ? ' how-big' : ''}`}>
      {lines.map((parts, i) => (
        <li key={i}>
          <Line parts={parts} />
        </li>
      ))}
    </ol>
  );
}

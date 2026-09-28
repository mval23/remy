import type { CookStep, Part } from '../planning/method';
import { duration } from '../planning/schedule';
import type { Lane } from '../planning/types';

const LANE_TAG: Record<Lane, string> = { hands: 'Hands-on', oven: 'Oven', stove: 'Stovetop', chill: 'Fridge/freezer' };

/** One instruction line, with amounts in bold. */
export function Line({ parts }: { parts: Part[] }) {
  return <>{parts.map((p, i) => (p.amount ? <b key={i}>{p.t}</b> : <span key={i}>{p.t}</span>))}</>;
}

/** Where the step happens and how long it takes. */
export function StepMeta({ step }: { step: Pick<CookStep, 'lane' | 'minutes' | 'temp'> }) {
  return (
    <span className="meta">
      <span className={`lane-tag lt-${step.lane}`}>{step.lane === 'oven' && step.temp ? `Oven ${step.temp}°C` : LANE_TAG[step.lane]}</span>
      <span className="mono hint">{duration(step.minutes)}</span>
    </span>
  );
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

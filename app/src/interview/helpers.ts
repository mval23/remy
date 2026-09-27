import type { Answers, Budget, Level, Preparations, Ratings } from './types';

export const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
export const str = (v: unknown): string => (typeof v === 'string' ? v : '');
export const has = (v: unknown, x: string): boolean => arr(v).includes(x);
export const hasAny = (v: unknown, xs: string[]): boolean => arr(v).some((x) => xs.includes(x));
/** Multi-select answers without the exclusive “None”. */
export const real = (v: unknown): string[] => arr(v).filter((x) => x !== 'None');

export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const asRatings = (v: unknown): Ratings => (isRecord(v) ? (v as Ratings) : {});
export const asPreparations = (v: unknown): Preparations => (isRecord(v) ? (v as Preparations) : {});
export const asBudget = (v: unknown): Budget | null =>
  isRecord(v) && 'currency' in v ? (v as unknown as Budget) : null;

export function allRatings(A: Answers): Ratings {
  return { ...asRatings(A.rateA), ...asRatings(A.rateB) };
}

export function ratedAs(A: Answers, level: Level): string[] {
  const r = allRatings(A);
  return Object.keys(r).filter((f) => r[f] === level);
}

export function listText(items: string[]): string {
  if (items.length < 2) return items.join('');
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}

export function money(amount: number, currency: string): string {
  const sym: Record<string, string> = { USD: '$', CAD: 'CA$', EUR: '€', GBP: '£', MXN: 'MX$', COP: 'COP $' };
  const n = Number(amount).toLocaleString('en-US');
  return sym[currency] ? sym[currency] + n : `${n} ${currency}`;
}

/** Toggle a value in a multi-select answer, keeping an exclusive “none” option exclusive. */
export function toggleOption(list: string[], value: string, none?: string): string[] {
  if (list.includes(value)) return list.filter((x) => x !== value);
  if (none && value === none) return [value];
  return [...list.filter((x) => x !== none), value];
}

export const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

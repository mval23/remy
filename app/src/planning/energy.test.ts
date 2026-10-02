import { describe, expect, it } from 'vitest';
import type { Answers } from '../interview/types';
import { emptyBody, energyTargets, type BodyProfile, type EnergyPlan } from './energy';

const body = (b: Partial<BodyProfile>): BodyProfile => ({ ...emptyBody(), consent: true, ...b });
const plan = (b: Partial<BodyProfile>, A: Answers = {}): EnergyPlan => {
  const r = energyTargets(body(b), A);
  if (!r.ok) throw new Error(r.reason);
  return r.plan;
};

describe('the daily estimate (worked examples from the audit, section 6)', () => {
  it('A: woman, 34, 165 cm, 78 kg, mostly sitting, steady', () => {
    const p = plan({ sex: 'female', ageYears: 34, heightCm: 165, weightKg: 78, pal: 1.35, pace: 'steady' });
    expect(p.ree).toBe(1480);
    expect(p.tdee).toBe(2000);
    expect(p.deficit).toBe(0.15);
    expect(p.floor).toBe(1500);
    expect(p.target).toBe(1700);
    expect(p.range).toEqual([1550, 1850]);
    expect(p.refKg).toBe(68);
    expect(p.proteinG).toBe(95);
    expect(p.fiberG).toBe(25);
    expect(p.fatMinG).toBe(40);
  });

  it('B: man, 45, 180 cm, 100 kg, active job, steady', () => {
    const p = plan({ sex: 'male', ageYears: 45, heightCm: 180, weightKg: 100, pal: 1.65, pace: 'steady' });
    expect(p.ree).toBe(1905);
    expect(p.tdee).toBe(3145);
    expect(p.floor).toBe(1900);
    expect(p.target).toBe(2650);
    expect(p.range).toEqual([2400, 2900]);
    expect(p.proteinG).toBe(115);
    expect(p.fiberG).toBe(37);
  });

  it('C: woman, 62, 158 cm, 58 kg, mostly sitting, gentle', () => {
    const p = plan({ sex: 'female', ageYears: 62, heightCm: 158, weightKg: 58, pal: 1.35, pace: 'gentle' });
    expect(p.ree).toBe(1095);
    expect(p.floor).toBe(1200);
    expect(p.target).toBe(1350);
    expect(p.range).toEqual([1200, 1500]);
    expect(p.proteinG).toBe(80);
  });
});

describe('limits and boundaries', () => {
  const A_ = { sex: 'female' as const, ageYears: 34, heightCm: 165, weightKg: 78, pal: 1.35, pace: 'steady' as const };

  it('caps the deficit at 500 kcal', () => {
    const p = plan({ ...A_, sex: 'male', weightKg: 140, heightCm: 195, pal: 1.8 });
    expect(p.tdee - p.target).toBeLessThanOrEqual(525);
  });

  it('never goes under the floor, and the floor is resting energy when that is higher', () => {
    const small = plan({ sex: 'female', ageYears: 70, heightCm: 150, weightKg: 52, pal: 1.35, pace: 'steady' });
    expect(small.target).toBe(small.floor);
    expect(small.floor).toBe(1200);
    const big = plan({ sex: 'male', ageYears: 25, heightCm: 200, weightKg: 130, pal: 1.35, pace: 'steady' });
    expect(big.floor).toBeGreaterThanOrEqual(big.ree - 25);
  });

  it('uses the average of both equations for “use the average”', () => {
    const f = plan({ ...A_, sex: 'female' }).ree;
    const m = plan({ ...A_, sex: 'male' }).ree;
    expect(plan({ ...A_, sex: 'average' }).ree).toBeCloseTo((f + m) / 2, -1);
  });

  it('keeps the pace gentle at 65 or older and under a BMI of 23', () => {
    expect(plan({ ...A_, ageYears: 66 }).deficit).toBe(0.1);
    expect(plan({ ...A_, weightKg: 60 }).deficit).toBe(0.1);
    expect(plan({ ...A_, ageYears: 66 }).notes.join(' ')).toContain('after 65');
    expect(plan({ ...A_ }, { age: '65 or older' }).deficit).toBe(0.1);
  });

  it('bases protein on actual weight up to a BMI of 25, capped at 160 g', () => {
    expect(plan({ ...A_, weightKg: 60 }).refKg).toBe(60);
    expect(plan({ ...A_, weightKg: 120 }).refKg).toBe(68);
    expect(plan({ sex: 'male', ageYears: 30, heightCm: 215, weightKg: 140, pal: 1.8, pace: 'steady' }).proteinG).toBe(160);
  });

  it('refuses when Remy shouldn’t estimate, and says why', () => {
    expect(energyTargets(body({ ...A_ }), { health: ['Pregnancy'] })).toMatchObject({ ok: false, why: 'refer' });
    expect(energyTargets(body({ ...A_ }), { health: ['Blood sugar or diabetes'] })).toMatchObject({ ok: false, why: 'clinician' });
    expect(energyTargets(body({ ...A_, ageYears: 16 }), {})).toMatchObject({ ok: false, why: 'age' });
    expect(energyTargets(body({ ...A_, weightKg: 48 }), {})).toMatchObject({ ok: false, why: 'underweight' });
    expect(energyTargets(body({ ...A_, heightCm: null }), {})).toMatchObject({ ok: false, why: 'incomplete' });
    expect(energyTargets(body({ ...A_, heightCm: 400 }), {})).toMatchObject({ ok: false, why: 'incomplete' });
  });

  it('leaves protein to a professional with kidney disease', () => {
    expect(plan({ ...A_ }, { health: ['Kidney disease'] }).proteinG).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { calcolaPercentuale } from '@/lib/calcola-percentuale';

describe('calcolaPercentuale', () => {
  it('returns 100 when stato is done', () => {
    expect(calcolaPercentuale(10, 0, 'done')).toBe(100);
    expect(calcolaPercentuale(10, 1000, 'done')).toBe(100);
  });

  it('returns null when oreStimate <= 0', () => {
    expect(calcolaPercentuale(0, 5, 'in_progress')).toBeNull();
    expect(calcolaPercentuale(-5, 5, 'in_progress')).toBeNull();
  });

  it('returns 0 when oreConsuntivate is 0 and oreStimate is valid', () => {
    expect(calcolaPercentuale(10, 0, 'in_progress')).toBe(0);
  });

  it('calculates normal percentage (3 on 10 -> 30)', () => {
    expect(calcolaPercentuale(10, 3, 'in_progress')).toBe(30);
  });

  it('caps at 95 when hours exceed estimate', () => {
    expect(calcolaPercentuale(10, 20, 'in_progress')).toBe(95);
    expect(calcolaPercentuale(10, 200, 'in_progress')).toBe(95);
  });

  it('rounds to multiples of 5 (1.2 -> 10, 1.3 -> 15)', () => {
    expect(calcolaPercentuale(10, 1.2, 'in_progress')).toBe(10);
    expect(calcolaPercentuale(10, 1.3, 'in_progress')).toBe(15);
    expect(calcolaPercentuale(10, 3, 'in_progress')).toBe(30);
  });

  it('for in_progress or review with ore >= stima returns 95 (never 100 unless done)', () => {
    expect(calcolaPercentuale(10, 10, 'in_progress')).toBe(95);
    expect(calcolaPercentuale(10, 11, 'review')).toBe(95);
  });
});

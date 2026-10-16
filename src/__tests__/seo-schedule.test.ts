import { describe, expect, it } from 'vitest';
import { isFirstWeekOfMonth } from '@/lib/seo/schedule';

describe('isFirstWeekOfMonth', () => {
  it('acepta los días 1 a 7', () => {
    expect(isFirstWeekOfMonth(new Date('2026-06-01T15:00:00Z'))).toBe(true);
    expect(isFirstWeekOfMonth(new Date('2026-06-07T15:00:00Z'))).toBe(true);
  });

  it('rechaza el resto del mes', () => {
    expect(isFirstWeekOfMonth(new Date('2026-06-08T15:00:00Z'))).toBe(false);
    expect(isFirstWeekOfMonth(new Date('2026-06-29T15:00:00Z'))).toBe(false);
  });

  it('usa la zona horaria indicada, no la del servidor', () => {
    // 2026-07-01 02:00 UTC sigue siendo 30 de junio en Santo Domingo (UTC-4).
    const lateJune = new Date('2026-07-01T02:00:00Z');
    expect(isFirstWeekOfMonth(lateJune, 'America/Santo_Domingo')).toBe(false);
    expect(isFirstWeekOfMonth(lateJune, 'UTC')).toBe(true);
  });

  it('un lunes de cada mes pasa el filtro y los demás no', () => {
    const mondays = ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'];
    const passing = mondays.filter((day) => isFirstWeekOfMonth(new Date(`${day}T15:00:00Z`)));
    expect(passing).toEqual(['2026-06-01']);
  });
});

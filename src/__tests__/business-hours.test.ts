import { describe, it, expect } from 'vitest';
import {
  calculateBusinessHoursDeadline,
  calculateProductionDeadline,
  calculateStagingReviewDeadline,
  getRemainingBusinessHours,
  formatDeadlineForClient,
} from '@/lib/sla/business-hours';

// RD = UTC-4, así que 9 AM RD = 13:00 UTC, 18:00 RD = 22:00 UTC
// Lunes 2026-03-30 a las 9:00 AM RD = 13:00 UTC
const MON_9AM_RD = new Date('2026-03-30T13:00:00Z');

// Viernes 2026-04-24 a las 17:00 RD = 21:00 UTC
const FRI_5PM_RD = new Date('2026-04-24T21:00:00Z');

describe('calculateBusinessHoursDeadline', () => {
  it('1 hora hábil desde 9 AM lunes → 10 AM RD', () => {
    const deadline = calculateBusinessHoursDeadline(MON_9AM_RD, 1); // +4 → a hora RD
    // 9 AM + 1h hábil = 10 AM RD = 14:00 UTC
    expect(deadline.getTime()).toBeGreaterThan(MON_9AM_RD.getTime());
    expect(deadline.getTime()).toBeLessThanOrEqual(
      new Date('2026-03-30T14:05:00Z').getTime()
    );
  });

  it('9 horas hábiles (1 día completo) desde 9 AM lunes → no antes del lunes 18:00 RD', () => {
    const deadline = calculateBusinessHoursDeadline(MON_9AM_RD, 9);
    // 9 AM + 9h hábiles en el mismo día = 18:00 RD = 22:00 UTC
    expect(deadline.getTime()).toBeGreaterThanOrEqual(
      new Date('2026-03-30T22:00:00Z').getTime()
    );
  });

  it('0 horas → retorna prácticamente el mismo tiempo', () => {
    const deadline = calculateBusinessHoursDeadline(MON_9AM_RD, 0);
    expect(deadline.getTime()).toBeCloseTo(MON_9AM_RD.getTime(), -3);
  });

  it('desde fuera del horario hábil, el tiempo avanza hasta el primer minuto hábil', () => {
    // Domingo 2026-03-29 12:00 UTC (8 AM RD) — antes de horario hábil
    const sun = new Date('2026-03-29T12:00:00Z');
    const deadline = calculateBusinessHoursDeadline(sun, 1);
    // Debe saltar a lunes 9 AM RD y sumar 1h → lunes 10 AM RD = 14:00 UTC
    expect(deadline.getTime()).toBeGreaterThan(new Date('2026-03-30T13:00:00Z').getTime());
  });
});

describe('calculateProductionDeadline — 72h hábiles', () => {
  it('deadline es después de startAt', () => {
    const deadline = calculateProductionDeadline(MON_9AM_RD);
    expect(deadline.getTime()).toBeGreaterThan(MON_9AM_RD.getTime());
  });

  it('72h hábiles ≈ 8 días de calendario (con weekends)', () => {
    const deadline = calculateProductionDeadline(MON_9AM_RD);
    const diffDays = (deadline.getTime() - MON_9AM_RD.getTime()) / (1000 * 60 * 60 * 24);
    // 72h hábiles a partir de lunes 9 AM = ~10 días calendario
    expect(diffDays).toBeGreaterThanOrEqual(7);
    expect(diffDays).toBeLessThanOrEqual(14);
  });

  it('deadline desde viernes 5 PM salta el fin de semana', () => {
    const deadline = calculateProductionDeadline(FRI_5PM_RD);
    // Empezar viernes 5 PM → el fin de semana no cuenta → deadline debe ser mucho después
    const diffMs = deadline.getTime() - FRI_5PM_RD.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThanOrEqual(10); // Al menos 10 días por incluir el fin de semana
  });

  it('Semana Santa (feriados) se excluyen del cálculo', () => {
    // Empezar el lunes 30 de marzo → el deadline cruza los feriados Apr 2-3 (Semana Santa)
    // → el deadline real en días de calendario debe ser mayor que 72h / 9h_por_día ≈ 8 días
    const deadline = calculateProductionDeadline(MON_9AM_RD);
    const days = (deadline.getTime() - MON_9AM_RD.getTime()) / (1000 * 60 * 60 * 24);
    // Sin feriados: 72h / 9h = 8 días hábiles ≈ 10-11 días calendario (con fin de semana)
    // Con Semana Santa: 2 feriados más → ≥ 12 días calendario
    expect(days).toBeGreaterThanOrEqual(12);
  });
});

describe('calculateStagingReviewDeadline', () => {
  it('es igual a calculateProductionDeadline (ambas 72h)', () => {
    const prod = calculateProductionDeadline(MON_9AM_RD);
    const staging = calculateStagingReviewDeadline(MON_9AM_RD);
    expect(staging.getTime()).toBe(prod.getTime());
  });
});

describe('getRemainingBusinessHours', () => {
  it('deadline ya pasado → 0', () => {
    const past = new Date(MON_9AM_RD.getTime() - 1000);
    expect(getRemainingBusinessHours(MON_9AM_RD, past)).toBe(0);
  });

  it('deadline exactamente ahora → 0', () => {
    expect(getRemainingBusinessHours(MON_9AM_RD, MON_9AM_RD)).toBe(0);
  });

  it('1 hora hábil restante → ~1', () => {
    // Deadline = 10 AM RD, now = 9 AM RD
    const now = MON_9AM_RD;
    const deadline = new Date(MON_9AM_RD.getTime() + 60 * 60 * 1000 + 1000);
    const remaining = getRemainingBusinessHours(now, deadline);
    expect(remaining).toBe(1);
  });
});

describe('formatDeadlineForClient', () => {
  it('retorna string no vacío', () => {
    const formatted = formatDeadlineForClient(MON_9AM_RD);
    expect(typeof formatted).toBe('string');
    expect(formatted.length).toBeGreaterThan(5);
  });

  it('contiene el número del día', () => {
    const formatted = formatDeadlineForClient(MON_9AM_RD);
    // Lunes 30 de marzo
    expect(formatted).toMatch(/30/);
  });
});

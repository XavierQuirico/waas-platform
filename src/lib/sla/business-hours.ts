// ============================================================
// Motor de Tiempo Hábil — WaaS 72h Engine
// Horario: Lunes–Viernes, 9:00–18:00 RD time (UTC-4)
// Excluye: fines de semana + feriados dominicanos
// ============================================================

// ─── Feriados oficiales República Dominicana 2026 ─────────
// Fuente: Ministerio de Trabajo RD
// Usado como fallback cuando no se pasan holidays desde BD.
const DOMINICAN_HOLIDAYS_2026: string[] = [
  '2026-01-01', // Año Nuevo
  '2026-01-06', // Día de Reyes (Epifanía)
  '2026-01-21', // Día de la Altagracia
  '2026-01-26', // Duarte (lunes próximo por ser domingo)
  '2026-02-27', // Día de la Independencia
  '2026-04-02', // Jueves Santo
  '2026-04-03', // Viernes Santo
  '2026-05-01', // Día del Trabajo
  '2026-06-11', // Corpus Christi
  '2026-08-16', // Restauración de la República
  '2026-09-24', // Día de las Mercedes
  '2026-11-06', // Constitución
  '2026-11-10', // Constitución (lunes)
  '2026-12-25', // Navidad
];

// ─── Constantes ───────────────────────────────────────────
const RD_TIMEZONE_OFFSET_HOURS = -4; // UTC-4
const BUSINESS_START_HOUR = 9;       // 9:00 AM RD
const BUSINESS_END_HOUR = 18;        // 6:00 PM RD

/**
 * Convierte una fecha UTC a hora RD (UTC-4).
 */
function toRDTime(date: Date): Date {
  const rdMs = date.getTime() + RD_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000;
  return new Date(rdMs);
}

/**
 * Formatea una fecha como 'YYYY-MM-DD' en hora RD para comparar con holidays.
 */
function toDateString(rdDate: Date): string {
  const year = rdDate.getUTCFullYear();
  const month = String(rdDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(rdDate.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Determina si una fecha (en hora RD) es un día hábil.
 * @param rdDate - Fecha en hora RD
 * @param holidayStrings - Lista de fechas feriado como 'YYYY-MM-DD'. Si se omite usa DOMINICAN_HOLIDAYS_2026.
 */
function isBusinessDay(rdDate: Date, holidayStrings?: string[]): boolean {
  const dayOfWeek = rdDate.getUTCDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  if (dayOfWeek === 0 || dayOfWeek === 6) return false; // Fin de semana

  const dateStr = toDateString(rdDate);
  const holidays = holidayStrings ?? DOMINICAN_HOLIDAYS_2026;
  if (holidays.includes(dateStr)) return false;

  return true;
}

/**
 * Calcula el deadline sumando `businessHours` horas hábiles a partir de `startAt`.
 *
 * Algoritmo: avanza minuto a minuto contando solo horas dentro del horario hábil.
 * Nota: para escala actual (operador único, pocas docenas de proyectos) este
 * enfoque es suficiente. Si el volumen escala, reemplazar con cálculo por bloques.
 *
 * @param startAt - Fecha UTC de inicio
 * @param businessHours - Horas hábiles a sumar (ej: 72)
 * @param holidays - Lista opcional de fechas feriado desde BD. Si se omite usa DOMINICAN_HOLIDAYS_2026.
 * @returns Fecha UTC del deadline
 */
export function calculateBusinessHoursDeadline(
  startAt: Date,
  businessHours: number,
  holidays?: Date[]
): Date {
  const holidayStrings = holidays?.map((d) => toDateString(toRDTime(d)));

  let current = new Date(startAt);
  let remainingMinutes = businessHours * 60;

  while (remainingMinutes > 0) {
    current = new Date(current.getTime() + 60 * 1000); // +1 minuto

    const rdTime = toRDTime(current);
    const hourRD = rdTime.getUTCHours();

    if (
      isBusinessDay(rdTime, holidayStrings) &&
      hourRD >= BUSINESS_START_HOUR &&
      hourRD < BUSINESS_END_HOUR
    ) {
      remainingMinutes--;
    }
  }

  return current;
}

/**
 * Calcula el deadline de producción (72h hábiles).
 * @param holidays - Lista opcional de fechas feriado desde BD.
 */
export function calculateProductionDeadline(startAt: Date, holidays?: Date[]): Date {
  return calculateBusinessHoursDeadline(startAt, 72, holidays);
}

/**
 * Calcula el deadline de revisión de staging (72h hábiles).
 * @param holidays - Lista opcional de fechas feriado desde BD.
 */
export function calculateStagingReviewDeadline(startAt: Date, holidays?: Date[]): Date {
  return calculateBusinessHoursDeadline(startAt, 72, holidays);
}

/**
 * Calcula cuántas horas hábiles quedan hasta un deadline.
 * Retorna 0 si el deadline ya pasó.
 * @param holidays - Lista opcional de fechas feriado desde BD.
 */
export function getRemainingBusinessHours(now: Date, deadline: Date, holidays?: Date[]): number {
  if (now >= deadline) return 0;

  const holidayStrings = holidays?.map((d) => toDateString(toRDTime(d)));

  let current = new Date(now);
  let count = 0;

  while (current < deadline) {
    current = new Date(current.getTime() + 60 * 1000);

    const rdTime = toRDTime(current);
    const hourRD = rdTime.getUTCHours();

    if (
      isBusinessDay(rdTime, holidayStrings) &&
      hourRD >= BUSINESS_START_HOUR &&
      hourRD < BUSINESS_END_HOUR
    ) {
      count++;
    }
  }

  return Math.round(count / 60); // minutos → horas
}

/**
 * Consulta la tabla `holidays_rd` en Drizzle y retorna las fechas como Date[].
 * Los callers en el router deben invocar esta función y pasar el resultado
 * a calculateProductionDeadline, calculateStagingReviewDeadline, etc.
 */
export async function getHolidaysFromDB(): Promise<Date[]> {
  // Importación diferida para evitar dependencia circular en tests unitarios
  const { db } = await import('@/db');
  const { holidaysRd } = await import('@/db/schema/holidays-rd');

  const rows = await db.select({ date: holidaysRd.date }).from(holidaysRd);
  // La columna `date` es tipo string 'YYYY-MM-DD' en Drizzle (pg date column)
  return rows.map((r) => new Date(r.date));
}

/**
 * Formatea una fecha de deadline para mostrar al cliente.
 * Ej: "viernes 27 de marzo"
 */
export function formatDeadlineForClient(deadline: Date): string {
  const rdDate = toRDTime(deadline);
  return rdDate.toLocaleDateString('es-DO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

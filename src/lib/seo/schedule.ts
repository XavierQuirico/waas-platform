/**
 * Indica si una fecha cae en la primera semana del mes (días 1 a 7) en la zona horaria dada.
 *
 * Se usa para el informe SEO mensual: la expresión cron "0 10 1-7 * 1" NO significa
 * "primer lunes del mes", sino "días 1-7 O cualquier lunes" (cuando el día del mes y el
 * día de la semana están restringidos, cron los combina con OR). Por eso la función se
 * dispara todos los lunes y esta comprobación deja pasar solo el primero.
 */
export function isFirstWeekOfMonth(date: Date, timeZone = 'America/Santo_Domingo'): boolean {
  const day = Number(new Intl.DateTimeFormat('en-US', { timeZone, day: 'numeric' }).format(date));
  return day >= 1 && day <= 7;
}

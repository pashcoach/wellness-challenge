export const TESTING_MODE_END_DATE = "2026-09-01";

/** Calendar date in Saskatchewan (UTC-6 year-round), formatted YYYY-MM-DD. */
export function reginaDateIso(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Regina",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function isTestingModeActive(configured: boolean, dateIso = reginaDateIso()): boolean {
  return configured && dateIso < TESTING_MODE_END_DATE;
}

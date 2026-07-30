// src/utils/nptTime.js
// Single source of truth for Nepal-time (Asia/Kathmandu, UTC+5:45) date-boundary logic.
// Use this everywhere in the store package instead of setHours()/getFullYear()/Date.UTC() directly.

export const NPT_OFFSET_MS = 5 * 60 * 60 * 1000 + 45 * 60 * 1000; // UTC+5:45

export function nowNPT() {
  return new Date(Date.now() + NPT_OFFSET_MS);
}

// Start of "today" (Nepal calendar day), returned as the equivalent UTC instant.
export function todayStartUTC() {
  const npt = nowNPT();
  return new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate(), 0, 0, 0, 0) - NPT_OFFSET_MS
  );
}

export function monthStartUTC() {
  const npt = nowNPT();
  return new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), 1, 0, 0, 0, 0) - NPT_OFFSET_MS
  );
}

export function daysAgoStartUTC(days) {
  const npt = nowNPT();
  const d = new Date(npt.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0) - NPT_OFFSET_MS
  );
}

// Given ANY JS Date, return the UTC instant for 00:00:00.000 Nepal-time
// on the Nepal calendar day that date falls on. Drop-in replacement for
// `x.setHours(0,0,0,0)`.
export function startOfDayNPT(d) {
  const npt = new Date(d.getTime() + NPT_OFFSET_MS);
  return new Date(
    Date.UTC(npt.getUTCFullYear(), npt.getUTCMonth(), npt.getUTCDate(), 0, 0, 0, 0) - NPT_OFFSET_MS
  );
}

// Same, but 23:59:59.999 Nepal-time. Drop-in replacement for `x.setHours(23,59,59,999)`.
export function endOfDayNPT(d) {
  return new Date(startOfDayNPT(d).getTime() + 24 * 60 * 60 * 1000 - 1);
}

// Parse a "YYYY-MM-DD" string as meaning that calendar date IN NEPAL TIME,
// return the UTC instant for its start (00:00:00.000 NPT).
export function parseNPTDateStart(dateStr) {
  const [y, m, d] = String(dateStr).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - NPT_OFFSET_MS);
}

// Same, but end of that Nepal calendar day (23:59:59.999 NPT).
export function parseNPTDateEnd(dateStr) {
  return new Date(parseNPTDateStart(dateStr).getTime() + 24 * 60 * 60 * 1000 - 1);
}
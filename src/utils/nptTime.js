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

// Format any JS Date (or date-like value) as an ISO-8601 string reflecting
// Nepal wall-clock time, with a "+05:45" offset instead of "Z". Use this
// wherever a timestamp is being put into an API response, instead of
// letting res.json() serialize the raw UTC Date via .toISOString().
export function toNPTISOString(value) {
  if (!value) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const npt = new Date(date.getTime() + NPT_OFFSET_MS);
  const pad = (n, len = 2) => String(n).padStart(len, "0");

  return (
    `${npt.getUTCFullYear()}-${pad(npt.getUTCMonth() + 1)}-${pad(npt.getUTCDate())}` +
    `T${pad(npt.getUTCHours())}:${pad(npt.getUTCMinutes())}:${pad(npt.getUTCSeconds())}` +
    `.${pad(npt.getUTCMilliseconds(), 3)}+05:45`
  );
}
// src/lib/ntpTime.js
// Pure time-formatting helpers for the NTP status card (Time.svelte).
// Kept out of the component so the edge cases (0s, >1h, null) are unit-testable.

/**
 * Milliseconds remaining until the next NTP event (sync or retry), adjusted
 * for time elapsed since the status was fetched. NaN/null-safe.
 * @param {number|null|undefined} nextMs - ms until the event at fetch time
 * @param {number} elapsedMs - ms elapsed since the status was fetched
 * @returns {number|null} clamped remaining ms, or null when unknown
 */
export function remainingMs(nextMs, elapsedMs) {
  if (nextMs == null) return null
  return Math.max(0, nextMs - elapsedMs)
}

/**
 * Human-readable "time ago" for a unix-seconds timestamp.
 * @param {number|null|undefined} unixTs - event time in unix seconds
 * @param {number} nowMs - current time in ms
 * @returns {string|null} e.g. "5s ago", "3m 20s ago", "1h 4m ago", or null
 */
export function fmtAgo(unixTs, nowMs) {
  if (!unixTs) return null
  const s = Math.max(0, Math.floor(nowMs / 1000) - unixTs)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`
}

/**
 * Human-readable countdown for a millisecond duration.
 * @param {number|null|undefined} ms
 * @returns {string} e.g. "5s", "3m 20s", "1h 4m", or "—" when null/elapsed
 */
export function fmtCountdown(ms) {
  if (ms == null) return '—'
  const s = Math.ceil(ms / 1000)
  if (s <= 0)   return '—'
  if (s < 60)   return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

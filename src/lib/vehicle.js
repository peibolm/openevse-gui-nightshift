/** Pure vehicle-data helpers shared by the dashboard and monitoring views. */

/** Interpret an HA plugged-in value (bool, 0/1, or "on"/"off"/"true"/"false") as a boolean. */
export function isPlugged(v) {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return ['true', 'on', '1', 'yes'].includes(v.trim().toLowerCase())
  return false
}

/**
 * Plug state for gating the SoC-limit UI and its enforcement.
 *
 * Returns true/false when the device reports `vehicle_plugged`, or `null` when
 * it's unknown (HA plugged entity not configured). Callers preserve their prior
 * behavior on `null` rather than treating "unknown" as "unplugged" — only an
 * explicit `false` should hide the SoC UI or disarm enforcement.
 */
export function plugState(status) {
  const v = status?.vehicle_plugged
  if (v === undefined || v === null) return null
  return isPlugged(v)
}

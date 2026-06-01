// src/lib/config/homeassistant.js
// Home Assistant connection helpers.
import { httpAPI } from '../api/httpAPI.js'

export function isHaConnected(status) {
  return !!(status && status.connected)
}

// Full browser navigation so HA's login page + redirect chain run in the
// real browser (not via fetch). In dev, httpAPI prefixes /api; for a top-level
// navigation we hit the firmware path directly.
export function startHaAuth() {
  const base = import.meta.env.DEV ? '/api' : ''
  window.location.href = base + '/ha/auth/start'
}

export async function fetchHaStatus() {
  const res = await httpAPI('GET', '/ha/status')
  return res && res !== 'error' ? res : null
}

export async function disconnectHa() {
  const res = await httpAPI('POST', '/ha/disconnect')
  return res && (res.msg === 'done')
}

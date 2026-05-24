// Pure math for the pull-to-refresh gesture. Separated from the Svelte
// wrapper so it can be unit-tested without touching the DOM.

// Past this many pixels of pulled distance, the refresh fires on release.
export const PULL_THRESHOLD_PX = 70
// Cap how far the indicator can travel — beyond this it stops following
// the finger 1:1 (RESIST_FACTOR makes the drag feel rubbery).
export const PULL_MAX_PX = 120
const RESIST_FACTOR = 0.5

/**
 * Translate raw touch distance into displacement + an "armed" flag the
 * caller uses to decide whether to fire the refresh on release.
 *
 * Returns 0 displacement (and armed=false) for any pull that isn't
 * downward, so the wrapper never blocks an upward scroll.
 */
export function computePull(startY, currentY) {
  const raw = currentY - startY
  if (raw <= 0) return { displacement: 0, armed: false }
  const displacement = Math.min(raw * RESIST_FACTOR, PULL_MAX_PX)
  return { displacement, armed: displacement >= PULL_THRESHOLD_PX }
}

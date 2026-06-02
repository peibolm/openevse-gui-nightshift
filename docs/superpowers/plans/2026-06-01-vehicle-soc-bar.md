# Vehicle SOC Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an evcc-style vehicle State-of-Charge bar to the Dashboard that shows live SOC, lets the user drag a target to set OpenEVSE's soc charge limit, and shows the vehicle's own charge limit as a read-only cap.

**Architecture:** A pure helper module (`src/lib/dashboard/soc.js`) computes bar geometry and cap logic; a presentational component (`VehicleSocBar.svelte`) renders the bar and emits `onchange`/`onclear`; `Dashboard.svelte` wires the stores (status + limit) to it, exactly as it does for `ChargeRate`/`ChargeLimitCard`. The bar owns the soc-limit path, so the existing modal drops its soc option and the limit card hides while an soc limit is active.

**Tech Stack:** Svelte 5 (runes: `$props`, `$state`, `$derived`, `$effect`), Tailwind 4 (project tokens `surface-2/3`, `accent`, `text`/`text-dim`, `border`, `error`), Vitest + @testing-library/svelte, svelte-i18n.

**Design spec:** `docs/superpowers/specs/2026-06-01-vehicle-soc-bar-design.md`

**Conventions (read once):**
- Tests live in `__tests__/` folders next to the code. Coverage is scoped to `src/lib/**/*.js`.
- Component tests mock svelte-i18n so `$_('a.b.c')` returns the literal key `'a.b.c'` (see existing `ChargeRate.test.js`).
- Run a single file: `npx vitest run <path>`. Run all: `npm test`.
- Commit per task. End every commit message with:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- Svelte 4-era stores via `$`, runes for component-local reactivity. No Svelte 4 syntax.

---

### Task 1: Pure helper module `soc.js`

**Files:**
- Create: `src/lib/dashboard/soc.js`
- Test: `src/lib/dashboard/__tests__/soc.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/dashboard/__tests__/soc.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { restingTarget, isCapped, effectiveStop, socBarSegments, hmsShort } from '../soc.js'

describe('restingTarget', () => {
  it('uses the vehicle limit when known', () => {
    expect(restingTarget(75)).toBe(75)
  })
  it('falls back to 80 when the vehicle limit is unknown', () => {
    expect(restingTarget(null)).toBe(80)
    expect(restingTarget(undefined)).toBe(80)
    expect(restingTarget(NaN)).toBe(80)
  })
})

describe('isCapped', () => {
  it('is true only when the target is above a known vehicle limit', () => {
    expect(isCapped(80, 75)).toBe(true)
    expect(isCapped(75, 75)).toBe(false)
    expect(isCapped(70, 75)).toBe(false)
    expect(isCapped(80, null)).toBe(false)
  })
})

describe('effectiveStop', () => {
  it('is the lower of target and vehicle limit', () => {
    expect(effectiveStop(80, 75)).toBe(75)
    expect(effectiveStop(70, 75)).toBe(70)
  })
  it('is the target when the vehicle limit is unknown', () => {
    expect(effectiveStop(80, null)).toBe(80)
  })
})

describe('socBarSegments', () => {
  it('fills to SOC and runs the zone up to the effective stop', () => {
    expect(socBarSegments({ soc: 74, target: 80, vehicleLimit: 90 }))
      .toEqual({ fillPct: 74, zoneEndPct: 80, hatchStartPct: 90, hatchEndPct: 80 })
  })
  it('clamps the zone to the vehicle limit when capped', () => {
    expect(socBarSegments({ soc: 74, target: 80, vehicleLimit: 75 }))
      .toEqual({ fillPct: 74, zoneEndPct: 75, hatchStartPct: 75, hatchEndPct: 80 })
  })
  it('never runs the zone below the current SOC', () => {
    expect(socBarSegments({ soc: 74, target: 60, vehicleLimit: 90 }).zoneEndPct).toBe(74)
  })
  it('clamps inputs to 0..100', () => {
    const s = socBarSegments({ soc: 120, target: -5, vehicleLimit: 200 })
    expect(s.fillPct).toBe(100)
    expect(s.hatchEndPct).toBe(0)
  })
})

describe('hmsShort', () => {
  it('formats hours and minutes', () => {
    expect(hmsShort(4500)).toBe('1h 15m')
  })
  it('formats minutes only under an hour', () => {
    expect(hmsShort(600)).toBe('10m')
  })
  it('rolls 60 rounded minutes up to the next hour', () => {
    expect(hmsShort(3570)).toBe('1h 0m')
  })
  it('returns empty for zero or invalid input', () => {
    expect(hmsShort(0)).toBe('')
    expect(hmsShort(-1)).toBe('')
    expect(hmsShort(NaN)).toBe('')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/dashboard/__tests__/soc.test.js`
Expected: FAIL — "Failed to resolve import '../soc.js'" / functions not defined.

- [ ] **Step 3: Write the implementation**

Create `src/lib/dashboard/soc.js`:

```js
/** Pure helpers for the Vehicle SOC bar. No store or DOM access — fully unit-tested. */

/** Clamp a value to 0..100; non-finite becomes 0. */
function clampPct(n) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/** Resting knob position when no soc limit is set: the vehicle limit, or 80 if unknown. */
export function restingTarget(vehicleLimit) {
  return Number.isFinite(vehicleLimit) ? clampPct(vehicleLimit) : 80
}

/** True when the target sits above the vehicle's own limit (a hard ceiling). */
export function isCapped(target, vehicleLimit) {
  return Number.isFinite(vehicleLimit) && target > vehicleLimit
}

/** Where charging actually stops: min(target, vehicleLimit) when the limit is known. */
export function effectiveStop(target, vehicleLimit) {
  return Number.isFinite(vehicleLimit) ? Math.min(target, vehicleLimit) : target
}

/**
 * Bar geometry as 0..100 percentages.
 *  fillPct       solid SOC fill
 *  zoneEndPct    end of the lighter "will charge to" zone (= effective stop, never below SOC)
 *  hatchStartPct unreachable-region start (vehicle limit) — only meaningful when capped
 *  hatchEndPct   unreachable-region end (target) — only meaningful when capped
 */
export function socBarSegments({ soc, target, vehicleLimit }) {
  const s = clampPct(soc)
  const t = clampPct(target)
  const eff = clampPct(effectiveStop(t, vehicleLimit))
  return {
    fillPct: s,
    zoneEndPct: Math.max(s, eff),
    hatchStartPct: clampPct(vehicleLimit),
    hatchEndPct: t,
  }
}

/** Short H/M duration: 4500 -> "1h 15m", 600 -> "10m", 0/invalid -> "". */
export function hmsShort(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return ''
  let h = Math.floor(sec / 3600)
  let m = Math.round((sec % 3600) / 60)
  if (m === 60) {
    h += 1
    m = 0
  }
  return h ? `${h}h ${m}m` : `${m}m`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/dashboard/__tests__/soc.test.js`
Expected: PASS (5 describe blocks, all green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/soc.js src/lib/dashboard/__tests__/soc.test.js
git commit -m "feat(soc): pure helpers for the vehicle SOC bar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `VehicleSocBar.svelte` presentational component

**Files:**
- Create: `src/lib/components/dashboard/VehicleSocBar.svelte`
- Test: `src/lib/components/dashboard/__tests__/VehicleSocBar.test.js`

**Context:** Presentational only — no store imports. Mirrors `ChargeRate.svelte`'s prop/event shape. The drag control is a transparent native `<input type="range">` overlaying the bar (keyboard-accessible and testable via `getByRole('slider')`, exactly like `ChargeRate`'s `Slider`). It carries an `aria-label` so the Dashboard's two sliders can be told apart by accessible name. Icon import path matches `ChargeLimitCard.svelte`: `'../../icons/Icon.svelte'`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/dashboard/__tests__/VehicleSocBar.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import VehicleSocBar from '../VehicleSocBar.svelte'

const base = { soc: 74, vehicleLimit: 90, target: 80, charging: true }

describe('VehicleSocBar', () => {
  it('shows the current SOC percentage', () => {
    const { getByText } = render(VehicleSocBar, { props: { ...base } })
    expect(getByText('74%')).toBeInTheDocument()
  })

  it('emits onchange with the committed target on change', async () => {
    const onchange = vi.fn()
    const { getByRole } = render(VehicleSocBar, { props: { ...base, onchange } })
    const input = getByRole('slider')
    input.value = '65'
    await fireEvent.change(input)
    expect(onchange).toHaveBeenCalledWith(65)
  })

  it('shows the cap note only when the target is above the vehicle limit', async () => {
    const capped = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 75, target: 80 } })
    expect(capped.getByText('dashboard.vehicle.cap_note')).toBeInTheDocument()

    const normal = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: 90, target: 80 } })
    expect(normal.queryByText('dashboard.vehicle.cap_note')).not.toBeInTheDocument()
  })

  it('shows the clear control and calls onclear only when a limit is active', async () => {
    const onclear = vi.fn()
    const active = render(VehicleSocBar, { props: { ...base, limitActive: true, onclear } })
    await fireEvent.click(active.getByLabelText('dashboard.vehicle.clear'))
    expect(onclear).toHaveBeenCalledOnce()

    const inactive = render(VehicleSocBar, { props: { ...base, limitActive: false } })
    expect(inactive.queryByLabelText('dashboard.vehicle.clear')).not.toBeInTheDocument()
  })

  it('omits the vehicle-limit marker when the limit is unknown', () => {
    const { queryByText } = render(VehicleSocBar, { props: { soc: 74, vehicleLimit: null, target: 80 } })
    expect(queryByText('dashboard.vehicle.vehicle_limit')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/components/dashboard/__tests__/VehicleSocBar.test.js`
Expected: FAIL — cannot resolve `../VehicleSocBar.svelte`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/components/dashboard/VehicleSocBar.svelte`:

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'
  import { socBarSegments, isCapped, hmsShort } from '../../dashboard/soc.js'

  let {
    soc = 0,
    vehicleLimit = null,
    target = 80,
    range = null,
    rangeMiles = false,
    timeToFull = 0,
    charging = false,
    limitActive = false,
    disabled = false,
    onchange = () => {},
    onclear = () => {},
  } = $props()

  // Live position during a drag; resyncs whenever the committed target changes.
  let current = $state(target)
  $effect(() => {
    current = target
  })

  function handleInput(e) {
    current = Number(e.currentTarget.value)
  }
  function handleChange(e) {
    onchange(Number(e.currentTarget.value))
  }

  let seg = $derived(socBarSegments({ soc, target: current, vehicleLimit }))
  let capped = $derived(isCapped(current, vehicleLimit))
  let toFull = $derived(charging ? hmsShort(timeToFull) : '')
  let rangeUnit = $derived(rangeMiles ? $_('units.miles') : $_('units.km'))
  // The target line is dimmed when it's not an active limit, or when capped.
  let dim = $derived(!limitActive || capped)
</script>

<div class="mt-3 rounded-xl bg-surface-2 px-3 py-3">
  <!-- header -->
  <div class="mb-7 flex items-baseline justify-between">
    <span class="text-[8px] tracking-wide text-text-dim uppercase">{$_('dashboard.vehicle.label')}</span>
    <span class="text-xs text-text">
      {#if range != null}{range}&nbsp;{rangeUnit} · {/if}{$_('dashboard.vehicle.charging_to', {
        values: { pct: Math.round(seg.zoneEndPct) },
      })}{#if toFull} · {$_('dashboard.vehicle.to_full', { values: { time: toFull } })}{/if}
    </span>
  </div>

  <!-- bar -->
  <div class="relative h-[34px]">
    <!-- track -->
    <div class="absolute inset-0 rounded-full bg-surface-3"></div>
    <!-- SOC fill: rounded left, flat right -->
    <div
      class="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-accent to-cyan-400"
      style="width: {seg.fillPct}%"
    ></div>
    <!-- "will charge to" zone -->
    {#if seg.zoneEndPct > seg.fillPct}
      <div
        class="absolute inset-y-0 bg-accent/30"
        style="left: {seg.fillPct}%; width: {seg.zoneEndPct - seg.fillPct}%"
      ></div>
    {/if}
    <!-- unreachable region when capped -->
    {#if capped}
      <div
        class="absolute inset-y-0"
        style="left: {seg.hatchStartPct}%; width: {seg.hatchEndPct - seg.hatchStartPct}%;
               background: repeating-linear-gradient(45deg, rgba(251,191,36,.10) 0 4px, transparent 4px 8px)"
      ></div>
    {/if}
    <!-- SOC % label inside the fill -->
    <div class="absolute left-3 top-1/2 -translate-y-1/2 text-[15px] font-bold text-[#04121d]">
      {Math.round(soc)}%
    </div>

    <!-- vehicle-limit marker: thin amber line, label below -->
    {#if vehicleLimit != null}
      <div class="absolute -top-1.5 -bottom-6 w-0" style="left: {vehicleLimit}%">
        <div class="absolute left-1/2 top-0 bottom-[18px] w-0.5 -translate-x-1/2 bg-amber-400"></div>
        <div class="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-amber-400">
          {$_('dashboard.vehicle.vehicle_limit', { values: { pct: Math.round(vehicleLimit) } })}
        </div>
      </div>
    {/if}

    <!-- target: wide white line, bubble label above -->
    <div class="absolute -top-[34px] -bottom-2 w-0" style="left: {current}%; opacity: {dim ? 0.55 : 1}">
      <div class="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-text">
        {$_('dashboard.vehicle.target', { values: { pct: Math.round(current) } })}
      </div>
      <div class="absolute top-[26px] bottom-0 left-1/2 w-1.5 -translate-x-1/2 rounded-[3px] bg-text"></div>
    </div>

    <!-- invisible, accessible drag control over the whole bar -->
    <input
      type="range"
      role="slider"
      min="0"
      max="100"
      step="1"
      value={current}
      {disabled}
      aria-label={$_('dashboard.vehicle.target_aria')}
      oninput={handleInput}
      onchange={handleChange}
      class="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
    />

    <!-- clear the soc limit (only when one is active) -->
    {#if limitActive}
      <button
        type="button"
        aria-label={$_('dashboard.vehicle.clear')}
        onclick={onclear}
        class="absolute -right-1 -top-7 rounded-full p-1 text-text-dim hover:text-error"
      >
        <Icon icon="mdi:close" size={16} />
      </button>
    {/if}
  </div>

  <!-- cap note -->
  {#if capped}
    <div class="mt-2 flex items-center gap-1.5 text-[11.5px] text-amber-400">
      <Icon icon="mdi:alert" size={14} />
      <span>{$_('dashboard.vehicle.cap_note', { values: { pct: Math.round(vehicleLimit) } })}</span>
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/components/dashboard/__tests__/VehicleSocBar.test.js`
Expected: PASS (5 tests).

Note: the clear button overlaps nothing — it sits above the bar (`-top-7`), outside the range input's `inset-0` hit area, so clicks reach it.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/dashboard/VehicleSocBar.svelte src/lib/components/dashboard/__tests__/VehicleSocBar.test.js
git commit -m "feat(soc): VehicleSocBar component — SOC fill, draggable target, vehicle-limit cap

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: i18n keys for the SOC bar (all four locales)

**Files:**
- Modify: `src/lib/i18n/en.json` (add `dashboard.vehicle` block)
- Modify: `src/lib/i18n/es.json` (add `dashboard.vehicle` block)
- Modify: `src/lib/i18n/fr.json` (add `dashboard.vehicle` block)
- Modify: `src/lib/i18n/hu.json` (add `dashboard.vehicle` block)

**Context:** Each locale file has a `"dashboard"` object containing `"mode"`, `"rate"`, `"limit"`, `"boost"`, `"throttle"`, etc. Add a new sibling `"vehicle"` key inside `"dashboard"`. Component tests mock i18n (keys return literally), so this task has no test of its own — it's verified by the build and by the runtime not throwing missing-key warnings.

- [ ] **Step 1: Add the block to `en.json`**

Inside the `"dashboard"` object in `src/lib/i18n/en.json`, add (e.g. right after the `"rate"` line):

```json
    "vehicle": {
      "label": "Vehicle",
      "charging_to": "charging to {pct}%",
      "to_full": "{time} to full",
      "vehicle_limit": "vehicle limit {pct}%",
      "target": "target {pct}%",
      "target_aria": "Charge target",
      "clear": "Clear charge target",
      "cap_note": "Vehicle stops at its own {pct}% limit — target above it won't charge further."
    },
```

- [ ] **Step 2: Add the block to `es.json`**

```json
    "vehicle": {
      "label": "Vehículo",
      "charging_to": "cargando hasta {pct}%",
      "to_full": "{time} para completar",
      "vehicle_limit": "límite del vehículo {pct}%",
      "target": "objetivo {pct}%",
      "target_aria": "Objetivo de carga",
      "clear": "Quitar objetivo de carga",
      "cap_note": "El vehículo se detiene en su propio límite del {pct}%; un objetivo superior no cargará más."
    },
```

- [ ] **Step 3: Add the block to `fr.json`**

```json
    "vehicle": {
      "label": "Véhicule",
      "charging_to": "charge jusqu'à {pct}%",
      "to_full": "{time} avant la charge complète",
      "vehicle_limit": "limite du véhicule {pct}%",
      "target": "cible {pct}%",
      "target_aria": "Cible de charge",
      "clear": "Effacer la cible de charge",
      "cap_note": "Le véhicule s'arrête à sa propre limite de {pct}% ; une cible supérieure ne chargera pas davantage."
    },
```

- [ ] **Step 4: Add the block to `hu.json`**

```json
    "vehicle": {
      "label": "Jármű",
      "charging_to": "töltés eddig: {pct}%",
      "to_full": "{time} a teljes töltésig",
      "vehicle_limit": "jármű korlátja {pct}%",
      "target": "cél {pct}%",
      "target_aria": "Töltési cél",
      "clear": "Töltési cél törlése",
      "cap_note": "A jármű a saját {pct}%-os korlátjánál megáll – az e fölötti cél nem tölt tovább."
    },
```

- [ ] **Step 5: Verify the JSON parses and tests still pass**

Run: `node -e "['en','es','fr','hu'].forEach(l=>JSON.parse(require('fs').readFileSync('src/lib/i18n/'+l+'.json','utf8')))" && echo OK`
Expected: `OK` (no parse error from a stray/missing comma).

Run: `npm test`
Expected: full suite still green (no behavior change yet).

- [ ] **Step 6: Commit**

```bash
git add src/lib/i18n/en.json src/lib/i18n/es.json src/lib/i18n/fr.json src/lib/i18n/hu.json
git commit -m "i18n: dashboard.vehicle keys for the SOC bar (en/es/fr/hu)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Drop the SOC option from `ChargeLimitModal`

**Files:**
- Modify: `src/lib/components/dashboard/ChargeLimitModal.svelte`
- Test (verify only): `src/lib/components/dashboard/__tests__/ChargeLimitModal.test.js`

**Context:** The bar now owns the soc limit, so the modal keeps only time / energy / range. Remove the `allowSoc` prop, the `socPct` state, the soc option in `typeOptions`, its reset in `$effect`, its render branch, and its `save()` branch. The existing modal test uses the default (energy) and does not touch soc, so it must still pass unchanged.

- [ ] **Step 1: Remove the `allowSoc` prop**

In `src/lib/components/dashboard/ChargeLimitModal.svelte`, change the props line from:

```js
  let { open = false, allowSoc = false, allowRange = false, onclose = () => {}, onsave = () => {} } = $props()
```
to:
```js
  let { open = false, allowRange = false, onclose = () => {}, onsave = () => {} } = $props()
```

- [ ] **Step 2: Remove `socPct` state and its reset**

Delete the `socPct` state line:
```js
  let socPct = $state(80)
```
and remove the `socPct = 80` line from inside the `$effect(() => { if (open) { ... } })` reset block.

- [ ] **Step 3: Remove the soc option, render branch, and save branch**

Remove the soc entry from `typeOptions`:
```js
    { value: 'soc', label: $_('dashboard.limit.type_soc'), disabled: !allowSoc },
```

Remove the soc render branch from the markup:
```svelte
    {:else if type === 'soc'}
      <div class="mb-1 text-sm text-text">{socPct}%</div>
      <Slider min={1} max={100} step={1} value={socPct} onchange={(v) => (socPct = v)} />
```

Remove the soc branch from `save()`:
```js
    else if (type === 'soc') value = socPct
```

- [ ] **Step 4: Run the modal tests to verify they still pass**

Run: `npx vitest run src/lib/components/dashboard/__tests__/ChargeLimitModal.test.js`
Expected: PASS (3 tests — energy default save, reset-on-reopen, closed renders nothing). No soc references remain.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/dashboard/ChargeLimitModal.svelte
git commit -m "refactor(limit): drop SOC option from modal — SOC bar owns it now

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Wire the bar into `Dashboard.svelte`

**Files:**
- Modify: `src/routes/Dashboard.svelte`
- Test: `src/routes/__tests__/Dashboard.test.js`

**Context:** The Dashboard is the only store-aware unit. Add derived view-model for soc/vehicle-limit/target, render `<VehicleSocBar>` (only when `battery_level` is present, inside the existing `{#if display !== 'error'}` block, directly above `ChargeLimitCard`), add the write/clear actions, gate `ChargeLimitCard` so it hides while an soc limit is active, and stop passing the now-removed `allowSoc` prop to the modal. `limit_store` and `serialQueue`/`showWriteError` are already imported.

- [ ] **Step 1: Write the failing test**

Add to `src/routes/__tests__/Dashboard.test.js`. First extend the imports and `beforeEach` to reset `limit_store`:

At the top with the other store imports, add:
```js
import { limit_store } from '../../lib/stores/limit.js'
```
Inside `beforeEach(() => { ... })`, add (anywhere in the block):
```js
    limit_store.set({ type: 'none', value: 0, auto_release: true })
```

Then add these tests inside the `describe('Dashboard', ...)` block:

```js
  it('shows the vehicle SOC bar when battery_level is present', () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 80, battery_range: 206, time_to_full_charge: 0 })
    const { getByText, getByRole } = render(Dashboard)
    expect(getByText('74%')).toBeInTheDocument()
    expect(getByRole('slider', { name: 'dashboard.vehicle.target_aria' })).toBeInTheDocument()
  })

  it('hides the SOC bar when there is no battery_level', () => {
    status_store.set({ state: 1, total_day: 0, total_energy: 0 })
    const { queryByRole } = render(Dashboard)
    expect(queryByRole('slider', { name: 'dashboard.vehicle.target_aria' })).not.toBeInTheDocument()
  })

  it('uploads an soc limit when the SOC target is committed', async () => {
    status_store.set({ state: 3, power: 7000, voltage: 240, amp: 0, temp: 0, pilot: 0, total_day: 0, total_energy: 0, battery_level: 74, vehicle_charge_limit: 90, battery_range: 206, time_to_full_charge: 0 })
    const { getByRole } = render(Dashboard)
    const slider = getByRole('slider', { name: 'dashboard.vehicle.target_aria' })
    slider.value = '85'
    await fireEvent.change(slider)
    await vi.waitFor(() => {
      expect(httpAPI).toHaveBeenCalledWith('POST', '/limit', JSON.stringify({ type: 'soc', value: 85, auto_release: true }))
    })
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/routes/__tests__/Dashboard.test.js`
Expected: FAIL — no element with accessible name `dashboard.vehicle.target_aria` (bar not rendered yet).

- [ ] **Step 3: Add imports**

In the `<script>` of `src/routes/Dashboard.svelte`, add to the component imports (near `import ChargeLimitCard ...`):
```js
  import VehicleSocBar from '../lib/components/dashboard/VehicleSocBar.svelte'
```
and to the lib imports (near `import { displayState, ringFill, connectedReason } from '../lib/dashboard/state.js'`):
```js
  import { restingTarget } from '../lib/dashboard/soc.js'
```

- [ ] **Step 4: Add derived view-model and a remount nonce**

After the existing `let limitSummary = $derived(formatLimit($limit_store))` line (and before the actions section), add:

```js
  // ── vehicle SOC bar view-model ──────────────────────────────────────────
  let hasSoc = $derived(
    $status_store?.battery_level !== undefined && $status_store?.battery_level !== null,
  )
  let vehicleLimit = $derived(
    Number.isFinite($status_store?.vehicle_charge_limit) ? $status_store.vehicle_charge_limit : null,
  )
  let socLimitActive = $derived($limit_store?.type === 'soc')
  let socTarget = $derived(socLimitActive ? $limit_store.value : restingTarget(vehicleLimit))
  // Bumped on a failed soc write to remount the bar back to the confirmed value.
  let socNonce = $state(0)
```

- [ ] **Step 5: Add the write/clear actions**

In the actions section (e.g. after `clearLimit`), add:

```js
  async function setSocTarget(val) {
    if (busy) return
    busy = true
    try {
      const ok = await serialQueue.add(() =>
        limit_store.upload({ type: 'soc', value: val, auto_release: true }),
      )
      if (ok) {
        await serialQueue.add(() => limit_store.download())
      } else {
        showWriteError()
        socNonce++ // remount VehicleSocBar so the target reverts to the confirmed value
      }
    } finally {
      busy = false
    }
  }

  async function clearSocLimit() {
    if (busy) return
    busy = true
    try {
      const ok = await serialQueue.add(() => limit_store.remove())
      if (!ok) showWriteError()
    } finally {
      busy = false
    }
  }
```

- [ ] **Step 6: Render the bar and gate the limit card**

In the markup, inside the `{#if display !== 'error'}` block, insert the bar directly above `<ChargeLimitCard ... />` and wrap the card so it hides for an active soc limit. Replace this existing fragment:

```svelte
    <ChargeLimitCard
      limit={$limit_store}
      summary={limitSummary}
      onopen={() => (limitModalOpen = true)}
      onclear={clearLimit}
    />
```
with:
```svelte
    {#if hasSoc}
      {#key socNonce}
        <VehicleSocBar
          soc={$status_store.battery_level}
          {vehicleLimit}
          target={socTarget}
          range={$status_store?.battery_range ?? null}
          rangeMiles={!!$config_store?.mqtt_vehicle_range_miles}
          timeToFull={$status_store?.time_to_full_charge ?? 0}
          {charging}
          limitActive={socLimitActive}
          disabled={busy}
          onchange={setSocTarget}
          onclear={clearSocLimit}
        />
      {/key}
    {/if}

    {#if !socLimitActive}
      <ChargeLimitCard
        limit={$limit_store}
        summary={limitSummary}
        onopen={() => (limitModalOpen = true)}
        onclear={clearLimit}
      />
    {/if}
```

- [ ] **Step 7: Stop passing `allowSoc` to the modal**

Change the `<ChargeLimitModal ... />` instance from:
```svelte
<ChargeLimitModal
  open={limitModalOpen}
  allowSoc={$status_store?.battery_level !== undefined}
  allowRange={$status_store?.battery_range !== undefined}
  onclose={() => (limitModalOpen = false)}
  onsave={saveLimit}
/>
```
to:
```svelte
<ChargeLimitModal
  open={limitModalOpen}
  allowRange={$status_store?.battery_range !== undefined}
  onclose={() => (limitModalOpen = false)}
  onsave={saveLimit}
/>
```

- [ ] **Step 8: Run the Dashboard tests to verify they pass**

Run: `npx vitest run src/routes/__tests__/Dashboard.test.js`
Expected: PASS — including the three new tests, and the existing tests unchanged (they set no `battery_level`, so the bar stays hidden and no second slider appears).

- [ ] **Step 9: Run the full suite and a production build**

Run: `npm test`
Expected: full suite green.

Run: `npm run build`
Expected: clean build, no missing-i18n-key warnings for `dashboard.vehicle.*`.

- [ ] **Step 10: Commit**

```bash
git add src/routes/Dashboard.svelte src/routes/__tests__/Dashboard.test.js
git commit -m "feat(dashboard): wire VehicleSocBar — drag sets soc limit, card hides while active

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Deferred:** the live charging *pulse* animation is intentionally out of scope (design spec, "Out of scope"). Don't add it.
- **Single-limit device:** `/limit` holds one limit at a time. Dragging the bar replaces any active time/energy/range limit with an soc limit — this is intended ("the bar owns the SOC path").
- **`formatLimit` soc branch** in `Dashboard.svelte` becomes unreachable (the card hides for soc). Leaving it is harmless; do not spend effort removing it.
- **Range unit** follows `config.mqtt_vehicle_range_miles`, matching the Monitoring page's convention.

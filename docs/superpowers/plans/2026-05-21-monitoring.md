# Monitoring Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v3 Monitoring screen — the `/monitoring` route — a read-only tabbed diagnostics view (Data / Safety / Manager), replacing the placeholder screen.

**Architecture:** A self-contained pure-logic module (`monitoring/metrics.js`) maps store data into metric groups, safety rows, and claim rows. One new UI primitive (`Tabs`). Five Monitoring components render the screen from plain props. `Monitoring.svelte` is the only store-aware unit: it reads the stores, derives the view-model, holds the active-tab state, and composes the tabs. The screen performs no device writes.

**Tech Stack:** Svelte 5 (runes), Tailwind 4 (CSS-variable theme tokens), `svelte-i18n`, Vitest + `@testing-library/svelte`.

**Preconditions:**
- The v3 foundation + Dashboard + Schedule are merged to `main`. Work happens on a `monitoring` branch (the executor creates it).
- 271 tests pass. UI primitives available: `Card`, `Icon`. Stores: `status`, `config`, `claims_target`, `uistates`. Helpers in `src/lib/utils.js`: `getStateDesc`, `clientid2name`.

**Field interpretation (from v2, confirmed against a live device):**
- `status.session_energy` — watt-hours (kWh = `/1000`). `status.total_*` — already kWh.
- `status.amp` — milliamps (A = `/1000`). `status.temp`, `temp1..4` — tenths of °C.
- `status.pilot`, `status.voltage` — used directly.

**Plan-level decisions:**
- `metrics.js` is fully self-contained — its own `round`/time helpers, no imports — so it unit-tests with no mocks.
- Components never import stores; `Monitoring.svelte` passes data down. The screen has no writes and no `serialQueue` usage.
- `Tabs` is the one new UI primitive.

---

## File Structure

```
src/lib/i18n/en.json                              (modify — add "monitoring", "units", "clients" blocks)
src/lib/monitoring/metrics.js                      pure: metric groups, safety rows, claim rows, severity
src/lib/components/ui/Tabs.svelte                  NEW primitive — tab bar with optional alert dot
src/lib/components/monitoring/
  MetricRow.svelte                                 one label / value / unit row
  MetricGroup.svelte                               one collapsible titled group
  MetricsTab.svelte                                the Data tab — stacks the metric groups
  SafetyTab.svelte                                 the Safety tab — error + info count rows
  ManagerTab.svelte                                the Manager tab — the claims table
src/routes/Monitoring.svelte                       (replace placeholder — store wiring + composition)
```

---

## Phase A — i18n & Pure Logic

### Task 1: Monitoring i18n keys

**Files:**
- Modify: `src/lib/i18n/en.json`
- Test: `src/lib/i18n/__tests__/monitoring-i18n.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/i18n/__tests__/monitoring-i18n.test.js`

```js
import { describe, it, expect } from 'vitest'
import en from '../en.json'

describe('monitoring i18n keys', () => {
  it('has the monitoring block', () => {
    expect(en.monitoring.tab.data).toBeTypeOf('string')
    expect(en.monitoring.tab.safety).toBeTypeOf('string')
    expect(en.monitoring.tab.manager).toBeTypeOf('string')
    expect(en.monitoring.group.energy).toBeTypeOf('string')
    expect(en.monitoring.energy.session).toBeTypeOf('string')
    expect(en.monitoring.sensor.pilot).toBeTypeOf('string')
    expect(en.monitoring.service.level).toBeTypeOf('string')
    expect(en.monitoring.vehicle.battery).toBeTypeOf('string')
    expect(en.monitoring.safety.errors).toBeTypeOf('string')
    expect(en.monitoring.safety.switches).toBeTypeOf('string')
    expect(en.monitoring.manager.empty).toBeTypeOf('string')
  })
  it('has units and clients blocks', () => {
    expect(en.units.kwh).toBeTypeOf('string')
    expect(en.units.amp).toBeTypeOf('string')
    expect(en.units.celsius).toBeTypeOf('string')
    expect(en.clients.manual).toBeTypeOf('string')
    expect(en.clients.null).toBeTypeOf('string')
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- monitoring-i18n`.

- [ ] **Step 3: Add three new top-level blocks to `src/lib/i18n/en.json`** (keep all existing keys; valid JSON):

```json
  "monitoring": {
    "tab": { "data": "Data", "safety": "Safety", "manager": "Manager" },
    "group": {
      "energy": "Energy delivered",
      "sensors": "Sensors",
      "service": "Service",
      "vehicle": "Vehicle"
    },
    "energy": {
      "session": "Session",
      "total": "Total",
      "day": "Today",
      "week": "This week",
      "month": "This month",
      "year": "This year"
    },
    "sensor": {
      "pilot": "Pilot",
      "current": "Current",
      "voltage": "Voltage",
      "evsetemp": "EVSE temperature",
      "temp1": "Temp sensor 1",
      "temp2": "Temp sensor 2",
      "temp3": "Temp sensor 3",
      "temp4": "Temp sensor 4",
      "scale": "Sensor scale",
      "offset": "Sensor offset"
    },
    "service": {
      "level": "Service level",
      "min": "Service min",
      "max": "Service max"
    },
    "vehicle": {
      "updated": "Last updated",
      "battery": "Battery",
      "range": "Range",
      "timeleft": "Time to full"
    },
    "safety": {
      "errors": "Errors",
      "info": "Info",
      "fault": "Current fault",
      "gfci": "GFCI trips",
      "noground": "No-ground trips",
      "stuck": "Stuck relay",
      "switches": "Relay switch count"
    },
    "manager": { "empty": "No active claims" }
  },
  "units": {
    "kwh": "kWh",
    "amp": "A",
    "volt": "V",
    "celsius": "°C",
    "km": "km",
    "miles": "mi",
    "percent": "%"
  },
  "clients": {
    "manual": "Manual",
    "divert": "Solar divert",
    "boost": "Boost",
    "timer": "Timer",
    "limit": "Limit",
    "error": "Error",
    "ohm": "OhmConnect",
    "ocpp": "OCPP",
    "rfid": "RFID",
    "mqtt": "MQTT",
    "shaper": "Load shaper",
    "null": "—"
  }
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- monitoring-i18n`. Then full suite `npm test` — all green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Monitoring i18n keys\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 2: Monitoring pure-logic module

**Files:**
- Create: `src/lib/monitoring/metrics.js`
- Test: `src/lib/monitoring/__tests__/metrics.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/monitoring/__tests__/metrics.test.js`

```js
import { describe, it, expect } from 'vitest'
import {
  round, energyMetrics, sensorMetrics, serviceMetrics, vehicleMetrics,
  showVehicle, countSeverity, safetyData, claimRows,
} from '../metrics.js'

describe('round', () => {
  it('rounds to the given precision', () => {
    expect(round(7523.272, 1)).toBe(7523.3)
    expect(round(0, 0)).toBe(0)
  })
  it('returns null for missing / non-numeric input', () => {
    expect(round(undefined)).toBe(null)
    expect(round(null)).toBe(null)
    expect(round(false)).toBe(null)
  })
})

describe('energyMetrics', () => {
  it('converts session Wh to kWh and keeps totals in kWh', () => {
    const g = energyMetrics({ session_energy: 5000, total_energy: 7523.27, total_day: 1.234 })
    expect(g.titleKey).toBe('monitoring.group.energy')
    expect(g.rows[0]).toEqual({ labelKey: 'monitoring.energy.session', value: 5, unit: 'units.kwh' })
    expect(g.rows[1].value).toBe(7523.3)
    expect(g.rows[2].value).toBe(1.2)
  })
})

describe('sensorMetrics', () => {
  it('scales current and temperature, and includes only real temp sensors', () => {
    const g = sensorMetrics(
      { pilot: 32, amp: 16000, voltage: 240, temp: 427, temp1: 427, temp2: 266, temp3: false },
      { scale: 454, offset: 283 },
    )
    const byLabel = Object.fromEntries(g.rows.map((r) => [r.labelKey, r.value]))
    expect(byLabel['monitoring.sensor.current']).toBe(16)
    expect(byLabel['monitoring.sensor.evsetemp']).toBe(42.7)
    expect(byLabel['monitoring.sensor.temp1']).toBe(42.7)
    expect(byLabel['monitoring.sensor.temp2']).toBe(26.6)
    expect(byLabel['monitoring.sensor.temp3']).toBeUndefined() // false → omitted
    expect(byLabel['monitoring.sensor.temp4']).toBeUndefined() // missing → omitted
    expect(byLabel['monitoring.sensor.scale']).toBe(454)
  })
})

describe('serviceMetrics', () => {
  it('reads service level and current limits', () => {
    const g = serviceMetrics({ service_level: 2 }, { min_current_hard: 6, max_current_soft: 48 })
    const byLabel = Object.fromEntries(g.rows.map((r) => [r.labelKey, r.value]))
    expect(byLabel['monitoring.service.level']).toBe(2)
    expect(byLabel['monitoring.service.max']).toBe(48)
  })
})

describe('showVehicle', () => {
  it('is true only when the device reports vehicle data', () => {
    expect(showVehicle({}, {})).toBe(false)
    expect(showVehicle({ battery_level: 80 }, {})).toBe(true)
    expect(showVehicle({ battery_range: 200 }, {})).toBe(true)
    expect(showVehicle({}, { time_to_full_charge: 3600 })).toBe(true)
  })
})

describe('vehicleMetrics', () => {
  it('formats the time fields as HH:MM:SS', () => {
    const g = vehicleMetrics({ vehicle_state_update: 3661, battery_level: 80 }, {})
    const byLabel = Object.fromEntries(g.rows.map((r) => [r.labelKey, r.value]))
    expect(byLabel['monitoring.vehicle.updated']).toBe('01:01:01')
    expect(byLabel['monitoring.vehicle.battery']).toBe(80)
  })
})

describe('countSeverity', () => {
  it('maps a count against warning / alert thresholds', () => {
    expect(countSeverity(0, 20000, 40000)).toBe('ok')
    expect(countSeverity(20000, 20000, 40000)).toBe('ok')
    expect(countSeverity(20001, 20000, 40000)).toBe('warning')
    expect(countSeverity(40001, 20000, 40000)).toBe('error')
  })
})

describe('safetyData', () => {
  it('builds error rows; counts are ok at 0, error otherwise', () => {
    const d = safetyData({ gfcicount: 0, nogndcount: 5, stuckcount: 0, total_switches: 19 }, false)
    expect(d.errors).toHaveLength(3) // no fault row
    expect(d.errors.find((r) => r.key === 'gfci').severity).toBe('ok')
    expect(d.errors.find((r) => r.key === 'noground').severity).toBe('error')
    expect(d.infos[0]).toMatchObject({ key: 'switches', count: 19, severity: 'ok' })
  })
  it('prepends a fault row carrying the state code when faulted', () => {
    const d = safetyData({ state: 8, gfcicount: 0, nogndcount: 0, stuckcount: 0 }, true)
    expect(d.errors[0]).toEqual({ key: 'fault', state: 8, severity: 'error' })
  })
})

describe('claimRows', () => {
  it('maps each claim key to property / clientId / value', () => {
    const rows = claimRows({
      claims: { state: 65537, charge_current: 65538 },
      properties: { state: 'disabled', charge_current: 32 },
    })
    expect(rows).toEqual([
      { property: 'state', clientId: 65537, value: 'disabled' },
      { property: 'charge_current', clientId: 65538, value: 32 },
    ])
  })
  it('returns an empty array for missing input', () => {
    expect(claimRows(undefined)).toEqual([])
    expect(claimRows({})).toEqual([])
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- monitoring/__tests__/metrics` — module missing.

- [ ] **Step 3: Create `src/lib/monitoring/metrics.js`**

```js
/** Pure helpers for the Monitoring screen. Self-contained — no store/DOM/utils imports. */

/** Round `value` to `p` decimals; null for missing / non-numeric input. */
export function round(value, p = 0) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  const m = Math.pow(10, p)
  return Math.round(n * m) / m
}

/** Format a duration in seconds as HH:MM:SS. */
function hms(sec) {
  const s = Number(sec)
  if (!Number.isFinite(s) || s < 0) return '00:00:00'
  const pad = (n) => String(Math.floor(n)).padStart(2, '0')
  return `${pad(s / 3600)}:${pad((s % 3600) / 60)}:${pad(s % 60)}`
}

/** Tenths-of-°C → °C (1 dp); null when the sensor reports no real number. */
function tempC(raw) {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  return round(raw / 10, 1)
}

export function energyMetrics(status) {
  const s = status ?? {}
  return {
    titleKey: 'monitoring.group.energy',
    rows: [
      { labelKey: 'monitoring.energy.session', value: round((s.session_energy ?? 0) / 1000, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.total', value: round(s.total_energy, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.day', value: round(s.total_day, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.week', value: round(s.total_week, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.month', value: round(s.total_month, 1), unit: 'units.kwh' },
      { labelKey: 'monitoring.energy.year', value: round(s.total_year, 1), unit: 'units.kwh' },
    ],
  }
}

export function sensorMetrics(status, config) {
  const s = status ?? {}
  const c = config ?? {}
  const rows = [
    { labelKey: 'monitoring.sensor.pilot', value: round(s.pilot, 0), unit: 'units.amp' },
    { labelKey: 'monitoring.sensor.current', value: round((s.amp ?? 0) / 1000, 1), unit: 'units.amp' },
    { labelKey: 'monitoring.sensor.voltage', value: round(s.voltage, 0), unit: 'units.volt' },
    { labelKey: 'monitoring.sensor.evsetemp', value: tempC(s.temp), unit: 'units.celsius' },
  ]
  ;[s.temp1, s.temp2, s.temp3, s.temp4].forEach((raw, i) => {
    const v = tempC(raw)
    if (v !== null) rows.push({ labelKey: `monitoring.sensor.temp${i + 1}`, value: v, unit: 'units.celsius' })
  })
  rows.push({ labelKey: 'monitoring.sensor.scale', value: c.scale ?? null, unit: '' })
  rows.push({ labelKey: 'monitoring.sensor.offset', value: c.offset ?? null, unit: '' })
  return { titleKey: 'monitoring.group.sensors', rows }
}

export function serviceMetrics(status, config) {
  const s = status ?? {}
  const c = config ?? {}
  return {
    titleKey: 'monitoring.group.service',
    rows: [
      { labelKey: 'monitoring.service.level', value: s.service_level ?? null, unit: '' },
      { labelKey: 'monitoring.service.min', value: c.min_current_hard ?? null, unit: 'units.amp' },
      { labelKey: 'monitoring.service.max', value: c.max_current_soft ?? null, unit: 'units.amp' },
    ],
  }
}

export function vehicleMetrics(status, config) {
  const s = status ?? {}
  const c = config ?? {}
  return {
    titleKey: 'monitoring.group.vehicle',
    rows: [
      { labelKey: 'monitoring.vehicle.updated', value: hms(s.vehicle_state_update), unit: '' },
      { labelKey: 'monitoring.vehicle.battery', value: s.battery_level ?? null, unit: 'units.percent' },
      { labelKey: 'monitoring.vehicle.range', value: s.battery_range ?? null, unit: c.mqtt_vehicle_range_miles ? 'units.miles' : 'units.km' },
      { labelKey: 'monitoring.vehicle.timeleft', value: hms(s.time_to_full_charge), unit: '' },
    ],
  }
}

/** Whether the Vehicle metric group should render. */
export function showVehicle(status, config) {
  const s = status ?? {}
  const c = config ?? {}
  return s.battery_level !== undefined || s.battery_range !== undefined || !!c.time_to_full_charge
}

/** 'ok' | 'warning' | 'error' for a count against warning / alert thresholds. */
export function countSeverity(count, warning, alert) {
  const n = Number(count)
  if (!Number.isFinite(n)) return 'ok'
  if (n > alert) return 'error'
  if (n > warning) return 'warning'
  return 'ok'
}

/** Build the Safety-tab rows. The fault row carries `state` for getStateDesc. */
export function safetyData(status, hasError) {
  const s = status ?? {}
  const countRow = (key, count) => ({
    key,
    count: count ?? 0,
    severity: (count ?? 0) === 0 ? 'ok' : 'error',
  })
  const errors = []
  if (hasError) errors.push({ key: 'fault', state: s.state, severity: 'error' })
  errors.push(countRow('gfci', s.gfcicount))
  errors.push(countRow('noground', s.nogndcount))
  errors.push(countRow('stuck', s.stuckcount))
  const switches = s.total_switches ?? 0
  const infos = [{ key: 'switches', count: switches, severity: countSeverity(switches, 20000, 40000) }]
  return { errors, infos }
}

/** One row per entry in `claims_target.claims`. */
export function claimRows(claimsTarget) {
  const ct = claimsTarget ?? {}
  const claims = ct.claims ?? {}
  const properties = ct.properties ?? {}
  return Object.keys(claims).map((property) => ({
    property,
    clientId: claims[property],
    value: properties[property],
  }))
}
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- monitoring/__tests__/metrics`. Then full suite `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Monitoring pure-logic module\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Phase B — UI Primitive & Components

> Every component in this phase receives plain props and emits callbacks. None imports a store.

### Task 3: Tabs primitive

**Files:**
- Create: `src/lib/components/ui/Tabs.svelte`
- Test: `src/lib/components/ui/__tests__/Tabs.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/ui/__tests__/Tabs.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import Tabs from '../Tabs.svelte'

const tabs = [
  { label: 'Data', alert: false },
  { label: 'Safety', alert: true },
  { label: 'Manager', alert: false },
]

describe('Tabs', () => {
  it('renders a tab per entry and marks the active one', () => {
    const { getAllByRole } = render(Tabs, { props: { tabs, active: 1 } })
    const els = getAllByRole('tab')
    expect(els).toHaveLength(3)
    expect(els[1].getAttribute('aria-selected')).toBe('true')
    expect(els[0].getAttribute('aria-selected')).toBe('false')
  })
  it('fires onchange with the clicked index', async () => {
    const onchange = vi.fn()
    const { getByText } = render(Tabs, { props: { tabs, active: 0, onchange } })
    await fireEvent.click(getByText('Manager'))
    expect(onchange).toHaveBeenCalledWith(2)
  })
  it('shows an alert dot only on tabs with alert set', () => {
    const { getAllByRole } = render(Tabs, { props: { tabs, active: 0 } })
    const els = getAllByRole('tab')
    expect(els[0].querySelector('span')).toBe(null)
    expect(els[1].querySelector('span')).not.toBe(null)
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- Tabs`.

- [ ] **Step 3: Create `src/lib/components/ui/Tabs.svelte`**

```svelte
<script>
  let { tabs = [], active = 0, onchange = () => {} } = $props()
</script>

<div class="flex gap-1 rounded-xl bg-surface-2 p-1" role="tablist">
  {#each tabs as tab, i}
    <button
      type="button"
      role="tab"
      aria-selected={i === active}
      onclick={() => onchange(i)}
      class="relative flex-1 rounded-lg py-2 text-xs font-semibold transition
             {i === active ? 'bg-accent text-surface' : 'text-text-dim'}"
    >
      {tab.label}
      {#if tab.alert}
        <span class="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-error"></span>
      {/if}
    </button>
  {/each}
</div>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- Tabs`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Tabs UI primitive\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 4: MetricRow and MetricGroup

**Files:**
- Create: `src/lib/components/monitoring/MetricRow.svelte`, `src/lib/components/monitoring/MetricGroup.svelte`
- Test: `src/lib/components/monitoring/__tests__/MetricRow.test.js`, `src/lib/components/monitoring/__tests__/MetricGroup.test.js`

- [ ] **Step 1: Write the failing tests**

`src/lib/components/monitoring/__tests__/MetricRow.test.js`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import MetricRow from '../MetricRow.svelte'

describe('MetricRow', () => {
  it('shows the label and value', () => {
    const { getByText } = render(MetricRow, {
      props: { labelKey: 'monitoring.energy.total', value: 7523.3, unit: 'units.kwh' },
    })
    expect(getByText('monitoring.energy.total')).toBeInTheDocument()
    expect(getByText('7523.3')).toBeInTheDocument()
  })
  it('renders an em-dash for a null value', () => {
    const { getByText } = render(MetricRow, {
      props: { labelKey: 'monitoring.energy.total', value: null, unit: 'units.kwh' },
    })
    expect(getByText('—')).toBeInTheDocument()
  })
  it('renders a zero value (not an em-dash)', () => {
    const { getByText } = render(MetricRow, {
      props: { labelKey: 'monitoring.sensor.pilot', value: 0, unit: 'units.amp' },
    })
    expect(getByText('0')).toBeInTheDocument()
  })
})
```

`src/lib/components/monitoring/__tests__/MetricGroup.test.js`:
```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import MetricGroup from '../MetricGroup.svelte'

const group = {
  titleKey: 'monitoring.group.energy',
  rows: [{ labelKey: 'monitoring.energy.total', value: 12, unit: 'units.kwh' }],
}

describe('MetricGroup', () => {
  it('hides rows when collapsed and shows them after the header is clicked', async () => {
    const { getByText, queryByText } = render(MetricGroup, { props: { group, expanded: false } })
    expect(queryByText('monitoring.energy.total')).not.toBeInTheDocument()
    await fireEvent.click(getByText('monitoring.group.energy'))
    expect(getByText('monitoring.energy.total')).toBeInTheDocument()
  })
  it('shows rows immediately when expanded by default', () => {
    const { getByText } = render(MetricGroup, { props: { group, expanded: true } })
    expect(getByText('monitoring.energy.total')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests, verify they FAIL** — `npm test -- MetricRow MetricGroup`.

- [ ] **Step 3: Create `src/lib/components/monitoring/MetricRow.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'

  let { labelKey, value, unit = '' } = $props()

  let display = $derived(value === null || value === undefined ? '—' : value)
</script>

<div class="flex items-center justify-between py-2 text-sm">
  <span class="text-text-dim">{$_(labelKey)}</span>
  <span class="font-semibold text-text">
    {display}{#if unit && display !== '—'}<span class="ml-1 text-xs font-normal text-text-dim">{$_(unit)}</span>{/if}
  </span>
</div>
```

- [ ] **Step 4: Create `src/lib/components/monitoring/MetricGroup.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import Icon from '../../icons/Icon.svelte'
  import MetricRow from './MetricRow.svelte'

  let { group, expanded = false } = $props()

  let open = $state(expanded)
</script>

<Card class="mb-2">
  <button
    type="button"
    onclick={() => (open = !open)}
    aria-expanded={open}
    class="flex w-full items-center justify-between p-3 text-left"
  >
    <span class="text-sm font-semibold text-text">{$_(group.titleKey)}</span>
    <Icon icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'} size={20} class="text-text-dim" />
  </button>
  {#if open}
    <div class="border-t border-border px-3 pb-1">
      {#each group.rows as row}
        <MetricRow labelKey={row.labelKey} value={row.value} unit={row.unit} />
      {/each}
    </div>
  {/if}
</Card>
```

- [ ] **Step 5: Run tests, verify they PASS** — `npm test -- MetricRow MetricGroup`. Then `npm test`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Monitoring MetricRow and MetricGroup\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 5: MetricsTab

**Files:**
- Create: `src/lib/components/monitoring/MetricsTab.svelte`
- Test: `src/lib/components/monitoring/__tests__/MetricsTab.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/monitoring/__tests__/MetricsTab.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import MetricsTab from '../MetricsTab.svelte'

const groups = [
  { group: { titleKey: 'monitoring.group.energy', rows: [] }, expanded: true },
  { group: { titleKey: 'monitoring.group.sensors', rows: [] }, expanded: false },
]

describe('MetricsTab', () => {
  it('renders a group per entry', () => {
    const { getByText } = render(MetricsTab, { props: { groups } })
    expect(getByText('monitoring.group.energy')).toBeInTheDocument()
    expect(getByText('monitoring.group.sensors')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- MetricsTab`.

- [ ] **Step 3: Create `src/lib/components/monitoring/MetricsTab.svelte`**

```svelte
<script>
  import MetricGroup from './MetricGroup.svelte'

  let { groups = [] } = $props()
</script>

<div>
  {#each groups as g}
    <MetricGroup group={g.group} expanded={g.expanded} />
  {/each}
</div>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- MetricsTab`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Monitoring MetricsTab\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 6: SafetyTab

**Files:**
- Create: `src/lib/components/monitoring/SafetyTab.svelte`
- Test: `src/lib/components/monitoring/__tests__/SafetyTab.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/monitoring/__tests__/SafetyTab.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import SafetyTab from '../SafetyTab.svelte'

describe('SafetyTab', () => {
  it('renders the error count rows and the info row', () => {
    const data = {
      errors: [
        { key: 'gfci', count: 0, severity: 'ok' },
        { key: 'noground', count: 5, severity: 'error' },
        { key: 'stuck', count: 0, severity: 'ok' },
      ],
      infos: [{ key: 'switches', count: 19, severity: 'ok' }],
    }
    const { getByText } = render(SafetyTab, { props: { data } })
    expect(getByText('monitoring.safety.gfci')).toBeInTheDocument()
    expect(getByText('5')).toBeInTheDocument()
    expect(getByText('19')).toBeInTheDocument()
  })
  it('renders a fault row with the localised state description when faulted', () => {
    const data = {
      errors: [
        { key: 'fault', state: 8, severity: 'error' },
        { key: 'gfci', count: 0, severity: 'ok' },
        { key: 'noground', count: 0, severity: 'ok' },
        { key: 'stuck', count: 0, severity: 'ok' },
      ],
      infos: [{ key: 'switches', count: 0, severity: 'ok' }],
    }
    const { getByText } = render(SafetyTab, { props: { data } })
    expect(getByText('monitoring.safety.fault')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- SafetyTab`.

- [ ] **Step 3: Create `src/lib/components/monitoring/SafetyTab.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import { getStateDesc } from '../../utils.js'

  let { data = { errors: [], infos: [] } } = $props()

  const sevClass = {
    ok: 'bg-accent/15 text-accent',
    warning: 'bg-warning/15 text-warning',
    error: 'bg-error/15 text-error',
  }

  function rowLabel(row) {
    return $_('monitoring.safety.' + row.key)
  }
  function rowValue(row) {
    return row.key === 'fault' ? $_(getStateDesc(row.state)) : row.count
  }
</script>

<Card class="mb-2 p-3">
  <h2 class="mb-1 text-sm font-semibold text-text">{$_('monitoring.safety.errors')}</h2>
  {#each data.errors as row}
    <div class="flex items-center justify-between py-2 text-sm">
      <span class="text-text-dim">{rowLabel(row)}</span>
      <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {sevClass[row.severity]}">
        {rowValue(row)}
      </span>
    </div>
  {/each}
</Card>

<Card class="p-3">
  <h2 class="mb-1 text-sm font-semibold text-text">{$_('monitoring.safety.info')}</h2>
  {#each data.infos as row}
    <div class="flex items-center justify-between py-2 text-sm">
      <span class="text-text-dim">{$_('monitoring.safety.' + row.key)}</span>
      <span class="rounded-full px-2.5 py-0.5 text-xs font-semibold {sevClass[row.severity]}">
        {row.count}
      </span>
    </div>
  {/each}
</Card>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- SafetyTab`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Monitoring SafetyTab\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

### Task 7: ManagerTab

**Files:**
- Create: `src/lib/components/monitoring/ManagerTab.svelte`
- Test: `src/lib/components/monitoring/__tests__/ManagerTab.test.js`

- [ ] **Step 1: Write the failing test** — `src/lib/components/monitoring/__tests__/ManagerTab.test.js`

```js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ManagerTab from '../ManagerTab.svelte'

describe('ManagerTab', () => {
  it('shows the empty state when there are no claims', () => {
    const { getByText } = render(ManagerTab, { props: { rows: [] } })
    expect(getByText('monitoring.manager.empty')).toBeInTheDocument()
  })
  it('renders a row per claim with property and value', () => {
    const rows = [
      { property: 'state', clientId: 65537, value: 'disabled' },
      { property: 'charge_current', clientId: 65537, value: 32 },
    ]
    const { getByText } = render(ManagerTab, { props: { rows } })
    expect(getByText('state')).toBeInTheDocument()
    expect(getByText('charge_current')).toBeInTheDocument()
    expect(getByText('32')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- ManagerTab`.

- [ ] **Step 3: Create `src/lib/components/monitoring/ManagerTab.svelte`**

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import Card from '../ui/Card.svelte'
  import { clientid2name } from '../../utils.js'

  let { rows = [] } = $props()

  function fmtValue(v) {
    if (v === 'active' || v === 'disabled') return $_('schedule.' + v)
    if (v === null || v === undefined) return '—'
    return String(v)
  }
</script>

{#if rows.length === 0}
  <Card class="py-10 text-center text-sm text-text-dim">
    {$_('monitoring.manager.empty')}
  </Card>
{:else}
  <Card class="p-3">
    {#each rows as row}
      <div class="flex items-center justify-between border-b border-border py-2.5 last:border-0">
        <span class="text-sm text-text-dim">{row.property}</span>
        <span class="flex items-center gap-1.5">
          <span class="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold text-text">
            {$_('clients.' + clientid2name(row.clientId))}
          </span>
          <span class="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
            {fmtValue(row.value)}
          </span>
        </span>
      </div>
    {/each}
  </Card>
{/if}
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- ManagerTab`. Then `npm test`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Add Monitoring ManagerTab\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Phase C — Route Integration

### Task 8: Monitoring route

**Files:**
- Replace: `src/routes/Monitoring.svelte` (currently a placeholder)
- Test: `src/routes/__tests__/Monitoring.test.js`

- [ ] **Step 1: Write the failing test** — `src/routes/__tests__/Monitoring.test.js`

```js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({})) }))

import { status_store } from '../../lib/stores/status.js'
import { config_store } from '../../lib/stores/config.js'
import { claims_target_store } from '../../lib/stores/claims_target.js'
import { uistates_store } from '../../lib/stores/uistates.js'
import Monitoring from '../Monitoring.svelte'

describe('Monitoring', () => {
  beforeEach(() => {
    status_store.set({ total_energy: 7523, gfcicount: 0, nogndcount: 0, stuckcount: 0, total_switches: 19 })
    config_store.set({ scale: 454, offset: 283, max_current_soft: 48 })
    claims_target_store.set({ claims: { state: 65537 }, properties: { state: 'disabled' } })
    uistates_store.setObject('error', false)
  })

  it('renders the Data tab by default with the energy group', () => {
    const { getByText } = render(Monitoring)
    expect(getByText('monitoring.group.energy')).toBeInTheDocument()
  })

  it('switches to the Safety tab when its segment is clicked', async () => {
    const { getByText } = render(Monitoring)
    await fireEvent.click(getByText('monitoring.tab.safety'))
    expect(getByText('monitoring.safety.gfci')).toBeInTheDocument()
  })

  it('switches to the Manager tab and shows the claim row', async () => {
    const { getByText } = render(Monitoring)
    await fireEvent.click(getByText('monitoring.tab.manager'))
    expect(getByText('state')).toBeInTheDocument()
  })

  it('opens on the Safety tab when the device is in a fault state', () => {
    uistates_store.setObject('error', true)
    const { getByText } = render(Monitoring)
    expect(getByText('monitoring.safety.gfci')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test, verify it FAILS** — `npm test -- routes/__tests__/Monitoring` — the placeholder route has none of this.

- [ ] **Step 3: Replace `src/routes/Monitoring.svelte`** with exactly:

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import { onMount } from 'svelte'
  import { status_store } from '../lib/stores/status.js'
  import { config_store } from '../lib/stores/config.js'
  import { claims_target_store } from '../lib/stores/claims_target.js'
  import { uistates_store } from '../lib/stores/uistates.js'
  import {
    energyMetrics, sensorMetrics, serviceMetrics, vehicleMetrics,
    showVehicle, safetyData, claimRows,
  } from '../lib/monitoring/metrics.js'
  import Tabs from '../lib/components/ui/Tabs.svelte'
  import MetricsTab from '../lib/components/monitoring/MetricsTab.svelte'
  import SafetyTab from '../lib/components/monitoring/SafetyTab.svelte'
  import ManagerTab from '../lib/components/monitoring/ManagerTab.svelte'

  let activeTab = $state(0)

  let hasError = $derived(!!$uistates_store?.error)

  onMount(() => {
    if ($uistates_store?.error) activeTab = 1
  })

  let groups = $derived([
    { group: energyMetrics($status_store), expanded: true },
    { group: sensorMetrics($status_store, $config_store), expanded: false },
    ...(showVehicle($status_store, $config_store)
      ? [{ group: vehicleMetrics($status_store, $config_store), expanded: false }]
      : []),
    { group: serviceMetrics($status_store, $config_store), expanded: false },
  ])
  let safety = $derived(safetyData($status_store, hasError))
  let claims = $derived(claimRows($claims_target_store))

  let tabs = $derived([
    { label: $_('monitoring.tab.data'), alert: false },
    { label: $_('monitoring.tab.safety'), alert: hasError },
    { label: $_('monitoring.tab.manager'), alert: false },
  ])
</script>

<section class="p-4">
  <h1 class="mb-3 text-lg font-semibold text-text">{$_('screen.monitoring')}</h1>

  <Tabs {tabs} active={activeTab} onchange={(i) => (activeTab = i)} />

  <div class="mt-3">
    {#if activeTab === 0}
      <MetricsTab {groups} />
    {:else if activeTab === 1}
      <SafetyTab data={safety} />
    {:else}
      <ManagerTab rows={claims} />
    {/if}
  </div>
</section>
```

- [ ] **Step 4: Run test, verify it PASSES** — `npm test -- routes/__tests__/Monitoring`. Then full suite `npm test` — all green. If a test fails, fix the implementation (not the test) until green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(printf 'Build the Monitoring route\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
```

---

## Phase D — Verification

### Task 9: Verification

**Files:** none (verification only; the existing fixtures already carry representative values).

- [ ] **Step 1: Full suite** — `npm test`. Expected: all tests pass (271 prior + the Monitoring tests).

- [ ] **Step 2: Production build** — `npm run build`. Expected: succeeds; gzipped assets in `dist/assets/` (no plain `.js`/`.css` except `sw.js`).

- [ ] **Step 3: Report** the final test count and build result. No commit needed unless a fix was required (then commit it with an appropriate message + the Co-Authored-By trailer).

---

## Self-Review

**Spec coverage:**
- Tabbed screen Data / Safety / Manager — `Tabs` + route (Tasks 3, 8). ✓
- Data tab metric groups (energy, sensors, service, conditional vehicle), collapsible — `metrics.js` builders + `MetricGroup`/`MetricsTab` (Tasks 2, 4, 5). ✓
- Safety tab error + info counts with severity badges — `safetyData`/`countSeverity` + `SafetyTab` (Tasks 2, 6). ✓
- Manager tab claims table + empty state — `claimRows` + `ManagerTab` (Tasks 2, 7). ✓
- Safety alert dot on the tab; opens on Safety when faulted — `Tabs` alert + route `hasError`/`onMount` (Tasks 3, 8). ✓
- Temp-sensor filtering, switch-count thresholds, missing values → em-dash — `metrics.js` + `MetricRow` (Tasks 2, 4). ✓
- Read-only — no writes, no `serialQueue` anywhere. ✓
- Testing: pure logic exhaustively unit-tested; each component render-tested; route integration-tested. ✓

**Placeholder scan:** No TBD/TODO. Every step has complete code.

**Type consistency:** `metrics.js` exports (`round`, `energyMetrics`, `sensorMetrics`, `serviceMetrics`, `vehicleMetrics`, `showVehicle`, `countSeverity`, `safetyData`, `claimRows`) match their consumers in the route (Task 8). Metric-group shape `{ titleKey, rows: [{ labelKey, value, unit }] }` is consistent between `metrics.js` (Task 2), `MetricGroup`/`MetricRow` (Task 4), `MetricsTab` (Task 5). Safety-row shape `{ key, count?, state?, severity }` is consistent between `safetyData` (Task 2) and `SafetyTab` (Task 6). Claim-row shape `{ property, clientId, value }` is consistent between `claimRows` (Task 2) and `ManagerTab` (Task 7). `Tabs` props (`tabs`/`active`/`onchange`) consistent between Task 3 and Task 8. `uistates_store.setObject` is the real store method used by the test to set `error`.

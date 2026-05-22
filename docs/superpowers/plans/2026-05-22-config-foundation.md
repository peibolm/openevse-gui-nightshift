# Config Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the scaffolding for v3's Settings area — a `/settings` hub reached from a
new 5th bottom-nav item, all 18 config route keys (hub + 17 placeholder pages), the
shared form primitives and `ConfigPage` layout, and the pure config-logic modules.

**Architecture:** The hub is a pure-navigation route driven by a single page catalogue
module. Shared UI primitives are controlled (value in, event out). Pure logic —
page catalogue, validators, save-status state — lives in `src/lib/config/` and is
unit-tested. No store wiring beyond the hub; the 17 pages are `ConfigPlaceholder`
until their themed batch replaces them.

**Tech Stack:** Svelte 5 runes, Vite 8, Tailwind 4, svelte-i18n, Vitest +
@testing-library/svelte.

**Reference:** `docs/superpowers/specs/2026-05-22-config-system-design.md` (the spec).
Cited sections below are from it.

---

## File Structure

**Create — pure logic (`src/lib/config/`):**
- `src/lib/config/pages.js` — the settings page catalogue + section helper
- `src/lib/config/validate.js` — pure field validators
- `src/lib/config/saveState.js` — per-field save-status store factory
- `src/lib/config/__tests__/{pages,validate,saveState}.test.js`

**Create — UI primitives (`src/lib/components/ui/`):**
- `TextInput.svelte`, `PasswordInput.svelte`, `NumberInput.svelte`, `Textarea.svelte`

**Create — config components (`src/lib/components/config/`):**
- `ConfigPage.svelte`, `FormField.svelte`, `ReadOnlyRow.svelte`,
  `ConfigSection.svelte`, `ConfigPlaceholder.svelte`

**Create — route & tests:**
- `src/routes/Settings.svelte` (the hub)
- `src/routes/__tests__/Settings.test.js`
- `src/lib/components/config/__tests__/{ConfigPage,FormField}.test.js`

**Modify:**
- `src/lib/i18n/en.json` — add `nav.settings` + the `config` block
- `src/lib/components/shell/BottomNav.svelte` — add the 5th item
- `src/lib/routes.js` — register all 18 settings routes

**Conventions:** `Icon` lives at `src/lib/icons/Icon.svelte`. Component tests mock
svelte-i18n with the standard stub. Coverage is scoped to `src/lib/**/*.js`, so the
three `src/lib/config/*.js` modules carry full branch coverage; `.svelte` tests are
smoke + key-interaction. Commit after every green step.

---

## Task 1: Page catalogue — `src/lib/config/pages.js`

**Files:**
- Create: `src/lib/config/pages.js`
- Test: `src/lib/config/__tests__/pages.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/config/__tests__/pages.test.js
import { describe, it, expect } from 'vitest'
import { SETTINGS_PAGES, SECTIONS, pagesBySection } from '../pages.js'

describe('SETTINGS_PAGES', () => {
  it('lists all 17 config pages', () => {
    expect(SETTINGS_PAGES).toHaveLength(17)
  })
  it('every page has key, route, icon, labelKey, section', () => {
    for (const p of SETTINGS_PAGES) {
      expect(p.key).toBeTruthy()
      expect(p.route).toMatch(/^\/settings\//)
      expect(p.icon).toBeTruthy()
      expect(p.labelKey).toMatch(/^config\.pages\./)
      expect(SECTIONS).toContain(p.section)
    }
  })
  it('routes are unique', () => {
    const routes = SETTINGS_PAGES.map((p) => p.route)
    expect(new Set(routes).size).toBe(routes.length)
  })
  it('keys are unique', () => {
    const keys = SETTINGS_PAGES.map((p) => p.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('SECTIONS', () => {
  it('is the four themed sections in order', () => {
    expect(SECTIONS).toEqual(['connectivity', 'charger', 'energy', 'system'])
  })
})

describe('pagesBySection', () => {
  it('groups every page under its section, no section empty', () => {
    const grouped = pagesBySection()
    expect(grouped).toHaveLength(4)
    let total = 0
    for (const g of grouped) {
      expect(SECTIONS).toContain(g.section)
      expect(g.pages.length).toBeGreaterThan(0)
      total += g.pages.length
    }
    expect(total).toBe(17)
  })
  it('preserves section order', () => {
    expect(pagesBySection().map((g) => g.section)).toEqual(SECTIONS)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`npx vitest run src/lib/config/__tests__/pages.test.js`) — "Cannot find module".

- [ ] **Step 3: Implement**

```js
// src/lib/config/pages.js
// The single source of truth for the Settings page catalogue.
// The hub, the nav, the placeholder route, and tests all read from here.

export const SECTIONS = ['connectivity', 'charger', 'energy', 'system']

export const SETTINGS_PAGES = [
  // Connectivity
  { key: 'network', route: '/settings/network', icon: 'mdi:wifi', labelKey: 'config.pages.network', section: 'connectivity' },
  { key: 'http', route: '/settings/http', icon: 'mdi:web', labelKey: 'config.pages.http', section: 'connectivity' },
  { key: 'mqtt', route: '/settings/mqtt', icon: 'mdi:transit-connection-variant', labelKey: 'config.pages.mqtt', section: 'connectivity' },
  { key: 'ocpp', route: '/settings/ocpp', icon: 'mdi:ev-station', labelKey: 'config.pages.ocpp', section: 'connectivity' },
  // Charger
  { key: 'evse', route: '/settings/evse', icon: 'mdi:car-electric', labelKey: 'config.pages.evse', section: 'charger' },
  { key: 'safety', route: '/settings/safety', icon: 'mdi:shield-check-outline', labelKey: 'config.pages.safety', section: 'charger' },
  { key: 'time', route: '/settings/time', icon: 'mdi:clock-outline', labelKey: 'config.pages.time', section: 'charger' },
  { key: 'rfid', route: '/settings/rfid', icon: 'mdi:nfc-variant', labelKey: 'config.pages.rfid', section: 'charger' },
  { key: 'vehicle', route: '/settings/vehicle', icon: 'mdi:car', labelKey: 'config.pages.vehicle', section: 'charger' },
  // Energy
  { key: 'solar', route: '/settings/solar', icon: 'mdi:solar-power', labelKey: 'config.pages.solar', section: 'energy' },
  { key: 'shaper', route: '/settings/shaper', icon: 'mdi:chart-bell-curve', labelKey: 'config.pages.shaper', section: 'energy' },
  { key: 'emoncms', route: '/settings/emoncms', icon: 'mdi:chart-box-outline', labelKey: 'config.pages.emoncms', section: 'energy' },
  { key: 'ohmconnect', route: '/settings/ohmconnect', icon: 'mdi:flash-outline', labelKey: 'config.pages.ohmconnect', section: 'energy' },
  // System
  { key: 'firmware', route: '/settings/firmware', icon: 'mdi:chip', labelKey: 'config.pages.firmware', section: 'system' },
  { key: 'certificates', route: '/settings/certificates', icon: 'mdi:certificate-outline', labelKey: 'config.pages.certificates', section: 'system' },
  { key: 'terminal', route: '/settings/terminal', icon: 'mdi:console', labelKey: 'config.pages.terminal', section: 'system' },
  { key: 'about', route: '/settings/about', icon: 'mdi:information-outline', labelKey: 'config.pages.about', section: 'system' },
]

export function pagesBySection() {
  return SECTIONS.map((section) => ({
    section,
    pages: SETTINGS_PAGES.filter((p) => p.section === section),
  }))
}
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git add src/lib/config/pages.js src/lib/config/__tests__/pages.test.js && git commit -m "Add the Settings page catalogue"`

---

## Task 2: Field validators — `src/lib/config/validate.js`

**Files:**
- Create: `src/lib/config/validate.js`
- Test: `src/lib/config/__tests__/validate.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/config/__tests__/validate.test.js
import { describe, it, expect } from 'vitest'
import { isRequired, inRange, isPort, isHostname, isDummyPassword } from '../validate.js'

describe('isRequired', () => {
  it('fails on empty / whitespace / null / undefined', () => {
    for (const v of ['', '   ', null, undefined]) {
      expect(isRequired(v).ok).toBe(false)
      expect(isRequired(v).msgKey).toBe('config.validation.required')
    }
  })
  it('passes on a non-empty value', () => {
    expect(isRequired('x')).toEqual({ ok: true, msgKey: null })
    expect(isRequired(0).ok).toBe(true)
  })
})

describe('inRange', () => {
  it('passes inside the range, inclusive', () => {
    expect(inRange(5, 0, 10).ok).toBe(true)
    expect(inRange(0, 0, 10).ok).toBe(true)
    expect(inRange(10, 0, 10).ok).toBe(true)
  })
  it('fails outside the range or on non-numbers', () => {
    expect(inRange(11, 0, 10).ok).toBe(false)
    expect(inRange(-1, 0, 10).ok).toBe(false)
    expect(inRange('abc', 0, 10).ok).toBe(false)
    expect(inRange(5, 0, 10).msgKey).toBe(null)
    expect(inRange(11, 0, 10).msgKey).toBe('config.validation.range')
  })
})

describe('isPort', () => {
  it('passes on 1..65535 integers', () => {
    expect(isPort(1883).ok).toBe(true)
    expect(isPort('80').ok).toBe(true)
  })
  it('fails on out-of-range or non-integers', () => {
    expect(isPort(0).ok).toBe(false)
    expect(isPort(70000).ok).toBe(false)
    expect(isPort(12.5).ok).toBe(false)
    expect(isPort(70000).msgKey).toBe('config.validation.port')
  })
})

describe('isHostname', () => {
  it('passes on plain hostnames', () => {
    expect(isHostname('openevse').ok).toBe(true)
    expect(isHostname('pool.ntp.org').ok).toBe(true)
  })
  it('fails on empty or illegal characters', () => {
    expect(isHostname('').ok).toBe(false)
    expect(isHostname('bad host!').ok).toBe(false)
    expect(isHostname('bad host!').msgKey).toBe('config.validation.hostname')
  })
})

describe('isDummyPassword', () => {
  it('recognises the device password sentinels', () => {
    expect(isDummyPassword('_DUMMY_PASSWORD')).toBe(true)
    expect(isDummyPassword('••••••••••')).toBe(true)
  })
  it('is false for a real value', () => {
    expect(isDummyPassword('hunter2')).toBe(false)
    expect(isDummyPassword('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```js
// src/lib/config/validate.js
// Pure field validators. Each returns { ok, msgKey } — msgKey is an i18n key
// or null when ok. Reused by config pages for inline validation hints.

export function isRequired(v) {
  const ok = v !== undefined && v !== null && String(v).trim() !== ''
  return { ok, msgKey: ok ? null : 'config.validation.required' }
}

export function inRange(v, min, max) {
  const n = Number(v)
  const ok = Number.isFinite(n) && n >= min && n <= max
  return { ok, msgKey: ok ? null : 'config.validation.range' }
}

export function isPort(v) {
  const n = Number(v)
  const ok = Number.isInteger(n) && n >= 1 && n <= 65535
  return { ok, msgKey: ok ? null : 'config.validation.port' }
}

export function isHostname(v) {
  const ok =
    typeof v === 'string' && v.length > 0 && v.length <= 253 && /^[a-zA-Z0-9.-]+$/.test(v)
  return { ok, msgKey: ok ? null : 'config.validation.hostname' }
}

// The device reports a saved password back as a masking sentinel, never the
// real value. A field still holding a sentinel must not be re-saved.
export function isDummyPassword(v) {
  return v === '_DUMMY_PASSWORD' || v === '••••••••••'
}
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add pure config field validators"`

---

## Task 3: Save-status store — `src/lib/config/saveState.js`

The per-field save-status state (spec §6.3). A factory returning a Svelte store mapping
field name → `'saving' | 'saved' | 'error'`. Absent name = `'idle'`. `succeed()` lingers
on `'saved'` then auto-clears to `'idle'`.

**Files:**
- Create: `src/lib/config/saveState.js`
- Test: `src/lib/config/__tests__/saveState.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/config/__tests__/saveState.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { get } from 'svelte/store'
import { createSaveState, SAVED_LINGER_MS } from '../saveState.js'

describe('createSaveState', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts empty — every field is idle', () => {
    const s = createSaveState()
    expect(get(s)).toEqual({})
  })

  it('begin() marks a field saving', () => {
    const s = createSaveState()
    s.begin('hostname')
    expect(get(s).hostname).toBe('saving')
  })

  it('fail() marks a field error', () => {
    const s = createSaveState()
    s.begin('hostname')
    s.fail('hostname')
    expect(get(s).hostname).toBe('error')
  })

  it('succeed() shows saved then auto-clears to idle after the linger', () => {
    const s = createSaveState()
    s.begin('hostname')
    s.succeed('hostname')
    expect(get(s).hostname).toBe('saved')
    vi.advanceTimersByTime(SAVED_LINGER_MS)
    expect(get(s).hostname).toBe('idle')
  })

  it('a new begin() cancels a pending saved auto-clear', () => {
    const s = createSaveState()
    s.succeed('hostname')
    s.begin('hostname')
    vi.advanceTimersByTime(SAVED_LINGER_MS)
    expect(get(s).hostname).toBe('saving')
  })

  it('tracks fields independently', () => {
    const s = createSaveState()
    s.begin('a')
    s.fail('b')
    expect(get(s)).toEqual({ a: 'saving', b: 'error' })
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```js
// src/lib/config/saveState.js
// Per-field save-status state. createSaveState() returns a Svelte store
// mapping field name -> 'saving' | 'saved' | 'error'. A name absent from the
// map is 'idle'. succeed() lingers on 'saved' then auto-clears to 'idle'.
import { writable } from 'svelte/store'

export const SAVED_LINGER_MS = 2000

export function createSaveState() {
  const { subscribe, update } = writable({})
  const timers = {}

  function clearTimer(name) {
    if (timers[name]) {
      clearTimeout(timers[name])
      delete timers[name]
    }
  }
  function setStatus(name, status) {
    update((m) => ({ ...m, [name]: status }))
  }

  return {
    subscribe,
    begin(name) {
      clearTimer(name)
      setStatus(name, 'saving')
    },
    succeed(name) {
      clearTimer(name)
      setStatus(name, 'saved')
      timers[name] = setTimeout(() => {
        delete timers[name]
        setStatus(name, 'idle')
      }, SAVED_LINGER_MS)
    },
    fail(name) {
      clearTimer(name)
      setStatus(name, 'error')
    },
  }
}
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the per-field save-status store"`

---

## Task 4: `TextInput.svelte`

A controlled themed text input. Keeps a transient draft while focused so store
reactivity doesn't clobber typing; emits via `onchange` on blur. A `revert` counter
prop (incremented by the caller after a failed save) forces a resync to `value`.

**Files:**
- Create: `src/lib/components/ui/TextInput.svelte`

- [ ] **Step 1: Implement**

```svelte
<!-- src/lib/components/ui/TextInput.svelte -->
<script>
  let {
    value = '',
    placeholder = '',
    disabled = false,
    maxlength = undefined,
    revert = 0,
    onchange = () => {},
  } = $props()

  let draft = $state(value)
  let focused = $state(false)

  // Resync from the confirmed store value when not editing, and whenever the
  // caller bumps `revert` (after a failed save) — even if `value` is unchanged.
  $effect(() => {
    revert
    if (!focused) draft = value
  })

  function blur() {
    focused = false
    if (draft !== value) onchange(draft)
  }
</script>

<input
  type="text"
  {placeholder}
  {disabled}
  {maxlength}
  value={draft}
  oninput={(e) => (draft = e.currentTarget.value)}
  onfocus={() => (focused = true)}
  onblur={blur}
  class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
         placeholder:text-text-dim focus:border-accent focus:outline-none
         disabled:opacity-40"
/>
```

- [ ] **Step 2: Verify** — `npm run build` still succeeds (no test for a leaf primitive; it is exercised by FormField/page tests later). Commit — `git commit -m "Add the TextInput primitive"`

---

## Task 5: `PasswordInput.svelte`

Like `TextInput` with `type="password"` and a show/hide eye toggle. Honours the
device password sentinel: when `value` is a dummy sentinel and untouched, shows a
masked placeholder and does **not** emit a save on blur.

**Files:**
- Create: `src/lib/components/ui/PasswordInput.svelte`

- [ ] **Step 1: Implement**

```svelte
<!-- src/lib/components/ui/PasswordInput.svelte -->
<script>
  import Icon from '../../icons/Icon.svelte'
  import { isDummyPassword } from '../../config/validate.js'

  let {
    value = '',
    placeholder = '',
    disabled = false,
    maxlength = undefined,
    revert = 0,
    onchange = () => {},
  } = $props()

  let draft = $state(isDummyPassword(value) ? '' : value)
  let focused = $state(false)
  let show = $state(false)

  $effect(() => {
    revert
    if (!focused) draft = isDummyPassword(value) ? '' : value
  })

  function blur() {
    focused = false
    // Empty draft on a field that still holds the device sentinel = untouched.
    if (draft === '' && isDummyPassword(value)) return
    if (draft !== value) onchange(draft)
  }
</script>

<div class="relative">
  <input
    type={show ? 'text' : 'password'}
    placeholder={isDummyPassword(value) ? '••••••••••' : placeholder}
    {disabled}
    {maxlength}
    value={draft}
    oninput={(e) => (draft = e.currentTarget.value)}
    onfocus={() => (focused = true)}
    onblur={blur}
    class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 pr-10 text-sm
           text-text placeholder:text-text-dim focus:border-accent focus:outline-none
           disabled:opacity-40"
  />
  <button
    type="button"
    aria-label={show ? 'hide' : 'show'}
    onclick={() => (show = !show)}
    class="absolute inset-y-0 right-0 grid w-10 place-items-center text-text-dim"
  >
    <Icon icon={show ? 'mdi:eye-off-outline' : 'mdi:eye-outline'} size={18} />
  </button>
</div>
```

- [ ] **Step 2: Verify** `npm run build`. Commit — `git commit -m "Add the PasswordInput primitive"`

---

## Task 6: `NumberInput.svelte`

Controlled numeric input. Emits a **Number** (not a string) via `onchange` on blur /
change. Empty input emits `null`.

**Files:**
- Create: `src/lib/components/ui/NumberInput.svelte`

- [ ] **Step 1: Implement**

```svelte
<!-- src/lib/components/ui/NumberInput.svelte -->
<script>
  let {
    value = null,
    min = undefined,
    max = undefined,
    step = 1,
    placeholder = '',
    disabled = false,
    revert = 0,
    onchange = () => {},
  } = $props()

  let draft = $state(value ?? '')
  let focused = $state(false)

  $effect(() => {
    revert
    if (!focused) draft = value ?? ''
  })

  function emit() {
    focused = false
    const next = draft === '' ? null : Number(draft)
    if (next !== value) onchange(next)
  }
</script>

<input
  type="number"
  {min}
  {max}
  {step}
  {placeholder}
  {disabled}
  value={draft}
  oninput={(e) => (draft = e.currentTarget.value)}
  onfocus={() => (focused = true)}
  onblur={emit}
  class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
         placeholder:text-text-dim focus:border-accent focus:outline-none
         disabled:opacity-40"
/>
```

- [ ] **Step 2: Verify** `npm run build`. Commit — `git commit -m "Add the NumberInput primitive"`

---

## Task 7: `Textarea.svelte`

Controlled multi-line input for the Certificates modal. Emits on `change`.

**Files:**
- Create: `src/lib/components/ui/Textarea.svelte`

- [ ] **Step 1: Implement**

```svelte
<!-- src/lib/components/ui/Textarea.svelte -->
<script>
  let {
    value = '',
    placeholder = '',
    rows = 4,
    disabled = false,
    monospace = false,
    onchange = () => {},
  } = $props()
</script>

<textarea
  {placeholder}
  {rows}
  {disabled}
  {value}
  onchange={(e) => onchange(e.currentTarget.value)}
  class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
         placeholder:text-text-dim focus:border-accent focus:outline-none
         disabled:opacity-40 {monospace ? 'font-mono text-xs' : ''}"
></textarea>
```

- [ ] **Step 2: Verify** `npm run build`. Commit — `git commit -m "Add the Textarea primitive"`

---

## Task 8: `ConfigPage.svelte`

The page shell every config route renders inside (spec §5.2): a back-to-hub link, the
title, and the slotted content. Optional `loading` shows a `Loader`-style spinner.

**Files:**
- Create: `src/lib/components/config/ConfigPage.svelte`
- Test: `src/lib/components/config/__tests__/ConfigPage.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/components/config/__tests__/ConfigPage.test.js
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'

import { vi } from 'vitest'
vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ConfigPage from '../ConfigPage.svelte'

const body = createRawSnippet(() => ({ render: () => `<p>page body</p>` }))

describe('ConfigPage', () => {
  it('renders the title and a back link to the hub', () => {
    const { getByText, getByRole } = render(ConfigPage, { title: 'Network', children: body })
    expect(getByText('Network')).toBeInTheDocument()
    expect(getByRole('link')).toHaveAttribute('href', '#/settings')
  })
  it('renders slotted content', () => {
    const { getByText } = render(ConfigPage, { title: 'Network', children: body })
    expect(getByText('page body')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`npx vitest run src/lib/components/config/__tests__/ConfigPage.test.js`).

- [ ] **Step 3: Implement**

```svelte
<!-- src/lib/components/config/ConfigPage.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import Icon from '../../icons/Icon.svelte'

  let { title = '', loading = false, children } = $props()
</script>

<section class="p-4">
  <a
    href="#/settings"
    class="mb-3 inline-flex items-center gap-1 text-sm text-text-dim hover:text-text"
  >
    <Icon icon="mdi:chevron-left" size={18} />
    <span>{$_('config.back')}</span>
  </a>
  <h1 class="mb-4 text-lg font-semibold text-text">{title}</h1>

  {#if loading}
    <div class="flex justify-center py-10">
      <Icon icon="mdi:loading" size={28} class="animate-spin text-text-dim" />
    </div>
  {:else}
    {@render children?.()}
  {/if}
</section>
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the ConfigPage layout"`

---

## Task 9: `FormField.svelte`

A labelled row wrapping one control, with an inline save-status indicator (spec §5.2,
§6.3).

**Files:**
- Create: `src/lib/components/config/FormField.svelte`
- Test: `src/lib/components/config/__tests__/FormField.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/components/config/__tests__/FormField.test.js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'
import { createRawSnippet } from 'svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import FormField from '../FormField.svelte'

const control = createRawSnippet(() => ({ render: () => `<input data-testid="ctl" />` }))

describe('FormField', () => {
  it('renders the label, description and slotted control', () => {
    const { getByText, getByTestId } = render(FormField, {
      label: 'Hostname',
      description: 'The device name on the network',
      children: control,
    })
    expect(getByText('Hostname')).toBeInTheDocument()
    expect(getByText('The device name on the network')).toBeInTheDocument()
    expect(getByTestId('ctl')).toBeInTheDocument()
  })
  it('shows a saving spinner when status is saving', () => {
    const { container } = render(FormField, { label: 'X', status: 'saving', children: control })
    expect(container.querySelector('iconify-icon[icon="mdi:loading"]')).toBeTruthy()
  })
  it('shows a check when status is saved', () => {
    const { container } = render(FormField, { label: 'X', status: 'saved', children: control })
    expect(container.querySelector('iconify-icon[icon="mdi:check"]')).toBeTruthy()
  })
  it('shows an error icon when status is error', () => {
    const { container } = render(FormField, { label: 'X', status: 'error', children: control })
    expect(container.querySelector('iconify-icon[icon="mdi:alert-circle-outline"]')).toBeTruthy()
  })
  it('shows no status icon when idle', () => {
    const { container } = render(FormField, { label: 'X', status: 'idle', children: control })
    expect(container.querySelector('iconify-icon')).toBeFalsy()
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/lib/components/config/FormField.svelte -->
<script>
  import Icon from '../../icons/Icon.svelte'

  let { label = '', description = '', status = 'idle', children } = $props()
</script>

<div class="py-3">
  <div class="flex items-center justify-between gap-3">
    <span class="text-sm text-text">{label}</span>
    {#if status === 'saving'}
      <Icon icon="mdi:loading" size={16} class="animate-spin text-text-dim" />
    {:else if status === 'saved'}
      <Icon icon="mdi:check" size={16} class="text-accent" />
    {:else if status === 'error'}
      <Icon icon="mdi:alert-circle-outline" size={16} class="text-error" />
    {/if}
  </div>
  <div class="mt-1.5">{@render children?.()}</div>
  {#if description}
    <p class="mt-1 text-xs text-text-dim">{description}</p>
  {/if}
</div>
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the FormField row component"`

---

## Task 10: `ReadOnlyRow.svelte` and `ConfigSection.svelte`

Two small presentational components. `ReadOnlyRow` is a label/value row for device
info; `ConfigSection` is a titled `Card` grouping fields.

**Files:**
- Create: `src/lib/components/config/ReadOnlyRow.svelte`
- Create: `src/lib/components/config/ConfigSection.svelte`

- [ ] **Step 1: Implement `ReadOnlyRow.svelte`**

```svelte
<!-- src/lib/components/config/ReadOnlyRow.svelte -->
<script>
  let { label = '', value = '', tone = 'default' } = $props()

  const tones = {
    default: 'text-text',
    ok: 'text-accent',
    warn: 'text-warning',
    error: 'text-error',
  }
  let display = $derived(value === undefined || value === null || value === '' ? '—' : value)
</script>

<div class="flex items-center justify-between gap-3 py-2 text-sm">
  <span class="text-text-dim">{label}</span>
  <span class="font-medium {tones[tone] ?? tones.default}">{display}</span>
</div>
```

- [ ] **Step 2: Implement `ConfigSection.svelte`**

```svelte
<!-- src/lib/components/config/ConfigSection.svelte -->
<script>
  import Card from '../ui/Card.svelte'
  let { title = '', children } = $props()
</script>

<Card class="mb-4">
  {#if title}
    <h2 class="mb-1 text-sm font-semibold text-text-dim">{title}</h2>
  {/if}
  {@render children?.()}
</Card>
```

- [ ] **Step 3: Verify** `npm run build`. Commit — `git commit -m "Add ReadOnlyRow and ConfigSection components"`

---

## Task 11: `ConfigPlaceholder.svelte`

The temporary route component for the 16 not-yet-built pages. It is route-aware: it
reads `$currentPath`, finds the matching page in the catalogue, and renders a
"coming soon" `ConfigPage`.

**Files:**
- Create: `src/lib/components/config/ConfigPlaceholder.svelte`

- [ ] **Step 1: Implement**

```svelte
<!-- src/lib/components/config/ConfigPlaceholder.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { currentPath } from '../../router.js'
  import { SETTINGS_PAGES } from '../../config/pages.js'
  import ConfigPage from './ConfigPage.svelte'

  let page = $derived(SETTINGS_PAGES.find((p) => p.route === $currentPath))
  let title = $derived(page ? $_(page.labelKey) : $_('config.title'))
</script>

<ConfigPage {title}>
  <p class="text-sm text-text-dim">{$_('config.coming_soon')}</p>
</ConfigPage>
```

- [ ] **Step 2: Verify** `npm run build`. Commit — `git commit -m "Add the ConfigPlaceholder route component"`

---

## Task 12: i18n — `nav.settings` + the `config` block

Extend `src/lib/i18n/en.json`. **Merge** into the existing `config` object (which
already has `config.network.con-ok`) and the existing `nav` object — do not clobber.

**Files:**
- Modify: `src/lib/i18n/en.json`

- [ ] **Step 1: Add `"settings": "Settings"` to the existing `nav` object.**

- [ ] **Step 2: Extend the existing `config` object** so it reads:

```json
"config": {
  "network": {
    "con-ok": "Connected — new address: "
  },
  "title": "Settings",
  "back": "Settings",
  "coming_soon": "This page is coming soon.",
  "sections": {
    "connectivity": "Connectivity",
    "charger": "Charger",
    "energy": "Energy",
    "system": "System"
  },
  "pages": {
    "network": "Network",
    "http": "HTTP",
    "mqtt": "MQTT",
    "ocpp": "OCPP",
    "evse": "Charger",
    "safety": "Safety",
    "time": "Time & Date",
    "rfid": "RFID",
    "vehicle": "Vehicle",
    "solar": "Self-production",
    "shaper": "Load Shaper",
    "emoncms": "EmonCMS",
    "ohmconnect": "OhmConnect",
    "firmware": "Firmware",
    "certificates": "Certificates",
    "terminal": "Terminal",
    "about": "About"
  },
  "validation": {
    "required": "Required",
    "range": "Out of range",
    "port": "Enter a port between 1 and 65535",
    "hostname": "Invalid hostname"
  }
}
```

- [ ] **Step 3: Verify** the file is valid JSON — `node -e "JSON.parse(require('fs').readFileSync('src/lib/i18n/en.json','utf8'))"` prints nothing and exits 0. Run `npm test` — still green.
- [ ] **Step 4: Commit** — `git commit -m "Add Settings i18n strings"`

---

## Task 13: BottomNav — 5th "Settings" item

**Files:**
- Modify: `src/lib/components/shell/BottomNav.svelte`

- [ ] **Step 1: Add the 5th item** to the `items` array, after `history`:

```js
{ href: '/settings', key: 'nav.settings', icon: 'mdi:cog-outline' },
```

- [ ] **Step 2: Verify** — `npm test` green; `npm run build` succeeds.
- [ ] **Step 3: Commit** — `git commit -m "Add the Settings item to the bottom nav"`

---

## Task 14: The Settings hub + route registration

The `/settings` hub route (grouped section cards, spec §4) and registration of all 18
settings route keys in `src/lib/routes.js`.

**Files:**
- Create: `src/routes/Settings.svelte`
- Modify: `src/lib/routes.js`
- Test: `src/routes/__tests__/Settings.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/__tests__/Settings.test.js
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import Settings from '../Settings.svelte'
import { SETTINGS_PAGES } from '../../lib/config/pages.js'

describe('Settings hub', () => {
  it('renders the four section headings', () => {
    const { getByText } = render(Settings)
    for (const s of ['connectivity', 'charger', 'energy', 'system']) {
      expect(getByText('config.sections.' + s)).toBeInTheDocument()
    }
  })
  it('renders a link for every config page', () => {
    const { getAllByRole } = render(Settings)
    const links = getAllByRole('link')
    expect(links).toHaveLength(SETTINGS_PAGES.length)
    for (const p of SETTINGS_PAGES) {
      expect(links.some((l) => l.getAttribute('href') === '#' + p.route)).toBe(true)
    }
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement `src/routes/Settings.svelte`**

```svelte
<!-- src/routes/Settings.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import Card from '../lib/components/ui/Card.svelte'
  import Icon from '../lib/icons/Icon.svelte'
  import { pagesBySection } from '../lib/config/pages.js'

  const groups = pagesBySection()
</script>

<section class="p-4">
  <h1 class="mb-4 text-lg font-semibold text-text">{$_('config.title')}</h1>

  {#each groups as group}
    <Card class="mb-4">
      <h2 class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
        {$_('config.sections.' + group.section)}
      </h2>
      <ul class="divide-y divide-border">
        {#each group.pages as page}
          <li>
            <a
              href="#{page.route}"
              class="flex items-center gap-3 py-3 text-text hover:text-accent"
            >
              <Icon icon={page.icon} size={20} class="text-text-dim" />
              <span class="flex-1 text-sm">{$_(page.labelKey)}</span>
              <Icon icon="mdi:chevron-right" size={18} class="text-text-dim" />
            </a>
          </li>
        {/each}
      </ul>
    </Card>
  {/each}
</section>
```

- [ ] **Step 4: Run the test — expect PASS.**

- [ ] **Step 5: Register routes** — rewrite `src/lib/routes.js`:

```js
import Dashboard from '../routes/Dashboard.svelte'
import Schedule from '../routes/Schedule.svelte'
import Monitoring from '../routes/Monitoring.svelte'
import History from '../routes/History.svelte'
import Settings from '../routes/Settings.svelte'
import NotFound from '../routes/NotFound.svelte'
import ConfigPlaceholder from './components/config/ConfigPlaceholder.svelte'
import { SETTINGS_PAGES } from './config/pages.js'

export const routes = {
  '/': Dashboard,
  '/schedule': Schedule,
  '/monitoring': Monitoring,
  '/history': History,
  '/settings': Settings,
}

// Every config page is a static, exact-match route. Until a themed batch
// builds a page, its route resolves to the ConfigPlaceholder.
for (const page of SETTINGS_PAGES) {
  routes[page.route] = ConfigPlaceholder
}

export { NotFound }
```

- [ ] **Step 6: Verify** — `npm test` green; `npm run build` succeeds with gzipped assets.
- [ ] **Step 7: Commit** — `git commit -m "Add the Settings hub and register config routes"`

---

## Verification gate (before merge)

- [ ] `npm test` — all tests pass (≥ 332 + the new tests).
- [ ] `npm run build` — succeeds; all `dist/assets` JS/CSS gzipped (except `sw.js`).
- [ ] Playwright visual check — `npm run dev:mock`, then drive a script that visits
      `/#/settings` and `/#/settings/network` (a placeholder). Confirm the hub shows
      four section cards with page links, the placeholder shows "coming soon", the new
      bottom-nav Settings item is present and highlights on `/settings`, and there are
      no console/page errors.

## On completion

Hand off to `superpowers:finishing-a-development-branch` to merge `config-foundation`
to `main`. Then proceed to the Connectivity batch.

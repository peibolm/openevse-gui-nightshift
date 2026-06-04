# Charging-Page Controls Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's separate Mode pill + floating Eco/Shaper toggle row with one unified control panel — a segmented mode control (`Off · Auto · Eco · On`) plus a Shaper/Boost modifier row.

**Architecture:** A pure helper module (`src/lib/dashboard/controls.js`) computes the segment list and the selected segment from device state. A new presentational component (`ChargeControls.svelte`) renders the segmented control, the modifier row (reusing `BoostButton`), and the locked-state box. `Dashboard.svelte` owns all device writes via a new `setSegment` handler and the existing `setShaper`/`boost`/`cancelBoost`. The standalone `ModePill` is removed from the hero (ring overlay + chart top row); `EcoShaperToggles` and `ModePill` are deleted.

**Tech Stack:** Svelte 5 (runes: `$props`, `$state`, `$derived`), Vitest + @testing-library/svelte, Tailwind, svelte-i18n. Device API via `httpAPI`/`override_store` through `serialQueue`.

---

## Background the engineer needs

- **Mode model:** `uistates_store.mode` is `0`=Auto, `1`=On, `2`=Off (set by `DataManager.svelte` `getMode`). `status_store.divertmode` is `2` when Eco/divert is active, else `1`. The dashboard already derives `ecoOn = $status_store?.divertmode === 2 && mode === 0`.
- **Mode writes (existing `setMode` in `Dashboard.svelte`):** Auto = `override_store.clear()`; On = `override_store.upload({state:'active', charge_current, auto_release:false})`; Off = same with `state:'disabled'`. `charge_current` defaults to `$override_store?.charge_current ?? $config_store?.max_current_soft`.
- **Eco write (existing `setEco`):** `httpAPI('POST', '/divertmode', 'divertmode=2'|'divertmode=1', 'text')`.
- **Shaper write (existing `setShaper(on)`, KEEP):** `httpAPI('POST', '/shaper', 'shaper=1'|'shaper=0', 'text')`. Reflects `uistates_store.shaper` → dashboard `shaperOn`.
- **Locked state:** `Dashboard.svelte` derives `modeLocked` (true when an OCPP/RFID/Limit claim owns charging) and `modeLockLabel` (`'OCPP'|'RFID'|'LIMIT'`).
- **Boost (existing, KEEP logic):** `boost(minutes)`, `cancelBoost()`, and `boostEndsAt` ($state ms-epoch) live in `Dashboard.svelte`. `BoostButton.svelte` is a pure display: idle opens a 15/30/60 preset modal; active shows "Boosting · MM:SS" + Cancel.
- **Coverage:** scoped to `src/lib/**/*.js`. `.svelte` files are outside coverage but have component tests in `__tests__/` that mock `svelte-i18n` so `$_(k)` returns `k`. The i18n parity test `src/lib/i18n/__tests__/locale-parity.test.js` requires identical key paths across en/es/fr/hu.
- **Test commands:** single file `npx vitest run <path>`; by name `npx vitest run -t "<name>"`; full suite `npm test`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/dashboard/controls.js` | **New.** Pure helpers: `controlSegments(divertEnabled)` → ordered segment keys; `selectedSegment({mode, divertmode, divertEnabled})` → current key. In coverage. |
| `src/lib/dashboard/__tests__/controls.test.js` | **New.** Unit tests for the two helpers. |
| `src/lib/i18n/{en,es,fr,hu}.json` | Add `dashboard.controls.locked_by`. |
| `src/lib/components/dashboard/ChargeControls.svelte` | **New.** Segmented mode control + modifier row (`BoostButton` + Shaper toggle) + locked box. Pure presentational; callbacks only. |
| `src/lib/components/dashboard/__tests__/ChargeControls.test.js` | **New.** Component test. |
| `src/lib/components/dashboard/BoostButton.svelte` | Remove the hardcoded `mt-3` wrapper so it aligns inside the modifier grid (spacing owned by parent). |
| `src/routes/Dashboard.svelte` | Add `setSegment`; derive `chargeSegment`; render `ChargeControls` in place of `EcoShaperToggles` + `BoostButton`; remove `ModePill` from the ring overlay; drop unused `setMode`/`setEco`. |
| `src/lib/components/dashboard/ChargingHero.svelte` | Remove `ModePill` from the chart top row + its now-unused props. |
| `src/lib/components/dashboard/EcoShaperToggles.svelte` (+ test) | **Delete.** |
| `src/lib/components/dashboard/ModePill.svelte` (+ test) | **Delete** (no importers after the changes above). |

---

## Task 1: Pure segment helpers

**Files:**
- Create: `src/lib/dashboard/controls.js`
- Test: `src/lib/dashboard/__tests__/controls.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/dashboard/__tests__/controls.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { controlSegments, selectedSegment } from '../controls.js'

describe('controlSegments', () => {
  it('includes the eco segment when divert is enabled', () => {
    expect(controlSegments(true)).toEqual(['off', 'auto', 'eco', 'on'])
  })
  it('omits the eco segment when divert is disabled', () => {
    expect(controlSegments(false)).toEqual(['off', 'auto', 'on'])
  })
})

describe('selectedSegment', () => {
  it('returns "on" when the manual override is active (mode 1)', () => {
    expect(selectedSegment({ mode: 1, divertmode: 1, divertEnabled: true })).toBe('on')
  })
  it('returns "off" when the manual override is disabled (mode 2)', () => {
    expect(selectedSegment({ mode: 2, divertmode: 2, divertEnabled: true })).toBe('off')
  })
  it('returns "eco" in auto when divert is enabled and active', () => {
    expect(selectedSegment({ mode: 0, divertmode: 2, divertEnabled: true })).toBe('eco')
  })
  it('returns "auto" in auto when divert is inactive', () => {
    expect(selectedSegment({ mode: 0, divertmode: 1, divertEnabled: true })).toBe('auto')
  })
  it('never returns "eco" when divert is disabled, even if divertmode is 2', () => {
    expect(selectedSegment({ mode: 0, divertmode: 2, divertEnabled: false })).toBe('auto')
  })
  it('treats missing mode/divertmode as auto', () => {
    expect(selectedSegment({})).toBe('auto')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/dashboard/__tests__/controls.test.js`
Expected: FAIL — `controls.js` does not exist / `controlSegments is not a function`.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/dashboard/controls.js`:

```js
// Charge-mode control helpers. Pure — no stores, no i18n, no DOM.
//
// mode: uistates_store.mode — 0=Auto, 1=On (override active), 2=Off (override disabled).
// divertmode: status_store.divertmode — 2 when Eco/divert is active, else 1.

// Segment keys in display order. Eco only appears when divert is enabled in config,
// so non-solar setups get a three-segment control.
export function controlSegments(divertEnabled) {
  return divertEnabled ? ['off', 'auto', 'eco', 'on'] : ['off', 'auto', 'on']
}

// Which segment is currently selected, derived from device state.
export function selectedSegment({ mode, divertmode, divertEnabled } = {}) {
  if (mode === 1) return 'on'
  if (mode === 2) return 'off'
  // Auto: Eco only when divert is both enabled and active.
  if (divertEnabled && divertmode === 2) return 'eco'
  return 'auto'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/dashboard/__tests__/controls.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dashboard/controls.js src/lib/dashboard/__tests__/controls.test.js
git commit -m "feat: add charge-mode segment helpers"
```

---

## Task 2: i18n key for the locked-state label

**Files:**
- Modify: `src/lib/i18n/en.json`, `src/lib/i18n/es.json`, `src/lib/i18n/fr.json`, `src/lib/i18n/hu.json`
- Test: `src/lib/i18n/__tests__/locale-parity.test.js` (existing — must stay green)

- [ ] **Step 1: Add the key to all four locales**

In each file, find the `"dashboard"` object and add a `"controls"` child (place it alphabetically near `"boost"`, or anywhere inside `dashboard` — key path is what matters). The interpolation placeholder `{owner}` must be present in all four.

`en.json`:
```json
    "controls": {
      "locked_by": "Controlled by {owner}"
    },
```

`es.json`:
```json
    "controls": {
      "locked_by": "Controlado por {owner}"
    },
```

`fr.json`:
```json
    "controls": {
      "locked_by": "Contrôlé par {owner}"
    },
```

`hu.json`:
```json
    "controls": {
      "locked_by": "Vezérli: {owner}"
    },
```

- [ ] **Step 2: Run the parity test**

Run: `npx vitest run src/lib/i18n/__tests__/locale-parity.test.js`
Expected: PASS — identical key paths and matching `{owner}` placeholder across en/es/fr/hu.

- [ ] **Step 3: Commit**

```bash
git add src/lib/i18n/en.json src/lib/i18n/es.json src/lib/i18n/fr.json src/lib/i18n/hu.json
git commit -m "i18n: add dashboard.controls.locked_by"
```

---

## Task 3: ChargeControls component

**Files:**
- Create: `src/lib/components/dashboard/ChargeControls.svelte`
- Test: `src/lib/components/dashboard/__tests__/ChargeControls.test.js`

Depends on Task 1 (`controls.js`) and Task 4 (BoostButton `mt-3` removal is cosmetic; this task can land first — the component imports `BoostButton` regardless).

- [ ] **Step 1: Write the failing component test**

Create `src/lib/components/dashboard/__tests__/ChargeControls.test.js`:

```js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent, cleanup } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k, opts) => (opts?.values ? k + ':' + JSON.stringify(opts.values) : k)
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import ChargeControls from '../ChargeControls.svelte'

const base = {
  segment: 'auto', divertEnabled: true, shaperEnabled: true,
  shaperOn: false, locked: false, lockLabel: '', disabled: false, boostEndsAt: null,
}

describe('ChargeControls', () => {
  it('renders four segments when divert is enabled', () => {
    const { getByText } = render(ChargeControls, { props: { ...base } })
    for (const label of ['dashboard.mode.off', 'dashboard.mode.auto', 'dashboard.eco', 'dashboard.mode.on'])
      expect(getByText(label)).toBeInTheDocument()
  })

  it('omits the eco segment when divert is disabled', () => {
    const { queryByText } = render(ChargeControls, { props: { ...base, divertEnabled: false } })
    expect(queryByText('dashboard.eco')).not.toBeInTheDocument()
  })

  it('marks the selected segment with aria-checked', () => {
    const { getByText } = render(ChargeControls, { props: { ...base, segment: 'eco' } })
    expect(getByText('dashboard.eco').getAttribute('aria-checked')).toBe('true')
    expect(getByText('dashboard.mode.auto').getAttribute('aria-checked')).toBe('false')
  })

  it('emits onsegment with the clicked segment key', async () => {
    const onsegment = vi.fn()
    const { getByText } = render(ChargeControls, { props: { ...base, onsegment } })
    await fireEvent.click(getByText('dashboard.mode.on'))
    expect(onsegment).toHaveBeenCalledWith('on')
  })

  it('shows the locked box and hides the segments when locked', () => {
    const { getByText, queryByText } = render(ChargeControls, {
      props: { ...base, locked: true, lockLabel: 'OCPP' },
    })
    expect(getByText('dashboard.controls.locked_by:{"owner":"OCPP"}')).toBeInTheDocument()
    expect(queryByText('dashboard.mode.auto')).not.toBeInTheDocument()
  })

  it('renders the shaper toggle only when shaper is enabled', () => {
    const on = render(ChargeControls, { props: { ...base } })
    expect(on.getByLabelText('dashboard.shaper')).toBeInTheDocument()
    cleanup()
    const off = render(ChargeControls, { props: { ...base, shaperEnabled: false } })
    expect(off.queryByLabelText('dashboard.shaper')).not.toBeInTheDocument()
  })

  it('emits onshaper with the toggled value', async () => {
    const onshaper = vi.fn()
    const { getByLabelText } = render(ChargeControls, { props: { ...base, shaperOn: false, onshaper } })
    await fireEvent.click(getByLabelText('dashboard.shaper'))
    expect(onshaper).toHaveBeenCalledWith(true)
  })

  it('disables the segment buttons when disabled', () => {
    const { getByText } = render(ChargeControls, { props: { ...base, disabled: true } })
    expect(getByText('dashboard.mode.auto')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/dashboard/__tests__/ChargeControls.test.js`
Expected: FAIL — `ChargeControls.svelte` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/dashboard/ChargeControls.svelte`:

```svelte
<script>
  import { _ } from 'svelte-i18n'
  import BoostButton from './BoostButton.svelte'
  import { controlSegments } from '../../dashboard/controls.js'

  let {
    segment = 'auto',
    divertEnabled = false,
    shaperEnabled = false,
    shaperOn = false,
    locked = false,
    lockLabel = '',
    disabled = false,
    boostEndsAt = null,
    onsegment = () => {},
    onshaper = () => {},
    onboost = () => {},
    oncancelboost = () => {},
  } = $props()

  const SEG_LABELS = {
    off: 'dashboard.mode.off',
    auto: 'dashboard.mode.auto',
    eco: 'dashboard.eco',
    on: 'dashboard.mode.on',
  }

  let segments = $derived(controlSegments(divertEnabled))
  // Layout-only: an active boost takes the full row width. Parent clears
  // boostEndsAt when the boost ends, so a plain truthy check is enough.
  let boostActive = $derived(!!boostEndsAt)

  // Shared shape so the Shaper toggle and the Boost button line up.
  const MOD_BTN =
    'w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ' +
    'disabled:opacity-40 disabled:cursor-not-allowed border'
</script>

<div class="mt-3 space-y-2">
  {#if locked}
    <div class="grid place-items-center rounded-xl border border-dashed border-border
                px-4 py-3 text-[13px] font-semibold text-text-dim">
      {$_('dashboard.controls.locked_by', { values: { owner: lockLabel } })}
    </div>
  {:else}
    <div role="radiogroup" aria-label={$_('dashboard.mode.aria')}
         class="flex gap-1 rounded-xl border border-border bg-surface-2 p-1">
      {#each segments as seg}
        <button
          type="button"
          role="radio"
          aria-checked={segment === seg}
          {disabled}
          onclick={() => onsegment(seg)}
          class="flex-1 rounded-lg py-2.5 text-[13px] font-semibold transition
                 disabled:cursor-not-allowed disabled:opacity-40
                 {segment === seg
                   ? 'bg-accent text-surface shadow-[var(--accent-glow)]'
                   : 'text-text-dim'}"
        >
          {$_(SEG_LABELS[seg])}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Modifier row. Idle: two-up grid (Shaper + Boost). Active boost: Shaper on
       its own full-width row above the boost countdown card. -->
  {#if boostActive}
    {#if shaperEnabled}
      <button
        type="button"
        role="switch"
        aria-checked={shaperOn}
        aria-label={$_('dashboard.shaper')}
        disabled={disabled || locked}
        onclick={() => onshaper(!shaperOn)}
        class="{MOD_BTN} {shaperOn
          ? 'border-accent text-accent shadow-[var(--accent-glow)]'
          : 'border-border text-text'}"
      >
        {$_('dashboard.shaper')}
      </button>
    {/if}
    <BoostButton disabled={disabled || locked} endsAt={boostEndsAt} onboost={onboost} oncancel={oncancelboost} />
  {:else}
    <div class="grid gap-2 {shaperEnabled ? 'grid-cols-2' : 'grid-cols-1'}">
      {#if shaperEnabled}
        <button
          type="button"
          role="switch"
          aria-checked={shaperOn}
          aria-label={$_('dashboard.shaper')}
          disabled={disabled || locked}
          onclick={() => onshaper(!shaperOn)}
          class="{MOD_BTN} {shaperOn
            ? 'border-accent text-accent shadow-[var(--accent-glow)]'
            : 'border-border text-text'}"
        >
          {$_('dashboard.shaper')}
        </button>
      {/if}
      <BoostButton disabled={disabled || locked} endsAt={boostEndsAt} onboost={onboost} oncancel={oncancelboost} />
    </div>
  {/if}
</div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/components/dashboard/__tests__/ChargeControls.test.js`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/dashboard/ChargeControls.svelte src/lib/components/dashboard/__tests__/ChargeControls.test.js
git commit -m "feat: add ChargeControls dashboard panel"
```

---

## Task 4: Align BoostButton inside the modifier grid

**Files:**
- Modify: `src/lib/components/dashboard/BoostButton.svelte` (the root wrapper)
- Test: `src/lib/components/dashboard/__tests__/BoostButton.test.js` (existing — must stay green)

The component hardcodes a `mt-3` top margin on its root `<div>`. Inside `ChargeControls`'s grid that misaligns the cell; spacing is now owned by the parent (`space-y-2` / `gap-2`).

- [ ] **Step 1: Remove the top-margin wrapper**

In `src/lib/components/dashboard/BoostButton.svelte`, change the root element:

```svelte
<div class="mt-3">
```
to:
```svelte
<div>
```

(Only that one wrapper `<div>` opening tag — the `{#if active}` / `{:else}` contents are unchanged.)

- [ ] **Step 2: Run the existing BoostButton test**

Run: `npx vitest run src/lib/components/dashboard/__tests__/BoostButton.test.js`
Expected: PASS — behavior (idle button, active countdown, modal, callbacks) is unchanged; only a layout class was removed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/dashboard/BoostButton.svelte
git commit -m "refactor: let parent own BoostButton spacing"
```

---

## Task 5: Wire ChargeControls into the Dashboard

**Files:**
- Modify: `src/routes/Dashboard.svelte`

This swaps the controls, adds the `setSegment` handler, derives the selected segment, and removes the now-dead `ModePill` overlay and `setMode`/`setEco` functions. Keep `setShaper`, `boost`, `cancelBoost`, `boostEndsAt`, and the `ecoOn` derived (still used for `rateDisabled`).

- [ ] **Step 1: Update imports**

In the import block near the top:
- Add: `import { selectedSegment } from '../lib/dashboard/controls.js'`
- Add: `import ChargeControls from '../lib/components/dashboard/ChargeControls.svelte'`
- Remove: `import ModePill from '../lib/components/dashboard/ModePill.svelte'`
- Remove: `import EcoShaperToggles from '../lib/components/dashboard/EcoShaperToggles.svelte'`
- Remove: `import BoostButton from '../lib/components/dashboard/BoostButton.svelte'`

(`ChargingHero` still imports `ModePill` at this point; Task 6 removes that. The `ModePill` *file* is deleted in Task 7.)

- [ ] **Step 2: Add the derived selected segment**

Next to the existing `showEco`/`showShaper`/`ecoOn`/`shaperOn` derivations, add:

```js
  let chargeSegment = $derived(
    selectedSegment({
      mode,
      divertmode: $status_store?.divertmode,
      divertEnabled: !!$config_store?.divert_enabled,
    }),
  )
```

- [ ] **Step 3: Replace `setMode` and `setEco` with `setSegment`**

Delete the entire `async function setMode(m) { ... }` and `async function setEco(on) { ... }` functions. Add in their place:

```js
  async function setSegment(seg) {
    if (busy) return
    busy = true
    try {
      let ok = true
      if (seg === 'on' || seg === 'off') {
        const cur = $override_store?.charge_current
        const data = {
          state: seg === 'on' ? 'active' : 'disabled',
          charge_current: cur ?? $config_store?.max_current_soft,
          auto_release: false,
        }
        ok = await serialQueue.add(() => override_store.upload(data))
      } else {
        // 'auto' or 'eco': release the manual override, then set the divert
        // state explicitly so we land on the intended segment regardless of
        // the prior divertmode (On→Auto must turn divert off; On→Eco must turn it on).
        ok = await serialQueue.add(() => override_store.clear())
        const dm = seg === 'eco' ? 2 : 1
        const res = await serialQueue.add(() =>
          httpAPI('POST', '/divertmode', `divertmode=${dm}`, 'text'),
        )
        if (res === 'error') ok = false
      }
      if (!ok) showWriteError()
    } finally {
      busy = false
    }
  }
```

(`setChargeAmps`, `setShaper`, `boost`, `cancelBoost`, `restoreFromBoost` are untouched.)

- [ ] **Step 4: Remove the ModePill overlay from the ring variant**

In the `{:else}` (non-chart) hero branch, delete the mode-pill overlay block:

```svelte
        <div class="absolute left-3 top-1 z-10">
          <ModePill
            {mode}
            locked={modeLocked}
            lockLabel={modeLockLabel}
            disabled={busy || display === 'error'}
            onmode={setMode}
          />
        </div>
```

Leave the `RatePill` overlay (`absolute right-3 top-1`) and `PowerRing` as they are.

- [ ] **Step 5: In the chart-variant `ChargingHero` usage, drop the mode props**

`ChargingHero` no longer renders a mode pill (Task 6). Remove the `{mode}`, `{modeLocked}`, `{modeLockLabel}`, `modeDisabled={...}`, and `onmode={setMode}` props from the `<ChargingHero ... />` call. Keep all other props (`kw`, `soc`, `target`, `hasSoc`, `amps`, `maxAmps`, `rateClaimedBy`, `rateNonce`, `samples`, `voltage`, `sessionElapsed`, `chartError`, `rateDisabled`, `onrate`).

- [ ] **Step 6: Replace the EcoShaperToggles block with ChargeControls**

Replace the existing block:

```svelte
  <EcoShaperToggles
    {showEco} {ecoOn} onEco={setEco}
    {showShaper} {shaperOn} onShaper={setShaper}
    disabled={busy || display === 'error'}
  />
```

with:

```svelte
  <!-- Unified charge controls: segmented mode + Shaper/Boost modifiers.
       Stays visible (disabled) during a fault so the layout doesn't reflow. -->
  <ChargeControls
    segment={chargeSegment}
    divertEnabled={showEco}
    shaperEnabled={showShaper}
    {shaperOn}
    locked={modeLocked}
    lockLabel={modeLockLabel}
    disabled={busy || display === 'error'}
    {boostEndsAt}
    onsegment={setSegment}
    onshaper={setShaper}
    onboost={boost}
    oncancelboost={cancelBoost}
  />
```

- [ ] **Step 7: Remove the standalone BoostButton usage**

Boost now lives inside `ChargeControls`. In the `{#if display !== 'error'}` block, delete:

```svelte
    <BoostButton
      disabled={busy}
      endsAt={boostEndsAt}
      onboost={boost}
      oncancel={cancelBoost}
    />
```

Leave the `{#key socNonce}...<ChargeLimitCard .../>...{/key}` inside that block untouched.

- [ ] **Step 8: Run the full suite + dev smoke check**

Run: `npm test`
Expected: PASS. (No Dashboard unit test exists; the deleted `EcoShaperToggles`/`ModePill` tests are removed in later/earlier tasks — at this point those files still exist and pass.)

Then manually verify in `npm run dev:mock`: the segmented control shows `Off · Auto · Eco · On` (Eco present because the mock sets `divert_enabled`), clicking segments calls the device, Shaper + Boost render as a two-up row, and the Rate pill dims when Eco is selected.

- [ ] **Step 9: Commit**

```bash
git add src/routes/Dashboard.svelte
git commit -m "feat: use unified ChargeControls on the dashboard"
```

---

## Task 6: Remove ModePill from ChargingHero

**Files:**
- Modify: `src/lib/components/dashboard/ChargingHero.svelte`
- Test: `src/lib/components/dashboard/__tests__/ChargingHero.test.js` (existing — must stay green)

- [ ] **Step 1: Remove the import and the pill from the top row**

In `ChargingHero.svelte`:
- Delete `import ModePill from './ModePill.svelte'`.
- In the top status row, delete the `<ModePill .../>` element so the row contains only the `StatusLine` and the `RatePill`. Change the row container so the status sits left and the rate pill sits right:

```svelte
  <!-- status row: "Charging" · rate pill -->
  <div class="flex items-center justify-between gap-2 px-1">
    <StatusLine display="charging" />
    {#key rateNonce}
      <RatePill {amps} min={6} max={maxAmps} claimedBy={rateClaimedBy} disabled={rateDisabled} onchange={onrate} />
    {/key}
  </div>
```

- [ ] **Step 2: Drop the now-unused mode props**

In the `$props()` destructure, remove `mode`, `modeLocked`, `modeLockLabel`, `modeDisabled`, and `onmode`. Keep the rest (`kw`, `soc`, `target`, `hasSoc`, `amps`, `maxAmps`, `rateClaimedBy`, `rateNonce`, `samples`, `voltage`, `sessionElapsed`, `chartError`, `rateDisabled`, `onrate`).

- [ ] **Step 3: Run the ChargingHero test**

Run: `npx vitest run src/lib/components/dashboard/__tests__/ChargingHero.test.js`
Expected: PASS — its assertions cover the kW/SOC readout and chart placeholder, not the mode pill. The `base` object still passes the removed props; Svelte 5 ignores unknown props, so the tests stay green.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/dashboard/ChargingHero.svelte
git commit -m "refactor: drop ModePill from ChargingHero top row"
```

---

## Task 7: Delete dead components

**Files:**
- Delete: `src/lib/components/dashboard/EcoShaperToggles.svelte`
- Delete: `src/lib/components/dashboard/__tests__/EcoShaperToggles.test.js`
- Delete: `src/lib/components/dashboard/ModePill.svelte`
- Delete: `src/lib/components/dashboard/__tests__/ModePill.test.js`

- [ ] **Step 1: Confirm there are no remaining importers**

Run: `grep -rn "EcoShaperToggles\|ModePill" src/`
Expected: only the four files about to be deleted (the two components and their two tests). If anything else appears, fix that importer first.

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/components/dashboard/EcoShaperToggles.svelte \
       src/lib/components/dashboard/__tests__/EcoShaperToggles.test.js \
       src/lib/components/dashboard/ModePill.svelte \
       src/lib/components/dashboard/__tests__/ModePill.test.js
```

- [ ] **Step 3: Run the full suite**

Run: `npm test`
Expected: PASS — full suite green with the dead components and their tests removed.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove EcoShaperToggles and ModePill"
```

---

## Final verification

- [ ] `npm test` — full suite green.
- [ ] `npm run dev:mock` smoke test:
  - Eco-enabled mock → four segments `Off · Auto · Eco · On`; selecting Eco dims the Rate pill.
  - Selecting On/Off/Auto round-trips through the device (mock accepts the writes).
  - Shaper toggle reflects/sets shaper; Boost opens the preset modal and shows the countdown when active (Shaper moves to its own row above the active boost card).
  - Force a locked state (e.g. a mock claim owned by OCPP) → segments replaced by "Controlled by OCPP"; modifiers dimmed.
  - Ring hero has no mode pill overlay (only the Rate pill, top-right); chart hero top row shows status + rate pill only.
```

# OpenEVSE GUI v3 — History Screen

**Date:** 2026-05-21
**Status:** Approved design (autonomous build — designed directly from v2 + the locked v3 Aurora language per the AUTONOMOUS-RUNBOOK)
**Repo:** `/home/rar/openevse-gui-v3`
**Builds on:** the v3 foundation, Dashboard, Schedule, and Monitoring, all merged to `main`.

## Summary

The History screen is v3's `/history` route, currently a placeholder. It is a
**read-only** view of the OpenEVSE device's event log — each entry a charging or
status event with its time, type, EVSE state, energy, and temperature. It replaces
v2's "History" screen (`src/routes/History.svelte` → `Logs.svelte`).

This is the fifth and final v3 screen plan. It depends only on the four merged
screens; it adds the History route, two History components, one pure-logic module,
and two mock routes (`/logs`, `/logs/<index>`) so the screen is viewable offline. It
writes nothing to the device.

## Goals

- Reproduce v2's History feature set: load the device's paged event log on entry and
  present every entry as a readable list, newest first.
- Each entry shows: time (in the device's timezone), event type, EVSE state, energy
  delivered (kWh), and temperature (°C).
- A progress indicator while the (possibly multi-page) log loads.
- Pure data-mapping logic isolated and unit-tested; only the route does I/O.

## Non-Goals (deferred / out of scope)

- Any control or write — History is strictly read-only.
- Filtering, search, or charts.
- Live auto-refresh — the log loads once when the screen is entered (as in v2).
- The other four screens (already merged).

## Data source & loading

The device exposes the log over two endpoints:
- `GET /logs` → `{ min, max }` — the inclusive range of available page indices.
- `GET /logs/<index>` → an array of log entries for that page.

A log entry: `{ time, type, evseState, energy, temperature }` —
- `time` — ISO timestamp.
- `type` — `"information" | "notification" | "warning"`.
- `evseState` — the EVSE state code (0–11, 254, 255), same vocabulary as `getStateDesc`.
- `energy` — watt-hours delivered in the session (kWh = `/1000`).
- `temperature` — °C, used directly.

The `history_store` (already ported, identical to v2) has `download(index)` which
fetches one page, accumulates into the store, dedupes, and sorts newest-first; plus
`set` to reset. It has **no** index-range method — the screen does that call itself,
mirroring v2's `Logs.svelte`.

**Load sequence** (route `onMount`, all calls serialized through `serialQueue`):
1. `GET /logs` → the `{ min, max }` range.
2. Reset `history_store` (`set(undefined)`).
3. For each index `min … max`: `history_store.download(index)`, advancing a progress
   percentage.
4. On success → ready; on any failure → an error state with a Retry control.

## Visual Design

Aurora theme (dark default / light), brand teal accent. Mobile-first, inside the
route content area. Mirrors the card idiom of the other four screens.

### Screen layout

1. **Header row** — the screen title (`screen.history`).
2. **Body**, one of three states:
   - **Loading** — a centered card: "Loading history…" and a `ProgressBar` reflecting
     page-load progress.
   - **Error** — a centered card: an error message and a "Retry" `Button` that re-runs
     the load.
   - **Ready** — the log list, or, when the device has no entries, an empty-state card.

### Log list (`LogList` → `LogRow`)

A vertical stack of log-entry cards, newest first (the store already sorts). Each
**`LogRow`** is a `Card`, horizontal:

- **Left:** a state icon tinted by the entry's EVSE state (teal/amber/red/muted).
- **Middle:** the EVSE-state description (`getStateDesc`) in `text-text`; below it a
  dim line with a small type icon, the type label, and the formatted time.
- **Right:** the energy in kWh (bold) and the temperature in °C (dim) stacked.

This replaces v2's five-column dense table — unreadable on a phone — with a
self-describing list, the same data in the locked v3 visual language.

## Architecture

### Components

```
src/routes/History.svelte                       composes the screen; the only store-aware unit; owns the load
src/lib/components/history/
  LogList.svelte                                 the list of LogRows, or the empty state
  LogRow.svelte                                  one log entry card
src/lib/history/logs.js                          pure helpers (see Pure Logic)
```

Reused as-is: `Card`, `Icon`, `ProgressBar`, `Button`. No new UI primitive.

`LogList` and `LogRow` receive plain props and import no store. `History.svelte`
alone subscribes to `history_store` / `config_store`, runs the load orchestration,
builds the row view-models, and passes them down.

### Pure logic — `src/lib/history/logs.js`

Self-contained (no store/DOM/utils imports), fully unit-tested:

- `pageRange(min, max)` → `[min … max]`, or `[]` when the inputs are not a valid
  ascending integer range.
- `logTypeIcon(type)` / `logTypeTone(type)` → an `mdi:*` icon name and a tone
  (`'info' | 'error' | 'muted'`) for an event type (`warning` → `error`).
- `logStateInfo(evseState)` → `{ icon, tone }` — an `mdi:*` icon and a tone
  (`'info' | 'ok' | 'charging' | 'error' | 'muted'`) for an EVSE state code.
- `logEnergyKwh(entry)` → watt-hours → kWh (1 dp), `0` when absent.
- `logTempC(entry)` → temperature in °C (1 dp), `0` when absent.

Icons/tones are re-derived here in the v3 vocabulary; v2's `state2icon`/`type2icon`
return v2-era Bulma class names and are not reused. The state **description** text
still comes from the shared `getStateDesc` (utils), and the localized time from
`formatDate` (utils) — both i18n/display helpers the route applies when it builds the
row view-models.

### Data flow

`History.svelte`:
- Reads `$history_store` (the accumulated, sorted entry array) and `$config_store`
  (for `time_zone`).
- `$state`: `phase` (`'loading' | 'error' | 'ready'`) and `progress` (0–100).
- `onMount` runs the load sequence above; `httpAPI` (`src/lib/api/httpAPI.js`) is
  imported for the `GET /logs` index call; every device call goes through
  `serialQueue`.
- Derives `rows` — each `history_store` entry mapped through `logs.js` plus
  `formatDate(entry.time, config.time_zone, 'short')` and `getStateDesc(evseState)` —
  and passes them to `LogList`.
- No write paths.

## Error Handling

- If the `GET /logs` index call or any page download fails, `phase` becomes `'error'`
  and the screen shows the error card with a Retry button — v2 silently spun forever
  on this path (see Decisions).
- A successful load with zero entries shows the empty-state card.
- `history_store` undefined at first paint → treated as an empty list; all reads use
  optional chaining / default to `[]`.
- The screen has no writes, so there is no failed-write / AlertBox path.

## Testing

- **`src/lib/history/logs.js`** — pure functions unit-tested: `pageRange` (normal
  range, single page, inverted/invalid input), `logTypeIcon`/`logTypeTone` for each
  type and the default, `logStateInfo` across state codes (idle, charging, error,
  disabled), `logEnergyKwh`/`logTempC` (scaling, rounding, missing input).
- **`LogRow`** — renders the state description, type, time, energy, and temperature
  from props.
- **`LogList`** — empty array → empty state; non-empty → one row per entry.
- **`History.svelte`** — integration test with a mocked `httpAPI`: a successful load
  renders the log rows; an index-call failure renders the error card; Retry re-runs
  the load.
- Vitest + `@testing-library/svelte`; coverage scoped to `src/lib`.

## Mock fixture

`dev/mock-plugin.js` currently serves seven exact-match endpoints. This plan adds
dynamic handling for the log endpoints:
- `GET /api/logs` → `{ "min": 1, "max": 1 }`.
- `GET /api/logs/<index>` → the contents of a new `dev/fixtures/logs.json` for the
  available page, an empty array otherwise.

`dev/fixtures/logs.json` holds ~6 representative entries (varied types, states,
energy, temperature, timestamps) so the screen is viewable via `npm run dev:mock`.

## Decisions (judgment calls — per locked decision #2, recorded here)

1. **List replaces v2's five-column table.** v2 rendered History as a dense
   `time / type / status / kWh / T` table that overflows a phone screen. v3 presents
   the identical five fields as a self-describing list of cards — the same
   information in the locked Aurora language, no field added or dropped.
2. **A real error state.** v2's loader had no failure handling — a failed `GET /logs`
   left `loaded` false and the progress spinner visible indefinitely. v3 surfaces an
   explicit error card with a Retry button. This fixes a v2 defect; it adds no
   feature beyond making an already-possible failure visible and recoverable.
3. **The page cache is dropped.** v2 cached the last-seen `{min,max}` in
   `uistates_store` and skipped re-downloading unchanged pages. v3 reloads the log
   each time the screen is entered. The cache was an optimization, not a feature; the
   log is small and the reload is serialized — simpler and always-fresh.
4. **Icons re-derived in the v3 vocabulary.** v2's `state2icon`/`type2icon` return
   Bulma class names (`has-text-info`, …) meaningless under v3's Tailwind theme. The
   `logs.js` module maps states/types to `mdi:*` icons and semantic tones that the
   components render with theme tokens. The state *description* text still comes from
   the shared `getStateDesc`.
5. **`evseState` codes outside the known set** fall back to a neutral icon/tone and
   whatever `getStateDesc` returns (possibly empty) — defensive, since the log can in
   principle carry historical codes.

## Open Questions

None. All design decisions for this screen are resolved.

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

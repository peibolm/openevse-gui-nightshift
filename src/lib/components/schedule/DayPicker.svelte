<script>
  import { _ } from 'svelte-i18n'
  import { DAYS } from '../../schedule/timers.js'

  let { flags = [false, false, false, false, false, false, false], onchange = () => {} } = $props()

  let allOn = $derived(flags.every((f) => f === true))

  function toggle(i) {
    const next = flags.slice()
    next[i] = !next[i]
    onchange(next)
  }
  function toggleAll() {
    onchange(DAYS.map(() => !allOn))
  }
</script>

<div class="flex justify-between gap-1">
  {#each DAYS as day, i}
    <button
      type="button"
      aria-pressed={flags[i] === true}
      aria-label={$_('days.' + day)}
      onclick={() => toggle(i)}
      class="flex-1 rounded-lg py-2 text-[11px] font-semibold transition
             {flags[i] ? 'bg-accent text-surface' : 'bg-surface-3 text-text-dim'}"
    >
      {$_('days.' + day).slice(0, 3)}
    </button>
  {/each}
</div>
<button
  type="button"
  onclick={toggleAll}
  class="mt-2 text-xs font-semibold text-accent"
>
  {allOn ? $_('schedule.clear_all') : $_('schedule.select_all')}
</button>

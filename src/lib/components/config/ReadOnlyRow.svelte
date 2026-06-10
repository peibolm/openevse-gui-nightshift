<!-- src/lib/components/config/ReadOnlyRow.svelte -->
<script>
  let { label = '', value = '', tone = 'default', detail = '' } = $props()

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
  <span class="font-medium {tones[tone] ?? tones.default}">
    {display}{#if detail}<span class="ml-1 text-xs font-normal text-text-dim">{detail}</span>{/if}
  </span>
</div>

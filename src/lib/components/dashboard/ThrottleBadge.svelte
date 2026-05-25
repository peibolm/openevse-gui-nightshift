<script>
  import { _ } from 'svelte-i18n'
  import { claims_target_store } from '../../stores/claims_target.js'
  import { EvseClients } from '../../vars.js'
  import Icon from '../../icons/Icon.svelte'

  let active = $derived(
    $claims_target_store?.claims?.charge_current === EvseClients.tempThrottle.id,
  )
  let current = $derived($claims_target_store?.properties?.charge_current)
</script>

{#if active}
  <div class="mt-2 flex justify-center">
    <div
      role="status"
      class="inline-flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning"
    >
      <Icon icon="mdi:thermometer-alert" size={14} />
      <span>{$_('dashboard.throttle.active', { values: { amps: current } })}</span>
    </div>
  </div>
{/if}

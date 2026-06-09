<script>
  import MetricGroup from './MetricGroup.svelte'

  let { groups = [] } = $props()
</script>

<div class="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-3">
  {#each groups as g}
    <MetricGroup group={g.group} expanded={g.expanded} />
  {/each}
</div>

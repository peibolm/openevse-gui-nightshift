<script>
  import uPlot from 'uplot'
  import 'uplot/dist/uPlot.min.css'

  let { opts, data } = $props()

  let container
  /** @type {uPlot | null} */
  let chart = null
  /** @type {ResizeObserver | null} */
  let ro = null
  /** @type {MutationObserver | null} */
  let mo = null

  function rebuild() {
    if (!container) return
    if (chart) { chart.destroy(); chart = null }
    const width = container.clientWidth || 600
    const o = { ...opts, width, height: opts.height ?? 260 }
    chart = new uPlot(o, data, container)
  }

  $effect(() => {
    rebuild()
    ro = new ResizeObserver(() => {
      if (chart && container) chart.setSize({ width: container.clientWidth, height: chart.height })
    })
    ro.observe(container)
    mo = new MutationObserver(() => rebuild())
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      ro?.disconnect()
      mo?.disconnect()
      chart?.destroy()
      chart = null
    }
  })

  $effect(() => {
    // React to data changes after initial mount
    if (chart) chart.setData(data)
  })
</script>

<div bind:this={container} class="w-full"></div>

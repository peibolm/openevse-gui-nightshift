<script>
  import 'iconify-icon'
  let { icon, size = 20, class: klass = '' } = $props()
</script>

<iconify-icon icon={icon} width={size} height={size} class={klass}></iconify-icon>

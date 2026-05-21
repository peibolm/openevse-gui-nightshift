<script>
  import Icon from '../../icons/Icon.svelte'
  let { icon, size = 22, label = '', disabled = false, onclick = () => {} } = $props()
</script>

<button
  type="button"
  {disabled}
  {onclick}
  aria-label={label}
  class="grid place-items-center rounded-full p-2 text-text-dim
         hover:text-text disabled:opacity-40"
>
  <Icon {icon} {size} />
</button>

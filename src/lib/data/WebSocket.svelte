<script>
  import { onMount, onDestroy } from 'svelte'
  import { DateTime } from 'luxon'
  import { uistates_store } from '../stores/uistates.js'
  import { status_store } from '../stores/status.js'
  import { JSONTryParse } from '../utils.js'

  let socket
  let timerId
  let lastmsg
  let ping_cnt = 0

  onMount(() => connect2socket())
  onDestroy(() => {
    if (socket) socket.close()
    cancelKeepAlive()
  })

  function connect2socket() {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
    const s = new globalThis.WebSocket(proto + window.location.host + '/ws')
    socket = s
    s.addEventListener('open', () => {
      $uistates_store.ws_connected = true
      keepAlive(s)
    })
    s.addEventListener('message', (e) => {
      lastmsg = DateTime.now().toUnixInteger()
      if (parseMessage(e.data.toString())) ping_cnt = 0
    })
    s.addEventListener('error', () => {
      lastmsg = DateTime.now().toUnixInteger()
      $uistates_store.ws_connected = false
      cancelKeepAlive()
    })
    s.addEventListener('close', () => {
      lastmsg = DateTime.now().toUnixInteger()
      cancelKeepAlive()
      $uistates_store.ws_connected = false
      setTimeout(() => connect2socket(), 1000)
    })
  }

  function parseMessage(msg) {
    const jsondata = JSONTryParse(msg)
    if (!jsondata) return false
    lastmsg = DateTime.now().toUnixInteger()
    if (!jsondata.pong) {
      status_store.update((cur) => ({ ...(cur || {}), ...jsondata }))
    }
    return true
  }

  function keepAlive(s) {
    const now = DateTime.now().toUnixInteger()
    const timing = now - lastmsg
    if ((!ping_cnt && timing >= 5) || (ping_cnt && ping_cnt <= 3)) {
      if (s && s.readyState === s.OPEN) {
        s.send('{"ping": 1}')
        ping_cnt += 1
      }
    } else if (ping_cnt > 3 && timing >= 5) {
      ping_cnt = 0
      $uistates_store.ws_connected = false
      s.close()
      lastmsg = DateTime.now().toUnixInteger()
      cancelKeepAlive()
      return
    }
    timerId = setTimeout(() => keepAlive(s), ping_cnt ? 1000 : 5000)
  }

  function cancelKeepAlive() {
    if (timerId) clearTimeout(timerId)
  }
</script>

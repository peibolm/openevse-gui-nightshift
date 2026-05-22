# Config System Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the four System config pages — Firmware, Certificates, Terminal,
About — completing v3's Settings area. Three of these (Firmware OTA, Certificates,
Terminal) are the non-form "complex" pages and get extra care.

**Architecture:** Each page is a route component in `src/routes/settings/`, the only
store-aware unit. Firmware's config-sanitising logic is a pure module. The Certificate
add-modal is a pure child component. Per spec Decisions §11.5/§11.6, the GitHub OTA
version-check is deferred and the Terminal debug/EVSE consoles degrade gracefully when
the WebSocket cannot connect.

**Tech Stack:** Svelte 5 runes, Vite 8, Tailwind 4, svelte-i18n, Vitest +
@testing-library/svelte.

**Reference:** `docs/superpowers/specs/2026-05-22-config-system-design.md` — §7.14–7.17,
§8 (error handling), Decisions §11.5 (GitHub check deferred), §11.6 (Terminal WS
graceful degradation).

---

## File Structure

**Create:**
- `src/lib/config/backup.js` — config-export sanitiser + test
- `src/lib/components/config/CertificateModal.svelte` — the add-certificate modal (pure)
- `src/lib/components/config/ConsoleViewer.svelte` — the live WS terminal (pure)
- `src/routes/settings/{About,Certificates,Terminal,Firmware}.svelte` + `__tests__/`

**Modify:**
- `src/lib/i18n/en.json` — extend the `config` block
- `src/lib/routes.js` — point the four routes at the real components
- `dev/mock-plugin.js` — add `/restart`, `/reset`, `/update`, `/r` routes and
  POST/DELETE handling for `/certificates`

**Conventions (carried from earlier batches):** route tests mock `svelte-i18n`
(standard stub) and `../../../lib/api/httpAPI.js`. `config_store` and
`certificate_store` import `httpAPI` from `src/lib/api/httpAPI.js`. After an async
action, assert with `vi.waitFor(...)`. Theme tokens only. Commit after every green step.

---

## Task 1: Config-export sanitiser — `src/lib/config/backup.js`

The Firmware page can download the device config as a backup file. Secrets and
device-identity fields must be stripped first.

**Files:**
- Create: `src/lib/config/backup.js`
- Test: `src/lib/config/__tests__/backup.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/config/__tests__/backup.test.js
import { describe, it, expect } from 'vitest'
import { sanitizeConfig } from '../backup.js'

describe('sanitizeConfig', () => {
  it('drops device-identity and capability fields', () => {
    const out = sanitizeConfig({
      hostname: 'evse', firmware: '7.1', version: '5.0', espinfo: 'x',
      buildenv: 'b', build_env: 'b', evse_serial: '1', wifi_serial: '2',
      ssid: 'wifi', www_username: 'admin', protocol: '-', espflash: '4MB',
      mqtt_supported_protocols: ['mqtt'], http_supported_protocols: ['http'],
    })
    expect(out).toEqual({ hostname: 'evse' })
  })
  it('drops fields holding the dummy-password sentinel', () => {
    const out = sanitizeConfig({ hostname: 'evse', mqtt_pass: '_DUMMY_PASSWORD', mqtt_user: 'u' })
    expect(out).toEqual({ hostname: 'evse', mqtt_user: 'u' })
  })
  it('keeps ordinary settings and tolerates empty / missing input', () => {
    expect(sanitizeConfig({ divert_enabled: true })).toEqual({ divert_enabled: true })
    expect(sanitizeConfig({})).toEqual({})
    expect(sanitizeConfig(undefined)).toEqual({})
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`npx vitest run src/lib/config/__tests__/backup.test.js`).

- [ ] **Step 3: Implement**

```js
// src/lib/config/backup.js
// Produces a config object safe to download as a backup: device-identity /
// capability fields and masked-password fields are removed.

const STRIP_KEYS = new Set([
  'www_username', 'ssid', 'mqtt_supported_protocols', 'http_supported_protocols',
  'firmware', 'protocol', 'espflash', 'espinfo', 'buildenv', 'build_env',
  'version', 'evse_serial', 'wifi_serial',
])

export function sanitizeConfig(config) {
  const out = {}
  for (const [key, value] of Object.entries(config ?? {})) {
    if (STRIP_KEYS.has(key)) continue
    if (value === '_DUMMY_PASSWORD') continue
    out[key] = value
  }
  return out
}
```

- [ ] **Step 4: Run it — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the config-backup sanitiser"`

---

## Task 2: About page — `src/routes/settings/About.svelte`

Spec §7.17. Purely informational: device versions plus documentation / repository
links.

**Files:**
- Create: `src/routes/settings/About.svelte`
- Test: `src/routes/settings/__tests__/About.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/About.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import { config_store } from '../../../lib/stores/config.js'
import About from '../About.svelte'

beforeEach(() => {
  config_store.set({ firmware: '7.1.3', version: '5.1.2' })
})

describe('About page', () => {
  it('shows the firmware and gateway versions', () => {
    const { getByText } = render(About)
    expect(getByText('7.1.3')).toBeInTheDocument()
    expect(getByText('5.1.2')).toBeInTheDocument()
  })
  it('links to the documentation', () => {
    const { getAllByRole } = render(About)
    const hrefs = getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs.some((h) => h && h.includes('openevse'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/About.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import Icon from '../../lib/icons/Icon.svelte'

  const links = [
    { labelKey: 'config.about.docs', href: 'https://openevse.stoplight.io/docs/openevse-wifi-v4', icon: 'mdi:book-open-variant' },
    { labelKey: 'config.about.repo_wifi', href: 'https://github.com/OpenEVSE/ESP32_WiFi_V4.x', icon: 'mdi:github' },
    { labelKey: 'config.about.repo_evse', href: 'https://github.com/OpenEVSE/open_evse', icon: 'mdi:github' },
  ]
</script>

<ConfigPage title={$_('config.pages.about')}>
  <ConfigSection title={$_('config.about.versions')}>
    <ReadOnlyRow label={$_('config.about.firmware')} value={$config_store?.firmware} />
    <ReadOnlyRow label={$_('config.about.gateway')} value={$config_store?.version} />
  </ConfigSection>

  <ConfigSection title={$_('config.about.links')}>
    {#each links as link}
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer"
        class="flex items-center gap-3 py-2 text-sm text-text hover:text-accent"
      >
        <Icon icon={link.icon} size={18} class="text-text-dim" />
        <span class="flex-1">{$_(link.labelKey)}</span>
        <Icon icon="mdi:open-in-new" size={16} class="text-text-dim" />
      </a>
    {/each}
  </ConfigSection>

  <p class="mt-4 text-center text-xs text-text-dim">{$_('config.about.credit')}</p>
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the About config page"`

---

## Task 3: Certificate add-modal — `src/lib/components/config/CertificateModal.svelte`

Spec §7.15. A pure modal component (no store import) for entering a new certificate.
The `private_key` field shows only for the `client` type.

**Files:**
- Create: `src/lib/components/config/CertificateModal.svelte`
- Test: `src/lib/components/config/__tests__/CertificateModal.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/lib/components/config/__tests__/CertificateModal.test.js
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})

import CertificateModal from '../CertificateModal.svelte'

describe('CertificateModal', () => {
  it('shows the private-key field only for the client type', async () => {
    const { queryByText, getByRole } = render(CertificateModal, { open: true })
    expect(queryByText('config.certificates.private_key')).not.toBeInTheDocument()
    await fireEvent.change(getByRole('combobox'), { target: { value: 'client' } })
    expect(queryByText('config.certificates.private_key')).toBeInTheDocument()
  })

  it('emits onsubmit with the entered certificate', async () => {
    const onsubmit = vi.fn()
    const { getByText, getByLabelText } = render(CertificateModal, { open: true, onsubmit })
    await fireEvent.input(getByLabelText('config.certificates.name'), { target: { value: 'My cert' } })
    await fireEvent.input(getByLabelText('config.certificates.certificate'), { target: { value: '-----BEGIN-----' } })
    await fireEvent.click(getByText('config.certificates.save'))
    expect(onsubmit).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'root', name: 'My cert', certificate: '-----BEGIN-----' }),
    )
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/lib/components/config/CertificateModal.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import Modal from '../ui/Modal.svelte'
  import Select from '../ui/Select.svelte'
  import Button from '../ui/Button.svelte'

  let { open = false, busy = false, onclose = () => {}, onsubmit = () => {} } = $props()

  let type = $state('root')
  let name = $state('')
  let certificate = $state('')
  let privateKey = $state('')

  let typeOptions = $derived([
    { value: 'root', label: $_('config.certificates.root') },
    { value: 'client', label: $_('config.certificates.client') },
  ])
  let canSave = $derived(
    name.trim() !== '' &&
    certificate.trim() !== '' &&
    (type !== 'client' || privateKey.trim() !== ''),
  )

  function submit() {
    const cert = { type, name, certificate }
    if (type === 'client') cert.key = privateKey
    onsubmit(cert)
  }
</script>

<Modal visible={open} {onclose}>
  <div class="p-4">
    <h2 class="mb-3 text-base font-semibold text-text">{$_('config.certificates.add')}</h2>

    <label class="mb-1 block text-sm text-text">{$_('config.certificates.type')}</label>
    <Select options={typeOptions} value={type} onchange={(v) => (type = v)} />

    <label class="mb-1 mt-3 block text-sm text-text" for="cert-name">
      {$_('config.certificates.name')}
    </label>
    <input
      id="cert-name"
      aria-label={$_('config.certificates.name')}
      value={name}
      oninput={(e) => (name = e.currentTarget.value)}
      class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-text
             focus:border-accent focus:outline-none"
    />

    <label class="mb-1 mt-3 block text-sm text-text" for="cert-body">
      {$_('config.certificates.certificate')}
    </label>
    <textarea
      id="cert-body"
      aria-label={$_('config.certificates.certificate')}
      rows="4"
      value={certificate}
      oninput={(e) => (certificate = e.currentTarget.value)}
      placeholder="-----BEGIN CERTIFICATE-----"
      class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-xs
             text-text focus:border-accent focus:outline-none"
    ></textarea>

    {#if type === 'client'}
      <label class="mb-1 mt-3 block text-sm text-text" for="cert-key">
        {$_('config.certificates.private_key')}
      </label>
      <textarea
        id="cert-key"
        aria-label={$_('config.certificates.private_key')}
        rows="4"
        value={privateKey}
        oninput={(e) => (privateKey = e.currentTarget.value)}
        placeholder="-----BEGIN RSA PRIVATE KEY-----"
        class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-xs
               text-text focus:border-accent focus:outline-none"
      ></textarea>
    {/if}

    <div class="mt-4 flex gap-2">
      <Button label={$_('config.certificates.save')} disabled={!canSave || busy} onclick={submit} />
      <Button label={$_('config.certificates.cancel')} variant="ghost" onclick={onclose} />
    </div>
  </div>
</Modal>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the certificate add-modal component"`

---

## Task 4: Certificates page — `src/routes/settings/Certificates.svelte`

Spec §7.15. Lists certificates from `certificate_store`; add via the modal; per-row
delete. **Decision:** v3 does not clear `config.*_certificate_id` references on delete
(v2's cleanup used a misspelled key and is a separate concern) — recorded here.

**Files:**
- Create: `src/routes/settings/Certificates.svelte`
- Test: `src/routes/settings/__tests__/Certificates.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Certificates.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { certificate_store } from '../../../lib/stores/certificates.js'
import Certificates from '../Certificates.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  certificate_store.set([])
})

describe('Certificates page', () => {
  it('shows the empty state when there are no certificates', () => {
    const { getByText } = render(Certificates)
    expect(getByText('config.certificates.empty')).toBeInTheDocument()
  })

  it('lists certificates from the store', () => {
    certificate_store.set([{ id: '1', type: 'root', name: 'Root CA' }])
    const { getByText } = render(Certificates)
    expect(getByText('Root CA')).toBeInTheDocument()
  })

  it('opens the add-modal', async () => {
    const { getByText, getByRole } = render(Certificates)
    expect(() => getByRole('dialog')).toThrow()
    await fireEvent.click(getByText('config.certificates.add'))
    expect(getByRole('dialog')).toBeInTheDocument()
  })

  it('deletes a certificate via the store', async () => {
    httpAPI.mockResolvedValue({ msg: 'done' })
    certificate_store.set([{ id: '7', type: 'client', name: 'Client A' }])
    const { getByLabelText } = render(Certificates)
    await fireEvent.click(getByLabelText('config.certificates.delete'))
    expect(httpAPI).toHaveBeenCalledWith('DELETE', '/certificates/7')
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Certificates.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { certificate_store } from '../../lib/stores/certificates.js'
  import { serialQueue } from '../../lib/queue.js'
  import { showWriteError } from '../../lib/alerts.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import CertificateModal from '../../lib/components/config/CertificateModal.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import IconButton from '../../lib/components/ui/IconButton.svelte'

  let modalOpen = $state(false)
  let busy = $state(false)

  let certificates = $derived(Array.isArray($certificate_store) ? $certificate_store : [])

  async function addCertificate(cert) {
    if (busy) return
    busy = true
    try {
      const res = await serialQueue.add(() => certificate_store.upload(cert))
      if (res && res.success) {
        modalOpen = false
        await serialQueue.add(() => certificate_store.download())
      } else {
        showWriteError()
      }
    } finally {
      busy = false
    }
  }

  async function remove(id) {
    if (busy) return
    busy = true
    try {
      const ok = await serialQueue.add(() => certificate_store.remove(id))
      if (ok) {
        await serialQueue.add(() => certificate_store.download())
      } else {
        showWriteError()
      }
    } finally {
      busy = false
    }
  }
</script>

<ConfigPage title={$_('config.pages.certificates')}>
  <ConfigSection title={$_('config.certificates.installed')}>
    {#if certificates.length === 0}
      <p class="py-2 text-sm text-text-dim">{$_('config.certificates.empty')}</p>
    {:else}
      {#each certificates as cert}
        <div class="flex items-center gap-3 py-2 text-sm">
          <span class="text-text-dim">{cert.id}</span>
          <span class="rounded bg-surface-3 px-2 py-0.5 text-xs text-text-dim">
            {$_('config.certificates.' + cert.type)}
          </span>
          <span class="flex-1 text-text">{cert.name}</span>
          <IconButton
            icon="mdi:trash-can-outline"
            label={$_('config.certificates.delete')}
            disabled={busy}
            onclick={() => remove(cert.id)}
          />
        </div>
      {/each}
    {/if}
  </ConfigSection>

  <div class="mt-4">
    <Button label={$_('config.certificates.add')} disabled={busy} onclick={() => (modalOpen = true)} />
  </div>
</ConfigPage>

<CertificateModal
  open={modalOpen}
  {busy}
  onclose={() => (modalOpen = false)}
  onsubmit={addCertificate}
/>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the Certificates config page"`

---

## Task 5: Live console viewer — `src/lib/components/config/ConsoleViewer.svelte`

Spec §7.16 + Decision §11.6. A pure component that opens a WebSocket to the device's
`debug` or `evse` console and streams lines. When the socket cannot connect (the dev
mock does not serve it) it shows a clear "console unavailable" state instead of
erroring. No store import.

**Files:**
- Create: `src/lib/components/config/ConsoleViewer.svelte`

- [ ] **Step 1: Implement** (no unit test — exercised via the Terminal page; jsdom has
no real WebSocket. Verify with `npm run build`.)

```svelte
<!-- src/lib/components/config/ConsoleViewer.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { onDestroy } from 'svelte'

  let { mode = 'debug' } = $props()

  let lines = $state([])
  let failed = $state(false)
  let socket

  function connect() {
    try {
      const proto = location.protocol === 'https:' ? 'wss://' : 'ws://'
      socket = new WebSocket(`${proto}${location.host}/${mode}/console`)
      socket.addEventListener('message', (e) => {
        lines = [...lines, String(e.data)].slice(-200)
      })
      socket.addEventListener('error', () => (failed = true))
      socket.addEventListener('close', () => {
        if (lines.length === 0) failed = true
      })
    } catch {
      failed = true
    }
  }

  $effect(() => {
    connect()
    return () => socket?.close()
  })
  onDestroy(() => socket?.close())
</script>

<div class="h-72 overflow-y-auto rounded-xl bg-surface-3 p-3 font-mono text-xs text-text">
  {#if failed}
    <p class="text-text-dim">{$_('config.terminal.unavailable')}</p>
  {:else if lines.length === 0}
    <p class="text-text-dim">{$_('config.terminal.connecting')}</p>
  {:else}
    {#each lines as line}
      <div>{line}</div>
    {/each}
  {/if}
</div>
```

- [ ] **Step 2: Verify** `npm run build`. Commit — `git commit -m "Add the live console viewer component"`

---

## Task 6: Terminal page — `src/routes/settings/Terminal.svelte`

Spec §7.16. A RAPI command console (`GET /r?json=1&rapi=<cmd>`) plus the debug / EVSE
live consoles (opened in a `Modal` containing `ConsoleViewer`).

**Files:**
- Create: `src/routes/settings/Terminal.svelte`
- Test: `src/routes/settings/__tests__/Terminal.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Terminal.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn() }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import Terminal from '../Terminal.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ cmd: '$GE', ret: '$OK 0 0^20' })
})

describe('Terminal page', () => {
  it('sends a RAPI command and shows the result', async () => {
    const { getByLabelText, getByText } = render(Terminal)
    const input = getByLabelText('config.terminal.command')
    await fireEvent.input(input, { target: { value: '$GE' } })
    await fireEvent.click(getByText('config.terminal.send'))
    expect(httpAPI).toHaveBeenCalledWith('GET', '/r?json=1&rapi=$GE')
    await vi.waitFor(() => {
      expect(getByText(/\$OK 0 0\^20/)).toBeInTheDocument()
    })
  })

  it('clears the RAPI result log', async () => {
    const { getByLabelText, getByText, queryByText } = render(Terminal)
    await fireEvent.input(getByLabelText('config.terminal.command'), { target: { value: '$GE' } })
    await fireEvent.click(getByText('config.terminal.send'))
    await vi.waitFor(() => expect(queryByText(/\$OK/)).toBeInTheDocument())
    await fireEvent.click(getByText('config.terminal.clear'))
    expect(queryByText(/\$OK/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Terminal.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import ConsoleViewer from '../../lib/components/config/ConsoleViewer.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import Modal from '../../lib/components/ui/Modal.svelte'

  let command = $state('$')
  let results = $state([])
  let sending = $state(false)
  let consoleMode = $state(null) // 'debug' | 'evse' | null

  async function send() {
    if (sending || !command.trim()) return
    sending = true
    try {
      const res = await httpAPI('GET', '/r?json=1&rapi=' + command)
      if (res && res !== 'error') {
        results = [...results, { cmd: res.cmd ?? command, ret: res.ret ?? '', error: res.error }]
        command = '$'
      } else {
        results = [...results, { cmd: command, ret: '', error: 'error' }]
      }
    } finally {
      sending = false
    }
  }
</script>

<ConfigPage title={$_('config.pages.terminal')}>
  <ConfigSection title={$_('config.terminal.rapi')}>
    {#if results.length > 0}
      <div class="mb-3 max-h-60 overflow-y-auto rounded-xl bg-surface-3 p-3 font-mono text-xs">
        {#each results as r}
          <div class="text-text-dim">&gt; {r.cmd}</div>
          {#if r.error}
            <div class="text-error">&lt; {r.error}</div>
          {:else}
            <div class="text-text">&lt; {r.ret}</div>
          {/if}
        {/each}
      </div>
    {/if}
    <label class="mb-1 block text-sm text-text" for="rapi-cmd">{$_('config.terminal.command')}</label>
    <input
      id="rapi-cmd"
      aria-label={$_('config.terminal.command')}
      value={command}
      oninput={(e) => (command = e.currentTarget.value)}
      class="w-full rounded-xl border border-border bg-surface-2 px-3 py-2 font-mono text-sm
             text-text focus:border-accent focus:outline-none"
    />
    <div class="mt-2 flex gap-2">
      <Button label={$_('config.terminal.send')} disabled={sending} onclick={send} />
      <Button label={$_('config.terminal.clear')} variant="ghost" onclick={() => (results = [])} />
    </div>
  </ConfigSection>

  <ConfigSection title={$_('config.terminal.consoles')}>
    <div class="flex gap-2">
      <Button label={$_('config.terminal.debug')} variant="ghost" onclick={() => (consoleMode = 'debug')} />
      <Button label={$_('config.terminal.evse')} variant="ghost" onclick={() => (consoleMode = 'evse')} />
    </div>
  </ConfigSection>
</ConfigPage>

<Modal visible={consoleMode !== null} onclose={() => (consoleMode = null)}>
  <div class="p-4">
    <h2 class="mb-3 text-base font-semibold text-text">
      {consoleMode === 'evse' ? $_('config.terminal.evse') : $_('config.terminal.debug')}
    </h2>
    {#if consoleMode}
      {#key consoleMode}
        <ConsoleViewer mode={consoleMode} />
      {/key}
    {/if}
  </div>
</Modal>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the Terminal config page"`

---

## Task 7: Firmware page — `src/routes/settings/Firmware.svelte`

Spec §7.14 + Decision §11.5 (GitHub check deferred). Shows versions; restart EVSE /
gateway; factory reset (confirmed); OTA firmware file upload with progress; config
backup / restore.

**Files:**
- Create: `src/routes/settings/Firmware.svelte`
- Test: `src/routes/settings/__tests__/Firmware.test.js`

- [ ] **Step 1: Write the failing test**

```js
// src/routes/settings/__tests__/Firmware.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'

vi.mock('svelte-i18n', () => {
  const t = (k) => k
  t.subscribe = (fn) => { fn(t); return () => {} }
  return { _: t }
})
vi.mock('../../../lib/api/httpAPI.js', () => ({ httpAPI: vi.fn(() => Promise.resolve({ msg: 'restart gateway' })) }))

import { httpAPI } from '../../../lib/api/httpAPI.js'
import { config_store } from '../../../lib/stores/config.js'
import { status_store } from '../../../lib/stores/status.js'
import Firmware from '../Firmware.svelte'

beforeEach(() => {
  httpAPI.mockReset()
  httpAPI.mockResolvedValue({ msg: 'restart gateway' })
  config_store.set({ firmware: '7.1.3', version: '5.1.2' })
  status_store.set({})
})

describe('Firmware page', () => {
  it('shows the device versions', () => {
    const { getByText } = render(Firmware)
    expect(getByText('7.1.3')).toBeInTheDocument()
    expect(getByText('5.1.2')).toBeInTheDocument()
  })

  it('restarts the gateway', async () => {
    const { getByText } = render(Firmware)
    await fireEvent.click(getByText('config.firmware.restart_gateway'))
    expect(httpAPI).toHaveBeenCalledWith('POST', '/restart', JSON.stringify({ device: 'gateway' }))
  })

  it('asks for confirmation before a factory reset', async () => {
    const { getByText, queryByText } = render(Firmware)
    expect(queryByText('config.firmware.reset_confirm')).not.toBeInTheDocument()
    await fireEvent.click(getByText('config.firmware.reset'))
    expect(getByText('config.firmware.reset_confirm')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```svelte
<!-- src/routes/settings/Firmware.svelte -->
<script>
  import { _ } from 'svelte-i18n'
  import { config_store } from '../../lib/stores/config.js'
  import { status_store } from '../../lib/stores/status.js'
  import { serialQueue } from '../../lib/queue.js'
  import { httpAPI } from '../../lib/api/httpAPI.js'
  import { showWriteError } from '../../lib/alerts.js'
  import { sanitizeConfig } from '../../lib/config/backup.js'
  import { JSONTryParse } from '../../lib/utils.js'
  import ConfigPage from '../../lib/components/config/ConfigPage.svelte'
  import ConfigSection from '../../lib/components/config/ConfigSection.svelte'
  import FormField from '../../lib/components/config/FormField.svelte'
  import ReadOnlyRow from '../../lib/components/config/ReadOnlyRow.svelte'
  import Button from '../../lib/components/ui/Button.svelte'
  import ProgressBar from '../../lib/components/ui/ProgressBar.svelte'

  let busy = $state(false)
  let confirmReset = $state(false)
  let firmwareFile = $state(null)
  let uploading = $state(false)

  // /update is multipart; in dev the mock lives behind the /api proxy prefix.
  const updateUrl = import.meta.env.DEV ? '/api/update' : '/update'

  let otaState = $derived($status_store?.ota)
  let otaProgress = $derived($status_store?.ota_progress ?? 0)

  async function restart(device) {
    if (busy) return
    busy = true
    try {
      const res = await serialQueue.add(() =>
        httpAPI('POST', '/restart', JSON.stringify({ device })),
      )
      if (!res || res === 'error') showWriteError()
    } finally {
      busy = false
    }
  }

  async function factoryReset() {
    confirmReset = false
    const res = await serialQueue.add(() => httpAPI('GET', '/reset'))
    if (!res || res === 'error') showWriteError()
  }

  async function uploadFirmware() {
    if (!firmwareFile || uploading) return
    uploading = true
    serialQueue.pause()
    try {
      const fd = new FormData()
      fd.append('update', firmwareFile)
      const res = await fetch(updateUrl, { method: 'POST', body: fd })
      if (!res.ok) showWriteError()
    } catch {
      showWriteError()
    } finally {
      serialQueue.resume()
      uploading = false
    }
  }

  function backupConfig() {
    const clean = sanitizeConfig($config_store)
    const blob = new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'openevse-config.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function restoreConfig(e) {
    const file = e.currentTarget.files?.[0]
    if (!file) return
    const text = await file.text()
    const parsed = JSONTryParse(text)
    if (!parsed || typeof parsed !== 'object') {
      showWriteError()
      return
    }
    const ok = await serialQueue.add(() => config_store.upload(parsed))
    if (!ok) showWriteError()
  }
</script>

<ConfigPage title={$_('config.pages.firmware')}>
  <ConfigSection title={$_('config.firmware.versions')}>
    <ReadOnlyRow label={$_('config.firmware.evse')} value={$config_store?.firmware} />
    <ReadOnlyRow label={$_('config.firmware.gateway')} value={$config_store?.version} />
  </ConfigSection>

  <ConfigSection title={$_('config.firmware.update')}>
    <p class="mb-2 text-xs text-text-dim">{$_('config.firmware.update_desc')}</p>
    <input
      type="file"
      accept=".bin,.hex"
      aria-label={$_('config.firmware.choose_file')}
      onchange={(e) => (firmwareFile = e.currentTarget.files?.[0] ?? null)}
      class="block w-full text-sm text-text-dim file:mr-3 file:rounded-lg file:border-0
             file:bg-surface-3 file:px-3 file:py-1.5 file:text-text"
    />
    <div class="mt-2">
      <Button
        label={$_('config.firmware.install')}
        disabled={!firmwareFile || uploading}
        onclick={uploadFirmware}
      />
    </div>
    {#if otaState}
      <div class="mt-3">
        <ProgressBar value={otaProgress} />
        <p class="mt-1 text-xs text-text-dim">{$_('config.firmware.ota_' + otaState)}</p>
      </div>
    {/if}
  </ConfigSection>

  <ConfigSection title={$_('config.firmware.backup')}>
    <FormField label={$_('config.firmware.backup_export')} description={$_('config.firmware.backup_desc')}>
      <Button label={$_('config.firmware.backup_export')} variant="ghost" onclick={backupConfig} />
    </FormField>
    <FormField label={$_('config.firmware.backup_import')}>
      <input
        type="file"
        accept=".json,.txt"
        aria-label={$_('config.firmware.backup_import')}
        onchange={restoreConfig}
        class="block w-full text-sm text-text-dim file:mr-3 file:rounded-lg file:border-0
               file:bg-surface-3 file:px-3 file:py-1.5 file:text-text"
      />
    </FormField>
  </ConfigSection>

  <ConfigSection title={$_('config.firmware.maintenance')}>
    <FormField label={$_('config.firmware.restart_evse')}>
      <Button label={$_('config.firmware.restart_evse')} variant="ghost" disabled={busy} onclick={() => restart('evse')} />
    </FormField>
    <FormField label={$_('config.firmware.restart_gateway')}>
      <Button label={$_('config.firmware.restart_gateway')} variant="ghost" disabled={busy} onclick={() => restart('gateway')} />
    </FormField>
    <FormField label={$_('config.firmware.reset')} description={$_('config.firmware.reset_desc')}>
      {#if confirmReset}
        <div class="rounded-xl border border-error/40 bg-surface-2 p-3">
          <p class="mb-2 text-sm text-error">{$_('config.firmware.reset_confirm')}</p>
          <div class="flex gap-2">
            <Button label={$_('config.firmware.reset')} onclick={factoryReset} />
            <Button label={$_('config.certificates.cancel')} variant="ghost" onclick={() => (confirmReset = false)} />
          </div>
        </div>
      {:else}
        <Button label={$_('config.firmware.reset')} variant="ghost" onclick={() => (confirmReset = true)} />
      {/if}
    </FormField>
  </ConfigSection>
</ConfigPage>
```

- [ ] **Step 4: Run the test — expect PASS.**
- [ ] **Step 5: Commit** — `git commit -m "Add the Firmware config page"`

---

## Task 8: i18n, route wiring, mock routes

**Files:**
- Modify: `src/lib/i18n/en.json`, `src/lib/routes.js`, `dev/mock-plugin.js`

- [ ] **Step 1: Extend the `config` object in `en.json`** with these sub-objects
(alongside all existing keys — remove nothing):

```json
"about": {
  "versions": "Versions",
  "firmware": "OpenEVSE firmware",
  "gateway": "WiFi gateway firmware",
  "links": "Links",
  "docs": "Documentation",
  "repo_wifi": "WiFi firmware on GitHub",
  "repo_evse": "EVSE firmware on GitHub",
  "credit": "Powered by OpenEVSE and OpenEnergyMonitor"
},
"certificates": {
  "installed": "Installed certificates",
  "empty": "No certificates installed.",
  "add": "Add certificate",
  "delete": "Delete certificate",
  "type": "Type",
  "root": "Root",
  "client": "Client",
  "name": "Name",
  "certificate": "Certificate",
  "private_key": "Private key",
  "save": "Save",
  "cancel": "Cancel"
},
"terminal": {
  "rapi": "RAPI command console",
  "command": "Command",
  "send": "Send",
  "clear": "Clear",
  "consoles": "Live consoles",
  "debug": "Debug console",
  "evse": "EVSE console",
  "connecting": "Connecting…",
  "unavailable": "Console unavailable."
},
"firmware": {
  "versions": "Installed versions",
  "evse": "OpenEVSE firmware",
  "gateway": "WiFi gateway firmware",
  "update": "Firmware update",
  "update_desc": "Upload a .bin or .hex firmware file to update the WiFi gateway.",
  "choose_file": "Choose firmware file",
  "install": "Install firmware",
  "ota_started": "Update in progress…",
  "ota_completed": "Update complete.",
  "ota_failed": "Update failed.",
  "backup": "Configuration backup",
  "backup_desc": "Download the current configuration, secrets removed.",
  "backup_export": "Download backup",
  "backup_import": "Restore from file",
  "maintenance": "Maintenance",
  "restart_evse": "Restart EVSE",
  "restart_gateway": "Restart WiFi gateway",
  "reset": "Factory reset",
  "reset_desc": "Erases all settings and WiFi credentials.",
  "reset_confirm": "This erases all settings. Are you sure?"
}
```

Validate the file is parseable JSON.

- [ ] **Step 2: Wire the routes** — in `src/lib/routes.js`, add four imports and four
override assignments after the placeholder loop (alongside the earlier batches):

```js
import Firmware from '../routes/settings/Firmware.svelte'
import Certificates from '../routes/settings/Certificates.svelte'
import Terminal from '../routes/settings/Terminal.svelte'
import About from '../routes/settings/About.svelte'
```

```js
routes['/settings/firmware'] = Firmware
routes['/settings/certificates'] = Certificates
routes['/settings/terminal'] = Terminal
routes['/settings/about'] = About
```

- [ ] **Step 3: Add mock routes** to `dev/mock-plugin.js` so the System pages work
offline. In the HTTP mock middleware (study how `/api/rfid/add` is handled), add:
  - `POST /api/restart` → 200 JSON `{ msg: 'restart ' + (parsed body device) }`. If the
    body cannot be parsed, default to `{ msg: 'restart gateway' }`.
  - `GET /api/reset` → 200 JSON `{ msg: 'done' }`.
  - `POST /api/update` → 200 plain text `OK`.
  - `GET /api/r` (RAPI) → 200 JSON `{ cmd: '<the rapi query param>', ret: '$OK^20' }`.
  - `POST /api/certificates` → 200 JSON `{ msg: 'done', id: String(Date.now()) }`.
  - `DELETE /api/certificates/<id>` → 200 JSON `{ msg: 'done' }`.

  Keep each handler minimal and consistent with the existing style. The existing
  `GET /api/certificates` fixture route already returns `[]` — leave it.

- [ ] **Step 4: Verify** — `npm test` green; `npm run build` succeeds, assets gzipped;
`en.json` valid JSON.
- [ ] **Step 5: Commit** — `git commit -m "Wire the System config pages and i18n"`

---

## Verification gate (before merge)

- [ ] `npm test` — all tests pass.
- [ ] `npm run build` — succeeds; all `dist/assets` JS/CSS gzipped (except `sw.js`).
- [ ] Playwright visual check — `npm run dev:mock`, visit `/#/settings/firmware`,
      `/certificates`, `/terminal`, `/about`. Confirm each renders, the certificate
      add-modal opens, the RAPI console sends a command, the reset confirmation
      appears, no console/page errors.

## On completion

Hand off to `superpowers:finishing-a-development-branch` to merge `config-system` to
`main`. This completes the Settings area — all 17 config pages built. Post the final
summary per the runbook.

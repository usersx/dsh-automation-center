import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const viewSource = readFileSync(new URL('../src/client/AutomationView.tsx', import.meta.url), 'utf8')
const styleSource = readFileSync(new URL('../src/client/styles.ts', import.meta.url), 'utf8')
const sidebarActionSource = readFileSync(new URL('../src/client/AutomationSidebarAction.tsx', import.meta.url), 'utf8')
const surfaceSource = readFileSync(new URL('../src/client/surface.tsx', import.meta.url), 'utf8')

test('every Automation view state is a standalone shell page, not a conversation overlay', () => {
  const roots = viewSource.match(/data-conversation-composer-overlay=""/g) ?? []
  assert.equal(roots.length, 0, 'global shell pages must not claim the Session composer overlay contract')

  const shellRule = styleSource.match(/\.dsh-automation-shell\{([^}]+)\}/)?.[1]
  assert.ok(shellRule, 'the Automation shell rule must exist')
  assert.match(shellRule, /(?:^|;)height:100%(?:;|$)/)
  assert.match(shellRule, /(?:^|;)min-height:0(?:;|$)/)
  assert.match(shellRule, /(?:^|;)overflow:auto(?:;|$)/)
  assert.match(shellRule, /(?:^|;)overscroll-behavior:contain(?:;|$)/)
  assert.doesNotMatch(
    styleSource,
    /dsh-automation-nav/,
    'the plugin must not own root-action geometry or skin-specific chrome',
  )
  assert.match(sidebarActionSource, /renderAction\(\{/)
  assert.match(sidebarActionSource, /DSH_AUTOMATION_INCOMPATIBLE/)
})

test('stock DSH conversation fallback opts into the native composer overlay contract', () => {
  assert.match(surfaceSource, /data-conversation-composer-overlay/)
  assert.match(styleSource, /\.dsh-automation-conversation-surface\{[^}]*height:100%/)
  assert.match(
    styleSource,
    /\.dsh-automation-conversation-surface \.dsh-automation-shell\{padding-bottom:calc\(var\(--dsh-composer-height,152px\) \+ 36px\)\}/,
    'the stock Session composer must not cover Automation actions',
  )
})

test('the Automation Center responds to its slot container, not only the browser viewport', () => {
  assert.match(styleSource, /container-name:dsh-automation/)
  assert.match(styleSource, /container-type:inline-size/)
  assert.match(styleSource, /@container dsh-automation \(max-width:1100px\)/)
  assert.match(styleSource, /@container dsh-automation \(max-width:760px\)/)
  assert.match(styleSource, /@container dsh-automation \(max-width:480px\)/)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { createDefinition, createManualRun } from '../src/domain.ts'
import { classifyExecutorError, executeAutomationRun, unattendedToolGuardReason } from '../src/executor.ts'

class TrackingAbortSignal {
  aborted = false
  readonly listeners = new Set<EventListenerOrEventListenerObject>()
  added = 0
  removed = 0

  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (type !== 'abort' || listener === null) return
    this.added += 1
    this.listeners.add(listener)
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
    if (type !== 'abort' || listener === null || !this.listeners.delete(listener)) return
    this.removed += 1
  }
}

function executorFixture(options: { readonly hangUntilCancelled?: boolean } = {}) {
  const definition = createDefinition({
    id: 'automation-executor',
    name: 'Executor test',
    prompt: 'Return one bounded result.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    workspaceId: 'workspace-1',
    cwd: '/workspace/repo',
    agentPreset: 'standard',
    createdBy: { kind: 'web', sessionId: 'session-source' },
    now: '2026-08-13T00:00:00Z',
  })
  const run = createManualRun(definition, '2026-08-13T00:05:00Z', 'executor-test')
  let followedUp = false
  let cancelled = false
  let renamedTitle: string | undefined
  const lifecycle: string[] = []
  let settleIdle = () => {}
  const hangingIdle = new Promise<void>(resolve => { settleIdle = resolve })
  const session = { seq: 0, events: [] as Array<{ seq: number; type: string; data: Record<string, unknown> }> }
  const agent = {
    session,
    whenIdle: () => {
      if (!followedUp || !options.hangUntilCancelled || cancelled) return Promise.resolve()
      return hangingIdle
    },
    followup: () => {
      lifecycle.push('followup')
      followedUp = true
      if (options.hangUntilCancelled) return
      session.events.push(
        { seq: 0, type: 'turn/start', data: {} },
        { seq: 1, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'done' }] } } },
        { seq: 2, type: 'turn/end', data: { reason: { kind: 'completed' } } },
      )
      session.seq = 3
    },
    cancel: () => {
      cancelled = true
      settleIdle()
    },
  }
  const workspace = {
    path: '/workspace/repo',
    status: async () => 'ok' as const,
    attachSession: async () => {},
  }
  const ctx = {
    workspaceRegistry: { get: () => workspace },
    agentDefaultModel: { currentSelection: () => ({ provider: 'provider', model: 'model' }) },
    agentPresets: { mount: async () => {} },
    agents: {
      withoutInitiator: (operation: () => unknown) => operation(),
      create: async (input: { setup: (ctx: unknown) => Promise<void> }) => {
        await input.setup({ agent, tools: { guard: () => {} } })
        return { agent, dispose: async () => {} }
      },
    },
    sessionTitle: {
      rename: (target: unknown, title: string) => {
        assert.equal(target, session)
        renamedTitle = title
        lifecycle.push('rename')
      },
    },
    sessions: { flush: async () => true },
  }
  return {
    ctx, definition, run,
    wasCancelled: () => cancelled,
    renamedTitle: () => renamedTitle,
    lifecycle: () => lifecycle,
  }
}

test('unattended tool guard blocks interaction, delegation, and background process escape', () => {
  assert.match(unattendedToolGuardReason('ask_user_question', {}) ?? '', /allowlist/)
  assert.match(unattendedToolGuardReason('subagent', {}) ?? '', /allowlist/)
  assert.match(unattendedToolGuardReason('cordis_mount', {}) ?? '', /allowlist/)
  assert.match(unattendedToolGuardReason('automation_create', {}) ?? '', /allowlist/)
  assert.match(unattendedToolGuardReason('bash', { run_in_background: true }) ?? '', /Background/)
})

test('unattended tool guard preserves foreground coding and read tools', () => {
  assert.equal(unattendedToolGuardReason('read', { path: 'README.md' }), undefined)
  assert.equal(unattendedToolGuardReason('edit', { path: 'README.md' }), undefined)
  assert.equal(unattendedToolGuardReason('bash', { command: 'pnpm test' }), undefined)
  assert.equal(unattendedToolGuardReason('web_search', { query: 'package docs' }), undefined)
  assert.match(unattendedToolGuardReason('third_party_side_effect', {}) ?? '', /allowlist/)
})

test('executor removes its abort listener after a normally completed run', async () => {
  const fixture = executorFixture()
  const signal = new TrackingAbortSignal()
  const completion = await executeAutomationRun(
    fixture.ctx as never,
    fixture.definition,
    fixture.run,
    { runTimeoutMs: 1_000, sessionId: 'dsh-automation-session-complete', signal: signal as unknown as AbortSignal },
  )

  assert.equal(completion.status, 'succeeded')
  assert.equal(signal.added, 1)
  assert.equal(signal.removed, 1)
  assert.equal(signal.listeners.size, 0)
})

test('executor pins the fresh Result Session to the automation task name before prompting', async () => {
  const fixture = executorFixture()
  const completion = await executeAutomationRun(
    fixture.ctx as never,
    fixture.definition,
    fixture.run,
    { runTimeoutMs: 1_000, sessionId: 'dsh-automation-session-title' },
  )

  assert.equal(completion.status, 'succeeded')
  assert.equal(fixture.renamedTitle(), 'Executor test')
  assert.deepEqual(fixture.lifecycle().slice(0, 2), ['rename', 'followup'])
})

test('executor timeout cancels a stuck Agent, settles, and removes its abort listener', async () => {
  const fixture = executorFixture({ hangUntilCancelled: true })
  const signal = new TrackingAbortSignal()
  const completion = await Promise.race([
    executeAutomationRun(
      fixture.ctx as never,
      fixture.definition,
      fixture.run,
      { runTimeoutMs: 5, sessionId: 'dsh-automation-session-timeout', signal: signal as unknown as AbortSignal },
    ),
    new Promise<never>((_resolve, reject) => {
      setTimeout(() => reject(new Error('executor timeout path did not settle')), 250)
    }),
  ])

  assert.equal(completion.status, 'failed')
  assert.equal(completion.error?.code, 'run_timeout')
  assert.equal(fixture.wasCancelled(), true)
  assert.equal(signal.added, 1)
  assert.equal(signal.removed, 1)
  assert.equal(signal.listeners.size, 0)
})

test('executor setup failures retain an actionable error classification', () => {
  assert.equal(classifyExecutorError(new Error('Agent preset standard is unavailable')).code, 'preset_unavailable')
  assert.equal(classifyExecutorError(new Error('The selected model cannot be loaded')).code, 'model_unavailable')
  assert.equal(classifyExecutorError(new Error('Permission denied by sandbox')).code, 'permission_denied')
  assert.equal(classifyExecutorError(new Error('Agent process crashed')).code, 'agent_crashed')
  assert.equal(classifyExecutorError(new Error('Unknown failure')).code, 'executor_error')
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { registerAutomationRpc } from '../src/rpc.ts'

test('snapshot marks archived run Sessions so the client never offers a broken open action', async () => {
  let handler: ((endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>) | undefined
  const ctx = {
    connection: { rpc: { handle: (_channel: string, value: typeof handler) => { handler = value; return async () => {} } } },
  }
  const service = {
    snapshot: async () => ({
      generatedAt: '2026-08-17T00:00:00.000Z',
      workspaces: [{ id: 'workspace-1', title: 'Repository', path: '/workspace/repo' }],
      presets: [{ id: 'standard', name: 'Standard', broken: false }],
      defaultModel: { provider: 'deepseek', model: 'deepseek-chat', reasoningEffort: null },
      models: [{ provider: 'deepseek', providerName: 'DeepSeek', model: 'deepseek-chat', modelName: 'DeepSeek Chat', reasoningEfforts: [] }],
      migration: { detectedDefinitions: 0, detectedRuns: 0, importedDefinitions: 0, importedRuns: 0 },
      definitions: [],
      runs: [{
        id: 'run-archived', automationId: 'automation-deleted', definitionRevision: 1,
        occurrenceKey: 'manual:automation-deleted:archived', trigger: 'manual',
        scheduledFor: '2026-08-17T00:00:00.000Z', status: 'succeeded',
        promptSnapshot: 'Inspect one condition.', targetSnapshot: {
          workspaceId: 'workspace-1', cwd: '/workspace/repo', agentPreset: 'code',
          provider: null, model: null, permissionPreset: 'read-only',
          runTimeoutMinutes: 60,
        },
        sessionId: 'dsh-automation-session-archived', sessionArchived: true,
        startedAt: '2026-08-17T00:00:01.000Z', finishedAt: '2026-08-17T00:00:02.000Z',
        summary: 'No regression found.', error: null, unread: false,
      }],
    }),
  }
  registerAutomationRpc(ctx as never, service as never)

  const response = await handler?.('snapshot', {}, new AbortController().signal)
  assert.deepEqual(response, {
    ok: true,
    value: {
      filterWorkspaceId: undefined,
      workspaces: [{ id: 'workspace-1', title: 'Repository', path: '/workspace/repo' }],
      presets: [{ id: 'standard', name: 'Standard', broken: false }],
      defaultModel: { provider: 'deepseek', model: 'deepseek-chat', reasoningEffort: null },
      models: [{ provider: 'deepseek', providerName: 'DeepSeek', model: 'deepseek-chat', modelName: 'DeepSeek Chat', reasoningEfforts: [] }],
      migration: { detectedDefinitions: 0, detectedRuns: 0, importedDefinitions: 0, importedRuns: 0 },
      automations: [],
      runs: [{
        id: 'run-archived', automationId: 'automation-deleted', automationName: 'Deleted automation',
        status: 'succeeded', trigger: 'manual', scheduledFor: '2026-08-17T00:00:00.000Z',
        startedAt: '2026-08-17T00:00:01.000Z', finishedAt: '2026-08-17T00:00:02.000Z',
        sessionId: 'dsh-automation-session-archived', sessionArchived: true,
        summary: 'No regression found.', unread: false,
      }],
      serverNow: '2026-08-17T00:00:00.000Z',
    },
  })
})

test('mark-read RPC is loopback-only and propagates scoped service calls and cancellation', async () => {
  let handler: ((endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>) | undefined
  let removed = false
  const ctx = {
    connection: {
      rpc: {
        handle: (
          channel: string,
          value: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>,
          options: unknown,
        ) => {
          assert.equal(channel, '/dsh-automation-center')
          assert.deepEqual(options, { authority: 'loopback' })
          handler = value
          return async () => { removed = true }
        },
      },
    },
  }
  const calls: Array<{ scope: unknown; command: unknown; signal: AbortSignal | undefined }> = []
  const receipt = {
    requestId: 'request-mark-read', command: 'mark-read', outcome: 'committed',
    entityId: 'run-deleted-definition', revision: null, appliedAt: '2026-08-17T00:00:00.000Z', replayed: false,
  }
  const service = {
    dispatch: async (scope: unknown, command: unknown, signal?: AbortSignal) => {
      calls.push({ scope, command, signal })
      return receipt
    },
  }
  const remove = registerAutomationRpc(ctx, service as never)
  const controller = new AbortController()

  const response = await handler?.('mark-read', {
    workspaceId: 'workspace-1',
    runId: 'run-deleted-definition',
    clientRequestId: 'request-mark-read',
  }, controller.signal)
  assert.deepEqual(response, { ok: true, value: receipt })
  assert.deepEqual(calls, [{
    scope: { workspaceId: 'workspace-1', creatorKind: 'web' },
    command: { kind: 'mark-read', requestId: 'request-mark-read', runId: 'run-deleted-definition' },
    signal: controller.signal,
  }])

  controller.abort()
  const cancelled = await handler?.('mark-read', {
    workspaceId: 'workspace-1',
    runId: 'run-not-admitted',
    clientRequestId: 'request-cancelled',
  }, controller.signal)
  assert.deepEqual(cancelled, {
    ok: false,
    error: { code: 'cancelled', message: 'The automation request was cancelled.', details: {} },
  })
  assert.equal(calls.length, 1)
  await remove()
  assert.equal(removed, true)
})

test('RPC schedule inputs are strict JSON contracts and do not coerce strings or booleans', async () => {
  let handler: ((endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>) | undefined
  let createCalls = 0
  const ctx = {
    connection: { rpc: { handle: (_channel: string, value: typeof handler) => { handler = value; return async () => {} } } },
  }
  const service = { create: async () => { createCalls += 1; return { id: 'created', revision: 1 } } }
  registerAutomationRpc(ctx as never, service as never)
  const signal = new AbortController().signal
  const base = { workspaceId: 'workspace-1', input: { name: 'Strict input', prompt: 'Inspect one condition.', timeZone: 'UTC' } }

  const interval = await handler?.('create', {
    ...base,
    input: { ...base.input, schedule: { kind: 'interval', everyMinutes: '5' } },
  }, signal) as { readonly ok: boolean; readonly error?: { readonly code: string } }
  assert.equal(interval.ok, false)
  assert.equal(interval.error?.code, 'bad-request')

  const weekly = await handler?.('create', {
    ...base,
    input: { ...base.input, schedule: { kind: 'weekly', time: '09:00', weekdays: [true] } },
  }, signal) as { readonly ok: boolean; readonly error?: { readonly code: string } }
  assert.equal(weekly.ok, false)
  assert.equal(weekly.error?.code, 'bad-request')
  assert.equal(createCalls, 0)
})

test('update RPC replaces editable fields behind an expected revision guard', async () => {
  let handler: ((endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>) | undefined
  const calls: Array<{ scope: unknown; command: unknown; signal: AbortSignal | undefined }> = []
  const ctx = {
    connection: { rpc: { handle: (_channel: string, value: typeof handler) => { handler = value; return async () => {} } } },
  }
  const service = {
    dispatch: async (scope: unknown, command: unknown, signal?: AbortSignal) => {
      calls.push({ scope, command, signal })
      return {
        requestId: 'request-edit', command: 'update', outcome: 'committed', entityId: 'automation-edit',
        revision: 4, appliedAt: '2026-08-17T00:00:00.000Z', replayed: false,
      }
    },
  }
  registerAutomationRpc(ctx as never, service as never)
  const signal = new AbortController().signal
  const response = await handler?.('update', {
    workspaceId: 'workspace-1',
    automationId: 'automation-edit',
    clientRequestId: 'request-edit',
    expectedRevision: 3,
    input: {
      name: 'Edited task',
      prompt: 'The complete edited prompt.',
      schedule: { kind: 'weekly', time: '09:15', weekdays: [1, 5] },
      timeZone: 'Asia/Shanghai',
      permission: 'workspace-write',
      modelPolicy: { mode: 'pinned', provider: 'deepseek', model: 'deepseek-reasoner', reasoningEffort: 'high' },
    },
  }, signal)

  assert.deepEqual(response, { ok: true, value: {
    requestId: 'request-edit', command: 'update', outcome: 'committed', entityId: 'automation-edit',
    revision: 4, appliedAt: '2026-08-17T00:00:00.000Z', replayed: false,
  } })
  assert.deepEqual(calls, [{
    scope: { workspaceId: 'workspace-1', creatorKind: 'web' },
    command: {
      kind: 'update', requestId: 'request-edit', automationId: 'automation-edit',
      input: {
        expectedRevision: 3,
        name: 'Edited task',
        prompt: 'The complete edited prompt.',
        schedule: { kind: 'weekly', time: '09:15', weekdays: ['MO', 'FR'], timeZone: 'Asia/Shanghai' },
        permissionPreset: 'workspace-write',
        modelPolicy: { mode: 'pinned', provider: 'deepseek', model: 'deepseek-reasoner', reasoningEffort: 'high' },
      },
    },
    signal,
  }])
})

test('review RPC emits an idempotent scoped review command', async () => {
  let handler: ((endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>) | undefined
  const calls: Array<{ scope: unknown; command: unknown }> = []
  const ctx = {
    connection: { rpc: { handle: (_channel: string, value: typeof handler) => { handler = value; return async () => {} } } },
  }
  const service = {
    dispatch: async (scope: unknown, command: unknown) => {
      calls.push({ scope, command })
      return { requestId: 'review-1', command: 'review-keep', outcome: 'committed', appliedAt: '2026-08-17T00:00:00Z', replayed: false }
    },
  }
  registerAutomationRpc(ctx as never, service as never)
  const response = await handler?.('review', {
    workspaceId: 'workspace-1', runId: 'run-review', action: 'keep', clientRequestId: 'review-1',
  }, new AbortController().signal)
  assert.deepEqual(response, { ok: true, value: {
    requestId: 'review-1', command: 'review-keep', outcome: 'committed', appliedAt: '2026-08-17T00:00:00Z', replayed: false,
  } })
  assert.deepEqual(calls, [{
    scope: { workspaceId: 'workspace-1', creatorKind: 'web' },
    command: { kind: 'review-keep', requestId: 'review-1', runId: 'run-review' },
  }])
})

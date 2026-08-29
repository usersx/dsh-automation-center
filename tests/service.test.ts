import assert from 'node:assert/strict'
import test from 'node:test'
import { createDefinition, createManualRun, createScheduledRun } from '../src/domain.ts'
import { AutomationService, type AutomationConfig } from '../src/service.ts'
import type { LegacyDefinition, LegacyRun } from '../src/legacy.ts'
import type { AutomationDefinition, AutomationRun } from '../src/types.ts'

class MemoryTable<Value> {
  readonly writes: Value[] = []
  constructor(
    readonly records = new Map<string, Value>(),
    private readonly writable: () => boolean = () => true,
  ) {}
  get(key: string): Value | undefined { return this.records.get(key) }
  entries(): IterableIterator<[string, Value]> { return new Map(this.records).entries() }
  keys(): IterableIterator<string> { return new Map(this.records).keys() }
  get size(): number { return this.records.size }
  async put(key: string, value: Value): Promise<void> {
    if (!this.writable()) throw new Error('domain is closed')
    this.records.set(key, value)
    this.writes.push(value)
  }
  async delete(key: string): Promise<boolean> {
    if (!this.writable()) throw new Error('domain is closed')
    return this.records.delete(key)
  }
  async update(key: string, transform: (current: Value) => Value): Promise<Value> {
    if (!this.writable()) throw new Error('domain is closed')
    const current = this.records.get(key)
    if (current === undefined) throw new Error(`missing key '${key}'`)
    const next = transform(current)
    this.records.set(key, next)
    return next
  }
}

class MemoryDomain {
  readonly definitions: MemoryTable<AutomationDefinition>
  readonly runs: MemoryTable<AutomationRun>
  readonly receipts = new MemoryTable<unknown>()
  closed = false
  constructor(
    definitions: readonly AutomationDefinition[] = [],
    runs: readonly AutomationRun[] = [],
  ) {
    const writable = () => !this.closed
    this.definitions = new MemoryTable(new Map(definitions.map(value => [value.id, value])), writable)
    this.runs = new MemoryTable(new Map(runs.map(value => [value.id, value])), writable)
  }
  reopen(): void { this.closed = false }
  table(name: 'definitions' | 'runs' | 'receipts'): MemoryTable<AutomationDefinition> | MemoryTable<AutomationRun> | MemoryTable<unknown> {
    return name === 'definitions' ? this.definitions : name === 'runs' ? this.runs : this.receipts
  }
  async close(): Promise<void> { this.closed = true }
}

const scope = { sessionId: 'session-source', creatorKind: 'agent' as const }
const otherWorkspaceScope = { sessionId: 'session-other-workspace', creatorKind: 'agent' as const }
const defaults: AutomationConfig = {
  maxConcurrentRuns: 0,
  runTimeoutMs: 60_000,
  misfireGraceMs: 15 * 60_000,
  historyLimit: 200,
  archiveRunSessions: false,
}

function storedDefinition(now: string): AutomationDefinition {
  return createDefinition({
    id: 'automation-existing',
    name: 'Existing automation',
    prompt: 'Inspect the repository and return a bounded report.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    workspaceId: 'workspace-1',
    cwd: '/workspace/repo',
    agentPreset: 'standard',
    createdBy: { kind: 'web', sessionId: scope.sessionId },
    now,
  })
}

async function harness(seed?: {
  readonly definitions?: readonly AutomationDefinition[]
  readonly runs?: readonly AutomationRun[]
  readonly config?: Partial<AutomationConfig>
  readonly completeRuns?: boolean
  readonly rejectArchive?: boolean
  readonly unavailableModel?: string
  readonly resolveModelGate?: Promise<void>
  readonly resolveWorkspaceGate?: Promise<void>
  readonly onResolveWorkspace?: () => void
  readonly legacyDefinitions?: readonly LegacyDefinition[]
  readonly legacyRuns?: readonly LegacyRun[]
}): Promise<{
  service: AutomationService
  domain: MemoryDomain
  archivedSessionIds: string[]
  warnings: string[]
  removeSourceAgent(): void
  reopenService(): Promise<AutomationService>
}> {
  const domain = new MemoryDomain(seed?.definitions, seed?.runs)
  const legacyDefinitions = new MemoryTable(new Map((seed?.legacyDefinitions ?? []).map(value => [value.id, value])))
  const legacyRuns = new MemoryTable(new Map((seed?.legacyRuns ?? []).map(value => [value.id, value])))
  const legacyDomain = {
    table: (name: 'definitions' | 'runs') => name === 'definitions' ? legacyDefinitions : legacyRuns,
    close: async () => {},
  }
  const workspace = {
    id: 'workspace-1', title: 'Repository', path: '/workspace/repo',
    status: async () => 'ok' as const,
    attachSession: async () => {},
  }
  const otherWorkspace = {
    id: 'workspace-2', title: 'Other repository', path: '/workspace/other',
    status: async () => 'ok' as const,
    attachSession: async () => {},
  }
  const sourceAgent = {
    id: scope.sessionId,
    ctx: {},
    session: {
      header: { cwd: workspace.path, agentPreset: 'legacy-preset' },
      requestHeader: () => ({ config: { provider: 'current-provider', model: 'current-model' } }),
    },
  }
  const otherSourceAgent = {
    id: otherWorkspaceScope.sessionId,
    ctx: {},
    session: {
      header: { cwd: otherWorkspace.path, agentPreset: 'legacy-preset' },
      requestHeader: () => ({ config: { provider: 'current-provider', model: 'current-model' } }),
    },
  }
  let liveSourceAgent: typeof sourceAgent | undefined = sourceAgent
  const archivedSessionIds: string[] = []
  const warnings: string[] = []
  const runSession = {
    seq: 0,
    events: [] as Array<{ seq: number; type: string; data: Record<string, unknown> }>,
  }
  const runAgent = {
    session: runSession,
    whenIdle: async () => {},
    followup: () => {
      runSession.events.push(
        { seq: 0, type: 'turn/start', data: {} },
        { seq: 1, type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'completed result' }] } } },
        { seq: 2, type: 'turn/end', data: { reason: { kind: 'completed' } } },
      )
      runSession.seq = 3
    },
    cancel: () => {},
  }
  const ctx = {
    storageDomain: { open: async (spec: { name: string }) => {
      if (spec.name === 'dsh_automation') return legacyDomain
      domain.reopen()
      return domain
    } },
    workspaceRegistry: {
      get archivedSessionIds() { return archivedSessionIds },
      list: () => [workspace, otherWorkspace],
      resolveByPath: async (path: string) => {
        seed?.onResolveWorkspace?.()
        await seed?.resolveWorkspaceGate
        if (path === workspace.path) return workspace
        if (path === otherWorkspace.path) return otherWorkspace
        return undefined
      },
      get: () => workspace,
      archiveSession: async (sessionId: string) => {
        if (seed?.rejectArchive) throw new Error('archive unavailable')
        if (!archivedSessionIds.includes(sessionId)) archivedSessionIds.push(sessionId)
      },
    },
    agents: {
      get: (id: string) => {
        if (id === liveSourceAgent?.id) return liveSourceAgent
        if (id === otherSourceAgent.id) return otherSourceAgent
        return undefined
      },
      withoutInitiator: (task: () => unknown) => task(),
      create: async (input: { setup: (ctx: unknown) => Promise<void> }) => {
        if (!seed?.completeRuns) throw new Error('executor is not expected in service unit tests')
        await input.setup({ agent: runAgent, tools: { guard: () => {}, register: () => () => {} } })
        return { agent: runAgent, dispose: async () => {} }
      },
    },
    agentDefaultModel: { currentSelection: () => ({ provider: 'provider', model: 'model', reasoningEffort: 'high' }) },
    llm: {
      listProviders: () => [{ id: 'provider', name: 'Provider' }, { id: 'deepseek', name: 'DeepSeek' }],
      listModels: async (provider: string) => provider === 'deepseek'
        ? [{ provider, id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' }]
        : [{ provider, id: 'model', name: 'Model' }],
      resolveModelInfo: async (provider: string, model: string, signal?: AbortSignal) => {
        if (seed?.resolveModelGate !== undefined) {
          await Promise.race([
            seed.resolveModelGate,
            new Promise<never>((_resolve, reject) => {
              const abort = () => reject(new Error('The automation request was cancelled.'))
              if (signal?.aborted === true) abort()
              else signal?.addEventListener('abort', abort, { once: true })
            }),
          ])
        }
        if (`${provider}/${model}` === seed?.unavailableModel) throw new Error(`No adapter owns ${provider}/${model}`)
        return {
          provider, id: model, name: model,
          reasoning: { efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }], defaultEffort: 'high' },
        }
      },
    },
    agentPresets: {
      mount: async () => ({ id: 'standard' }),
      composedPreset: () => 'code',
      defaultId: 'standard',
      resolve: async (id: string) => ({ id }),
      list: async () => [{ id: 'standard', name: 'Standard' }, { id: 'code', name: 'Code' }],
    },
    sessionTitle: { rename: () => {} },
    sessions: { flush: async () => true },
    logger: { warn: (message: string) => { warnings.push(message) } },
  }
  const config = { ...defaults, ...seed?.config }
  const reopenService = () => AutomationService.open(ctx as never, config)
  const service = await reopenService()
  return {
    service,
    domain,
    archivedSessionIds,
    warnings,
    removeSourceAgent: () => { liveSourceAgent = undefined },
    reopenService,
  }
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  throw new Error('condition did not become true')
}

async function flushMicrotasks(rounds = 30): Promise<void> {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve()
}

test('run now admits at most one queued or running occurrence per automation', async () => {
  const { service } = await harness()
  const definition = await service.create(scope, {
    name: 'Regression triage',
    prompt: 'Inspect test failures and return evidence without editing files.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
  })
  const first = await service.runNow(scope, definition.id)
  assert.equal(definition.agentPreset, 'code')
  assert.deepEqual(definition.modelPolicy, { mode: 'inherit' })
  assert.equal(definition.provider, null)
  assert.equal(definition.model, null)
  assert.equal(first.status, 'queued')
  await assert.rejects(() => service.runNow(scope, definition.id), /queued or running/)
  await service.dispose()
})

test('pinned model policy is validated and snapshotted without following later defaults', async () => {
  const { service } = await harness()
  const definition = await service.create({ creatorKind: 'web', workspaceId: 'workspace-1' }, {
    name: 'Pinned model task',
    prompt: 'Use one explicit model.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    modelPolicy: {
      mode: 'pinned', provider: 'deepseek', model: 'deepseek-reasoner', reasoningEffort: 'low',
    },
  })
  const run = await service.runNow({ creatorKind: 'web', workspaceId: 'workspace-1' }, definition.id)
  assert.deepEqual(definition.modelPolicy, {
    mode: 'pinned', provider: 'deepseek', model: 'deepseek-reasoner', reasoningEffort: 'low',
  })
  assert.deepEqual(run.targetSnapshot.modelPolicy, definition.modelPolicy)
  await service.dispose()

  const unavailable = await harness({ unavailableModel: 'missing/model' })
  await assert.rejects(() => unavailable.service.create({ creatorKind: 'web', workspaceId: 'workspace-1' }, {
    name: 'Unavailable model task',
    prompt: 'This must fail before scheduling.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    modelPolicy: { mode: 'pinned', provider: 'missing', model: 'model' },
  }), /unavailable/i)
  await unavailable.service.dispose()
})

test('create is idempotent for one durable client request id', async () => {
  const { service } = await harness()
  const request = {
    clientRequestId: 'request-save-once',
    name: 'Idempotent task',
    prompt: 'Inspect one bounded condition.',
    schedule: { kind: 'daily' as const, time: '09:00', timeZone: 'UTC' },
  }
  const first = await service.create(scope, request)
  const retried = await service.create(scope, request)
  assert.equal(retried.id, first.id)
  assert.equal((await service.snapshot(scope)).definitions.length, 1)
  await service.dispose()
})

test('dispatch returns a durable receipt and replays every mutating command once', async () => {
  const { service, domain } = await harness()
  const definition = await service.create(scope, {
    name: 'Receipt task',
    prompt: 'Inspect one bounded condition.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
  })
  const command = {
    kind: 'run-now' as const,
    requestId: 'request-run-once',
    automationId: definition.id,
  }
  const first = await service.dispatch(scope, command)
  const replay = await service.dispatch(scope, command)

  assert.equal(first.outcome, 'committed')
  assert.equal(first.command, 'run-now')
  assert.equal(first.replayed, false)
  assert.equal(replay.replayed, true)
  assert.equal(replay.entityId, first.entityId)
  assert.deepEqual(
    domain.receipts.writes.map(value => (value as { readonly outcome: string }).outcome),
    ['unknown', 'committed'],
  )
  assert.equal((await service.snapshot(scope)).runs.length, 1)
  await service.dispose()
})

test('legacy definitions and runs import once while source records remain unchanged', async () => {
  const current = storedDefinition('2026-08-13T00:00:00.000Z')
  const { runTimeoutMinutes: _definitionTimeout, ...legacyDefinition } = current
  const currentRun = createManualRun(current, '2026-08-13T00:01:00.000Z', 'legacy-run')
  const { runTimeoutMinutes: _runTimeout, ...legacyTarget } = currentRun.targetSnapshot
  const legacyRun = { ...currentRun, targetSnapshot: legacyTarget }
  const { service } = await harness({
    legacyDefinitions: [legacyDefinition as unknown as LegacyDefinition],
    legacyRuns: [legacyRun as unknown as LegacyRun],
  })
  const snapshot = await service.snapshot(scope)
  assert.deepEqual(snapshot.migration, {
    detectedDefinitions: 1,
    detectedRuns: 1,
    importedDefinitions: 1,
    importedRuns: 1,
  })
  assert.equal(snapshot.definitions[0]?.runTimeoutMinutes, 1)
  assert.equal(snapshot.runs[0]?.targetSnapshot.runTimeoutMinutes, 1)
  assert.equal('runTimeoutMinutes' in legacyDefinition, false)
  assert.equal('runTimeoutMinutes' in legacyRun.targetSnapshot, false)
  await service.dispose()
})

test('a committed legacy delete remains deleted after the service reopens', async () => {
  const current = storedDefinition('2026-08-13T00:00:00.000Z')
  const { runTimeoutMinutes: _definitionTimeout, ...legacyDefinition } = current
  const fixture = await harness({
    legacyDefinitions: [legacyDefinition as unknown as LegacyDefinition],
  })

  const receipt = await fixture.service.dispatch(scope, {
    kind: 'delete', requestId: 'delete-imported-once', automationId: current.id,
  })
  assert.equal(receipt.outcome, 'committed')
  await fixture.service.dispose()

  const reopened = await fixture.reopenService()
  try {
    const snapshot = await reopened.snapshot(scope)
    assert.equal(snapshot.definitions.some(definition => definition.id === current.id), false)
    assert.equal(snapshot.migration.detectedDefinitions, 1)
    assert.equal(snapshot.migration.importedDefinitions, 0)
  } finally {
    await reopened.dispose()
  }
})

test('a queued run can be cancelled once and remains auditable', async () => {
  const { service } = await harness()
  const definition = await service.create(scope, {
    name: 'Cancelable task',
    prompt: 'Inspect one bounded condition.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
  })
  const queued = await service.runNow(scope, definition.id)
  const cancelled = await service.cancelRun(scope, queued.id)
  assert.equal(cancelled.status, 'cancelled')
  assert.equal(cancelled.error?.code, 'cancelled')
  assert.equal((await service.snapshot(scope)).runs[0]?.status, 'cancelled')
  await assert.rejects(() => service.cancelRun(scope, queued.id), /Only a queued or running/)
})

test('the Web Automation Center snapshots all workspaces without a source Session', async () => {
  const { service } = await harness()
  const created = await service.create({ creatorKind: 'web', workspaceId: 'workspace-1' }, {
    name: 'Global task',
    prompt: 'Inspect this workspace from the global center.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    agentPreset: 'standard',
    runTimeoutMinutes: 25,
  })
  assert.equal(created.workspaceId, 'workspace-1')
  assert.equal(created.runTimeoutMinutes, 25)
  const snapshot = await service.snapshot({ creatorKind: 'web' })
  assert.deepEqual(snapshot.workspaces.map(workspace => workspace.id), ['workspace-1', 'workspace-2'])
  assert.equal(snapshot.definitions[0]?.id, created.id)
})

test('snapshot exposes model catalog and structured health without starting a run', async () => {
  const pinned = createDefinition({
    id: 'automation-health',
    name: 'Health check',
    prompt: 'Inspect one bounded condition.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    workspaceId: 'workspace-1', cwd: '/workspace/repo', agentPreset: 'standard',
    modelPolicy: { mode: 'pinned', provider: 'missing', model: 'model' },
    createdBy: { kind: 'web', sessionId: 'web:workspace-1' },
    now: '2026-08-13T00:00:00Z',
  })
  const { service } = await harness({ definitions: [pinned], unavailableModel: 'missing/model' })
  const snapshot = await service.snapshot({ creatorKind: 'web' })

  assert.deepEqual(snapshot.defaultModel, { provider: 'provider', model: 'model', reasoningEffort: 'high' })
  assert.equal(snapshot.models.some(model => model.provider === 'deepseek' && model.model === 'deepseek-reasoner'), true)
  assert.equal(snapshot.definitions[0]?.health.status, 'blocked')
  assert.equal(snapshot.definitions[0]?.health.issues[0]?.code, 'model_unavailable')
  await service.dispose()
})

test('snapshot derives an overdue occurrence when no scheduled run was admitted', async (context) => {
  const now = Date.parse('2026-08-13T00:06:00Z')
  context.mock.timers.enable({ apis: ['Date'], now })
  const definition = createDefinition({
    id: 'automation-overdue',
    name: 'Overdue task',
    prompt: 'Return one bounded result.',
    schedule: { kind: 'daily', time: '00:00', timeZone: 'UTC' },
    workspaceId: 'workspace-1', cwd: '/workspace/repo', agentPreset: 'standard',
    createdBy: { kind: 'web', sessionId: scope.sessionId },
    now: '2026-08-12T23:00:00Z',
  })
  const { service } = await harness({ definitions: [definition] })
  try {
    const health = (await service.snapshot(scope)).definitions[0]!.health
    assert.equal(health.status, 'overdue')
    assert.equal(health.expectedAt, '2026-08-13T00:00:00.000Z')
    assert.equal(health.admissionStatus, 'not_admitted')
    assert.equal(health.overdueByMs, 6 * 60_000)
    assert.equal(health.issues[0]?.code, 'occurrence_overdue')
  } finally {
    await service.dispose()
  }
})

test('snapshot separates scheduled admission from queue wait and execution claim', async (context) => {
  const now = Date.parse('2026-08-13T00:02:00Z')
  context.mock.timers.enable({ apis: ['Date'], now })
  const definition = createDefinition({
    id: 'automation-admitted',
    name: 'Admitted task',
    prompt: 'Return one bounded result.',
    schedule: { kind: 'daily', time: '00:00', timeZone: 'UTC' },
    workspaceId: 'workspace-1', cwd: '/workspace/repo', agentPreset: 'standard',
    createdBy: { kind: 'web', sessionId: scope.sessionId },
    now: '2026-08-12T23:00:00Z',
  })
  const queued = {
    ...createScheduledRun(definition, '2026-08-13T00:00:00Z'),
    admittedAt: '2026-08-13T00:00:30Z',
  }
  const { service } = await harness({ definitions: [definition], runs: [queued] })
  try {
    const snapshot = await service.snapshot(scope)
    const health = snapshot.definitions[0]!.health
    assert.equal(health.status, 'ready')
    assert.equal(health.admissionStatus, 'queued')
    assert.equal(health.admittedAt, queued.admittedAt)
    assert.equal(health.claimedAt, null)
    assert.equal(health.queueWaitMs, 90_000)
    assert.equal(snapshot.runs[0]?.admittedAt, queued.admittedAt)
  } finally {
    await service.dispose()
  }
})

test('snapshot reports a queued run that was admitted but never claimed', async (context) => {
  const now = Date.parse('2026-08-13T00:07:00Z')
  context.mock.timers.enable({ apis: ['Date'], now })
  const definition = createDefinition({
    id: 'automation-queue-stalled',
    name: 'Queue stalled task',
    prompt: 'Return one bounded result.',
    schedule: { kind: 'daily', time: '00:00', timeZone: 'UTC' },
    workspaceId: 'workspace-1', cwd: '/workspace/repo', agentPreset: 'standard',
    createdBy: { kind: 'web', sessionId: scope.sessionId },
    now: '2026-08-12T23:00:00Z',
  })
  const queued = {
    ...createScheduledRun(definition, '2026-08-13T00:00:00Z'),
    admittedAt: '2026-08-13T00:00:30Z',
  }
  const { service } = await harness({ definitions: [definition], runs: [queued] })
  try {
    const health = (await service.snapshot(scope)).definitions[0]!.health
    assert.equal(health.status, 'stalled')
    assert.equal(health.admissionStatus, 'queued')
    assert.equal(health.issues[0]?.code, 'queue_stalled')
    assert.equal(health.queueWaitMs, 390_000)
  } finally {
    await service.dispose()
  }
})

test('run preflight blocks an unavailable model before creating a Result Session', async () => {
  const pinned = createDefinition({
    id: 'automation-preflight',
    name: 'Preflight task',
    prompt: 'Inspect one bounded condition.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    workspaceId: 'workspace-1', cwd: '/workspace/repo', agentPreset: 'standard',
    modelPolicy: { mode: 'pinned', provider: 'missing', model: 'model' },
    createdBy: { kind: 'web', sessionId: 'web:workspace-1' },
    now: '2026-08-13T00:00:00Z',
  })
  const queued = createManualRun(pinned, '2026-08-13T00:05:00Z', 'preflight')
  const { service, domain } = await harness({
    definitions: [pinned], runs: [queued], unavailableModel: 'missing/model', config: { maxConcurrentRuns: 1 },
  })
  service.start()
  await waitFor(() => domain.runs.get(queued.id)?.status === 'failed')
  const failed = domain.runs.get(queued.id)!
  assert.equal(failed.error?.code, 'model_unavailable')
  assert.equal(failed.sessionId, null)
  assert.equal(failed.phase, null)
  await service.dispose()
})

test('the whole-job timeout covers model preflight before a Result Session exists', async () => {
  const definition = storedDefinition('2026-08-13T00:00:00Z')
  const queued = createManualRun(definition, '2026-08-13T00:05:00Z', 'whole-job-timeout')
  const shortDeadlineRun: AutomationRun = {
    ...queued,
    targetSnapshot: { ...queued.targetSnapshot, runTimeoutMinutes: 0.0001 },
  }
  const never = new Promise<void>(() => {})
  const { service, domain } = await harness({
    definitions: [definition], runs: [shortDeadlineRun], resolveModelGate: never,
    config: { maxConcurrentRuns: 1 },
  })
  try {
    service.start()
    await waitFor(() => domain.runs.get(queued.id)?.status === 'failed')
    const failed = domain.runs.get(queued.id)!
    assert.equal(failed.error?.code, 'run_timeout')
    assert.equal(failed.sessionId, null)
    assert.equal(failed.phase, null)
    assert.equal(failed.lease, null)
  } finally {
    await service.dispose()
  }
})

test('concurrent updates are serialized and a deletion cannot be resurrected', async () => {
  const { service } = await harness()
  const definition = await service.create(scope, {
    name: 'Health report',
    prompt: 'Inspect repository health.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
  })
  await Promise.all([
    service.update(scope, definition.id, { name: 'Repository health' }),
    service.update(scope, definition.id, { prompt: 'Inspect repository health and cite files.' }),
  ])
  const updated = (await service.snapshot(scope)).definitions[0]!
  assert.equal(updated.revision, 3)
  assert.equal(updated.name, 'Repository health')
  assert.match(updated.prompt, /cite files/)

  const deleting = service.delete(scope, definition.id)
  const staleUpdate = service.update(scope, definition.id, { name: 'Must not reappear' })
  await deleting
  await assert.rejects(() => staleUpdate, /unknown automation/)
  assert.equal((await service.snapshot(scope)).definitions.length, 0)
  await service.dispose()
})

test('one update that changes fields and status advances the definition revision once', async () => {
  const { service } = await harness()
  const definition = await service.create(scope, {
    name: 'Combined update',
    prompt: 'Inspect repository health.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
  })

  const paused = await service.update(scope, definition.id, {
    name: 'Paused health report',
    status: 'paused',
  })
  assert.equal(paused.revision, definition.revision + 1)
  assert.equal(paused.name, 'Paused health report')
  assert.equal(paused.status, 'paused')
  await service.dispose()
})

test('a stale Web edit cannot overwrite a newer automation revision', async () => {
  const { service } = await harness()
  const definition = await service.create(scope, {
    name: 'Editable report',
    prompt: 'Inspect repository health.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
  })
  await service.update(scope, definition.id, {
    expectedRevision: definition.revision,
    prompt: 'Inspect repository health and cite files.',
  })

  await assert.rejects(
    () => service.update(scope, definition.id, {
      expectedRevision: definition.revision,
      name: 'Stale browser draft',
    }),
    /changed since it was opened/,
  )
  const current = (await service.snapshot(scope)).definitions[0]!
  assert.equal(current.name, 'Editable report')
  assert.match(current.prompt, /cite files/)
  await service.dispose()
})

test('mark read is workspace-scoped and clears durable attention state', async () => {
  const definition = storedDefinition('2026-08-13T00:00:00Z')
  const failed: AutomationRun = {
    ...createManualRun(definition, '2026-08-13T00:05:00Z', 'unread-failure'),
    status: 'failed',
    finishedAt: '2026-08-13T00:06:00Z',
    error: { code: 'fixture', message: 'failed run' },
    unread: true,
  }
  // Deleted definitions deliberately leave their runs behind for audit. Those
  // retained failures must still be dismissible by a Session in the same
  // workspace, or the UI's attention count can never clear.
  const { service, domain } = await harness({ runs: [failed] })

  const updated = await service.markRead(scope, failed.id)
  assert.equal(updated.unread, false)
  assert.equal(domain.runs.get(failed.id)?.unread, false)

  await assert.rejects(
    () => service.markRead({ sessionId: 'unknown-session', creatorKind: 'agent' }, failed.id),
    /live source session/,
  )
  await assert.rejects(
    () => service.markRead(otherWorkspaceScope, failed.id),
    /another workspace/,
  )
  await service.dispose()
})

test('mark read is serialized ahead of disposal so it cannot write after domain close', async () => {
  const definition = storedDefinition('2026-08-13T00:00:00Z')
  const failed: AutomationRun = {
    ...createManualRun(definition, '2026-08-13T00:05:00Z', 'mark-read-dispose'),
    status: 'failed',
    finishedAt: '2026-08-13T00:06:00Z',
    error: { code: 'fixture', message: 'failed run' },
    unread: true,
  }
  let releaseWorkspace = () => {}
  const resolveWorkspaceGate = new Promise<void>(resolve => { releaseWorkspace = resolve })
  let reportResolveStarted = () => {}
  const resolveStarted = new Promise<void>(resolve => { reportResolveStarted = resolve })
  const { service, domain } = await harness({
    runs: [failed],
    resolveWorkspaceGate,
    onResolveWorkspace: reportResolveStarted,
  })

  const marking = service.markRead(scope, failed.id)
  await resolveStarted
  const disposing = service.dispose()
  await new Promise<void>(resolve => setImmediate(resolve))
  const closedBeforeMutationSettled = domain.closed
  releaseWorkspace()
  const [markResult, disposeResult] = await Promise.allSettled([marking, disposing])

  assert.equal(closedBeforeMutationSettled, false, 'dispose must drain an admitted mark-read mutation')
  assert.equal(markResult.status, 'fulfilled')
  assert.equal(disposeResult.status, 'fulfilled')
  assert.equal(domain.runs.get(failed.id)?.unread, false)
  assert.equal(domain.closed, true)
})

test('snapshot holds the domain read lease until workspace resolution completes', async () => {
  let releaseWorkspace = () => {}
  const resolveWorkspaceGate = new Promise<void>(resolve => { releaseWorkspace = resolve })
  let reportResolveStarted = () => {}
  const resolveStarted = new Promise<void>(resolve => { reportResolveStarted = resolve })
  const { service, domain } = await harness({
    resolveWorkspaceGate,
    onResolveWorkspace: reportResolveStarted,
  })

  const snapshotting = service.snapshot(scope)
  await resolveStarted
  const disposing = service.dispose()
  await new Promise<void>(resolve => setImmediate(resolve))
  const closedBeforeSnapshotSettled = domain.closed
  releaseWorkspace()
  const [snapshotResult, disposeResult] = await Promise.allSettled([snapshotting, disposing])

  assert.equal(closedBeforeSnapshotSettled, false, 'dispose must drain an admitted snapshot')
  assert.equal(snapshotResult.status, 'fulfilled')
  assert.equal(disposeResult.status, 'fulfilled')
  assert.equal(domain.closed, true)
})

test('a source Session disposed during workspace resolution cannot mutate durable state', async () => {
  const definition = storedDefinition('2026-08-13T00:00:00Z')
  let releaseWorkspace = () => {}
  const resolveWorkspaceGate = new Promise<void>(resolve => { releaseWorkspace = resolve })
  let reportResolveStarted = () => {}
  const resolveStarted = new Promise<void>(resolve => { reportResolveStarted = resolve })
  const { service, domain, removeSourceAgent } = await harness({
    definitions: [definition],
    resolveWorkspaceGate,
    onResolveWorkspace: reportResolveStarted,
  })

  const mutation = service.runNow(scope, definition.id)
  await resolveStarted
  removeSourceAgent()
  releaseWorkspace()

  await assert.rejects(mutation, /live source session/)
  assert.equal(domain.runs.size, 0)
  await service.dispose()
})

test('a mutation cancelled while waiting for the service queue never writes durable state', async () => {
  const definition = storedDefinition('2026-08-13T00:00:00Z')
  const failed: AutomationRun = {
    ...createManualRun(definition, '2026-08-13T00:05:00Z', 'queue-blocker'),
    status: 'failed',
    finishedAt: '2026-08-13T00:06:00Z',
    error: { code: 'fixture', message: 'failed run' },
    unread: true,
  }
  let releaseWorkspace = () => {}
  const resolveWorkspaceGate = new Promise<void>(resolve => { releaseWorkspace = resolve })
  let reportResolveStarted = () => {}
  const resolveStarted = new Promise<void>(resolve => { reportResolveStarted = resolve })
  const { service, domain } = await harness({
    definitions: [definition],
    runs: [failed],
    resolveWorkspaceGate,
    onResolveWorkspace: reportResolveStarted,
  })
  const blockingMutation = service.markRead(scope, failed.id)
  await resolveStarted

  const controller = new AbortController()
  const cancelledMutation = (service.runNow as unknown as (
    requestScope: typeof scope,
    automationId: string,
    signal: AbortSignal,
  ) => Promise<AutomationRun>)(scope, definition.id, controller.signal)
  controller.abort()
  releaseWorkspace()

  await blockingMutation
  await assert.rejects(cancelledMutation, /cancelled/)
  assert.deepEqual([...domain.runs.records.keys()], [failed.id])
  await service.dispose()
})

test('a snapshot cancelled while waiting for the service queue does not enter workspace resolution', async () => {
  const definition = storedDefinition('2026-08-13T00:00:00Z')
  const failed: AutomationRun = {
    ...createManualRun(definition, '2026-08-13T00:05:00Z', 'snapshot-queue-blocker'),
    status: 'failed',
    finishedAt: '2026-08-13T00:06:00Z',
    error: { code: 'fixture', message: 'failed run' },
    unread: true,
  }
  let releaseWorkspace = () => {}
  const resolveWorkspaceGate = new Promise<void>(resolve => { releaseWorkspace = resolve })
  let resolves = 0
  let reportFirstResolveStarted = () => {}
  const firstResolveStarted = new Promise<void>(resolve => { reportFirstResolveStarted = resolve })
  const { service } = await harness({
    runs: [failed],
    resolveWorkspaceGate,
    onResolveWorkspace: () => {
      resolves += 1
      if (resolves === 1) reportFirstResolveStarted()
    },
  })
  const blockingMutation = service.markRead(scope, failed.id)
  await firstResolveStarted

  const controller = new AbortController()
  const cancelledSnapshot = service.snapshot(scope, controller.signal)
  controller.abort()
  releaseWorkspace()

  await blockingMutation
  await assert.rejects(cancelledSnapshot, /cancelled/)
  assert.equal(resolves, 1)
  await service.dispose()
})

test('opening after a host stop preserves queued work that never crossed the side-effect boundary', async () => {
  const definition = storedDefinition('2026-08-13T00:00:00Z')
  const queued = createManualRun(definition, '2026-08-13T00:05:00Z', 'interrupted')
  const { service, domain } = await harness({ definitions: [definition], runs: [queued] })
  const recovered = domain.runs.get(queued.id)!
  assert.equal(recovered.status, 'queued')
  assert.equal(recovered.phase, 'claim')
  assert.equal(recovered.error, null)
  await service.dispose()
  assert.equal(domain.closed, true)
})

test('startup recovery retries a pre-side-effect run as a new bounded attempt', async () => {
  const definition = storedDefinition('2026-08-13T00:00:00Z')
  const interrupted: AutomationRun = {
    ...createManualRun(definition, '2026-08-13T00:05:00Z', 'safe-retry'),
    status: 'running',
    phase: 'setup',
    lease: {
      ownerId: 'dead-host', acquiredAt: '2026-08-13T00:05:10Z',
      heartbeatAt: '2026-08-13T00:05:20Z', expiresAt: '2026-08-13T00:05:50Z',
      sideEffectsPossible: false,
    },
    startedAt: '2026-08-13T00:05:10Z',
  }
  const { service, domain } = await harness({ definitions: [definition], runs: [interrupted] })
  try {
    const recovered = domain.runs.get(interrupted.id)!
    assert.equal(recovered.status, 'queued')
    assert.equal(recovered.attempt, 2)
    assert.equal(recovered.outcome, 'pending')
    assert.equal(recovered.attention, 'none')
    assert.equal(recovered.effect.status, 'none')
  } finally {
    await service.dispose()
  }
})

test('startup recovery archives a run that may have produced side effects and marks it interrupted', async () => {
  const definition = storedDefinition('2026-08-13T00:00:00Z')
  const interrupted: AutomationRun = {
    ...createManualRun(definition, '2026-08-13T00:05:00Z', 'interrupted-session'),
    status: 'running',
    phase: 'executing',
    lease: {
      ownerId: 'dead-host',
      acquiredAt: '2026-08-13T00:05:20Z',
      heartbeatAt: '2026-08-13T00:05:30Z',
      expiresAt: '2026-08-13T00:06:00Z',
      sideEffectsPossible: true,
    },
    sessionId: 'dsh-automation-session-interrupted',
    startedAt: '2026-08-13T00:05:30Z',
  }
  const { service, domain, archivedSessionIds } = await harness({
    definitions: [definition],
    runs: [interrupted],
    config: { archiveRunSessions: true },
  })
  try {
    assert.equal(domain.runs.get(interrupted.id)?.status, 'interrupted')
    assert.equal(domain.runs.get(interrupted.id)?.error?.code, 'host_interrupted')
    assert.equal(domain.runs.get(interrupted.id)?.outcome, 'interrupted')
    assert.equal(domain.runs.get(interrupted.id)?.attention, 'unknown')
    assert.equal(domain.runs.get(interrupted.id)?.effect.status, 'unknown')
    assert.deepEqual(archivedSessionIds, [interrupted.sessionId])
  } finally {
    await service.dispose()
  }
})

test('supervisor persists every execution phase and clears its lease at terminal completion', async () => {
  const { service, domain } = await harness({
    completeRuns: true,
    config: { maxConcurrentRuns: 1 },
  })
  try {
    const definition = await service.create(scope, {
      name: 'Phase audit',
      prompt: 'Return one bounded result.',
      schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    })
    const queued = await service.runNow(scope, definition.id)
    service.start()
    await waitFor(() => domain.runs.get(queued.id)?.status === 'succeeded')

    const writes = domain.runs.writes.filter(run => run.id === queued.id)
    assert.deepEqual(
      [...new Set(writes.map(run => run.phase).filter(Boolean))],
      ['claim', 'setup', 'executing', 'settling', 'delivery'],
    )
    assert.equal(writes.some(run => run.lease?.sideEffectsPossible === true), true)
    assert.equal(domain.runs.get(queued.id)?.phase, null)
    assert.equal(domain.runs.get(queued.id)?.lease, null)
    assert.equal(domain.runs.get(queued.id)?.outcome, 'unknown')
    assert.equal(domain.runs.get(queued.id)?.attention, 'unknown')
    assert.equal(domain.runs.get(queued.id)?.effect.status, 'completed')
  } finally {
    await service.dispose()
  }
})

test('configured run-session archival hides a completed Session without deleting its audit row', async () => {
  const { service, domain, archivedSessionIds } = await harness({
    completeRuns: true,
    config: { maxConcurrentRuns: 1, archiveRunSessions: true },
  })
  try {
    const definition = await service.create(scope, {
      name: 'Archived result',
      prompt: 'Return one bounded result.',
      schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    })
    const queued = await service.runNow(scope, definition.id)

    service.start()
    await waitFor(() => domain.runs.get(queued.id)?.status === 'succeeded')
    const completed = domain.runs.get(queued.id)!
    assert.equal(completed.summary, 'completed result')
    assert.match(completed.sessionId ?? '', /^dsh-automation-session-/)
    assert.deepEqual(archivedSessionIds, [completed.sessionId])
    assert.equal((await service.snapshot(scope)).runs[0]?.sessionArchived, true)
  } finally {
    await service.dispose()
  }
})

test('archive failure leaves the completed result successful and visible for retry after restart', async () => {
  const { service, domain, archivedSessionIds, warnings } = await harness({
    completeRuns: true,
    rejectArchive: true,
    config: { maxConcurrentRuns: 1, archiveRunSessions: true },
  })
  let definition: AutomationDefinition | undefined
  let completed: AutomationRun | undefined
  try {
    definition = await service.create(scope, {
      name: 'Archive retry',
      prompt: 'Return one bounded result.',
      schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    })
    const queued = await service.runNow(scope, definition.id)

    service.start()
    await waitFor(() => domain.runs.get(queued.id)?.status === 'succeeded')
    completed = domain.runs.get(queued.id)!
    assert.equal(completed.status, 'succeeded')
    assert.deepEqual(archivedSessionIds, [])
    assert.equal(warnings.some(message => message.includes('could not archive')), true)
    assert.equal((await service.snapshot(scope)).runs[0]?.sessionArchived, false)
  } finally {
    await service.dispose()
  }
  assert.ok(definition)
  assert.ok(completed)

  const retry = await harness({
    definitions: [definition],
    runs: [completed],
    config: { archiveRunSessions: true },
  })
  try {
    assert.deepEqual(retry.archivedSessionIds, [completed.sessionId])
    assert.equal(retry.domain.runs.get(completed.id)?.status, 'succeeded')
  } finally {
    await retry.service.dispose()
  }
})

test('archiveRunSessions false keeps completed Sessions in the ordinary list', async () => {
  const { service, domain, archivedSessionIds } = await harness({
    completeRuns: true,
    config: { maxConcurrentRuns: 1, archiveRunSessions: false },
  })
  try {
    const definition = await service.create(scope, {
      name: 'Visible result',
      prompt: 'Return one bounded result.',
      schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    })
    const queued = await service.runNow(scope, definition.id)

    service.start()
    await waitFor(() => domain.runs.get(queued.id)?.status === 'succeeded')
    assert.deepEqual(archivedSessionIds, [])
    assert.equal((await service.snapshot(scope)).runs[0]?.sessionArchived, false)
  } finally {
    await service.dispose()
  }
})

test('durable retention is bounded per automation and keeps automation session identity', async () => {
  const definition = storedDefinition('2026-08-13T00:00:00Z')
  const otherDefinition = createDefinition({
    ...definition,
    id: 'automation-other',
    name: 'Other automation',
    now: '2026-08-13T00:00:00Z',
  })
  const oldRun: AutomationRun = {
    ...createManualRun(definition, '2026-08-13T00:01:00Z', 'old'),
    status: 'succeeded',
    finishedAt: '2026-08-13T00:02:00Z',
  }
  const newRun: AutomationRun = {
    ...createManualRun(definition, '2026-08-13T00:03:00Z', 'new'),
    status: 'failed',
    finishedAt: '2026-08-13T00:04:00Z',
    error: { code: 'fixture', message: 'newer terminal result' },
  }
  const activeRun = createManualRun(definition, '2026-08-13T00:05:00Z', 'active')
  const otherRun: AutomationRun = {
    ...createManualRun(otherDefinition, '2026-08-13T00:00:30Z', 'other'),
    status: 'succeeded',
    sessionId: 'session-other-automation',
    finishedAt: '2026-08-13T00:00:45Z',
  }
  const { service, domain } = await harness({
    definitions: [definition, otherDefinition],
    runs: [oldRun, newRun, activeRun, otherRun],
    config: { historyLimit: 1 },
  })
  assert.equal(domain.runs.get(oldRun.id), undefined)
  // Work that never crossed the side-effect boundary remains queued and does
  // not consume the bounded terminal-history allowance.
  assert.equal(domain.runs.get(activeRun.id)?.status, 'queued')
  assert.equal(domain.runs.get(newRun.id)?.status, 'failed')
  assert.equal(domain.runs.get(otherRun.id)?.status, 'succeeded')
  assert.equal(service.ownsSession(otherRun.sessionId!), true)
  assert.equal(service.ownsSession('dsh-automation-session-pruned-before-prompt'), true)
  assert.equal(service.ownsSession('session-pruned', [{
    type: 'user/message',
    data: { source: { kind: 'automation', automationId: definition.id } },
  }]), true)
  assert.equal(service.ownsSession('session-human', [{
    type: 'user/message',
    data: { source: { kind: 'user' } },
  }]), false)
  await service.dispose()
})

test('a queued run whose definition is deleted still enforces terminal retention', async () => {
  const { service, domain } = await harness({
    config: { maxConcurrentRuns: 1, historyLimit: 1 },
  })
  const definition = await service.create(scope, {
    name: 'Deletion race',
    prompt: 'Inspect one bounded condition.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
  })
  const oldRun: AutomationRun = {
    ...createManualRun(definition, '2026-08-13T00:01:00Z', 'old-retained'),
    status: 'succeeded',
    finishedAt: '2026-08-13T00:02:00Z',
  }
  await domain.runs.put(oldRun.id, oldRun)
  const queued = await service.runNow(scope, definition.id)
  await service.delete(scope, definition.id)

  service.start()
  await waitFor(() => domain.runs.get(queued.id)?.status === 'failed')
  const related = [...domain.runs.records.values()]
    .filter(run => run.automationId === definition.id)
  assert.equal(domain.runs.get(queued.id)?.error?.code, 'definition_deleted')
  assert.deepEqual(related.map(run => run.id), [queued.id])
  await service.dispose()
})

test('the clock dispatches a due one-time occurrence exactly once without run-now', async (context) => {
  const now = Date.parse('2026-08-13T00:00:00Z')
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now })
  const { service, domain } = await harness({ config: { maxConcurrentRuns: 1 } })
  const at = new Date(now + 60_000).toISOString()
  const definition = await service.create(scope, {
    name: 'Actual clock occurrence',
    prompt: 'Inspect one bounded condition.',
    schedule: { kind: 'once', at, timeZone: 'UTC' },
  })

  service.start()
  await flushMicrotasks()
  context.mock.timers.tick(59_999)
  await flushMicrotasks()
  assert.equal(domain.runs.size, 0)

  context.mock.timers.tick(1)
  await flushMicrotasks()
  const runs = [...domain.runs.records.values()]
  assert.equal(runs.length, 1)
  assert.equal(runs[0]?.automationId, definition.id)
  assert.equal(runs[0]?.trigger, 'schedule')
  assert.equal(runs[0]?.scheduledFor, at)
  assert.equal(runs[0]?.status, 'failed')
  assert.equal(runs[0]?.error?.code, 'executor_error')

  context.mock.timers.tick(60_000)
  await flushMicrotasks()
  assert.equal(domain.runs.size, 1)
  await service.dispose()
})

test('pause blocks a due interval and resume waits for the next future occurrence', async (context) => {
  const now = Date.parse('2026-08-13T00:00:00Z')
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now })
  const { service, domain } = await harness({ config: { maxConcurrentRuns: 1 } })
  const definition = await service.create(scope, {
    name: 'Pause and resume',
    prompt: 'Inspect one bounded condition.',
    schedule: { kind: 'interval', everyMinutes: 5, anchor: new Date(now).toISOString(), timeZone: 'UTC' },
  })
  await service.update(scope, definition.id, { status: 'paused' })
  service.start()
  await flushMicrotasks()

  context.mock.timers.tick(5 * 60_000)
  await flushMicrotasks()
  assert.equal(domain.runs.size, 0, 'a paused definition must not claim the due occurrence')

  await service.update(scope, definition.id, { status: 'active' })
  await flushMicrotasks()
  assert.equal(domain.runs.size, 0, 'resume must not replay the occurrence at the activation boundary')

  context.mock.timers.tick(5 * 60_000)
  await flushMicrotasks()
  const runs = [...domain.runs.records.values()]
  assert.equal(runs.length, 1)
  assert.equal(runs[0]?.trigger, 'schedule')
  assert.equal(runs[0]?.scheduledFor, new Date(now + 10 * 60_000).toISOString())
  await service.dispose()
})

test('scheduler materializes only the latest due interval and records overlap', async () => {
  const anchorMs = Date.now() - 6 * 60_000
  const anchor = new Date(anchorMs).toISOString()
  const definition = createDefinition({
    id: 'automation-interval',
    name: 'Interval check',
    prompt: 'Inspect one bounded condition.',
    schedule: { kind: 'interval', everyMinutes: 5, anchor, timeZone: 'UTC' },
    workspaceId: 'workspace-1',
    cwd: '/workspace/repo',
    agentPreset: 'standard',
    createdBy: { kind: 'web', sessionId: scope.sessionId },
    now: new Date(anchorMs - 60_000).toISOString(),
  })
  const { service, domain } = await harness({ definitions: [definition] })
  try {
    const manual = await service.runNow(scope, definition.id)
    service.start()
    await waitFor(() => domain.runs.records.size === 2)
    const scheduled = [...domain.runs.records.values()].find(run => run.trigger === 'schedule')!
    assert.equal(manual.status, 'queued')
    assert.equal(scheduled.status, 'skipped')
    assert.equal(scheduled.error?.code, 'overlap')
    assert.equal(Date.parse(scheduled.scheduledFor), Date.parse(anchor) + 5 * 60_000)
  } finally {
    await service.dispose()
  }
})

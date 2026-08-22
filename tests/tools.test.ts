import assert from 'node:assert/strict'
import test from 'node:test'
import { registerAutomationTools } from '../src/tools.ts'

interface ToolDefinition {
  readonly name: string
  execute(args: unknown, context: {
    readonly agent?: unknown
    readonly signal: AbortSignal
    readonly callId?: string
  }): Promise<unknown>
}

test('Agent management tools require the exact registered Agent identity, not a recycled id', async () => {
  const registered = new Map<string, ToolDefinition>()
  let createCalls = 0
  const service = {
    dispatch: async (_scope: unknown, command: { readonly requestId: string }) => {
      createCalls += 1
      return {
        requestId: command.requestId, command: 'create', outcome: 'committed', entityId: 'automation-created',
        revision: 1, appliedAt: '2026-08-23T00:00:00.000Z', replayed: false,
      }
    },
    snapshot: async () => ({ definitions: [], runs: [] }),
  }
  const agent = {
    id: 'agent-reused-id',
    ctx: {
      tools: {
        register: (definition: unknown) => {
          const tool = definition as ToolDefinition
          registered.set(tool.name, tool)
          return () => { registered.delete(tool.name) }
        },
      },
    },
  }
  const dispose = registerAutomationTools(service as never, agent)
  const tool = registered.get('automation_create')!
  const signal = new AbortController().signal
  const args = {
    name: 'Scoped automation',
    prompt: 'Inspect one bounded condition.',
    kind: 'daily',
    time_zone: 'UTC',
    time: '09:00',
  }

  const staleResult = await tool.execute(args, { agent: { id: agent.id }, signal })
  assert.deepEqual(staleResult, { ok: false, code: 'cancelled' })
  assert.equal(createCalls, 0)

  const ownerResult = await tool.execute(args, { agent, signal })
  assert.equal((ownerResult as { ok: boolean }).ok, true)
  assert.equal((ownerResult as { receipt?: { entityId?: string } }).receipt?.entityId, 'automation-created')
  assert.equal(createCalls, 1)
  dispose()
  assert.equal(registered.size, 0)
})

test('a cancelled Agent mutation receives the execution signal and reports cancellation', async () => {
  const registered = new Map<string, ToolDefinition>()
  let receivedSignal: AbortSignal | undefined
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  const service = {
    dispatch: async (_scope: unknown, _request: unknown, signal?: AbortSignal) => {
      receivedSignal = signal
      await gate
      throw new Error('The automation request was cancelled.')
    },
  }
  const agent = {
    id: 'agent-owner',
    ctx: {
      tools: {
        register: (definition: unknown) => {
          const tool = definition as ToolDefinition
          registered.set(tool.name, tool)
          return () => { registered.delete(tool.name) }
        },
      },
    },
  }
  const dispose = registerAutomationTools(service as never, agent)
  const controller = new AbortController()
  const execution = registered.get('automation_create')!.execute({
    name: 'Cancelled automation',
    prompt: 'Inspect one bounded condition.',
    kind: 'daily',
    time_zone: 'UTC',
    time: '09:00',
  }, { agent, signal: controller.signal })
  await Promise.resolve()
  controller.abort()
  release()

  assert.deepEqual(await execution, { ok: false, code: 'cancelled' })
  assert.equal(receivedSignal, controller.signal)
  dispose()
})

test('Agent tools reject ambiguous cadence fields instead of silently discarding them', async () => {
  const registered = new Map<string, ToolDefinition>()
  let createCalls = 0
  let updateCalls = 0
  const service = {
    dispatch: async (_scope: unknown, command: { readonly kind: string; readonly requestId: string }) => {
      if (command.kind === 'create') createCalls += 1
      if (command.kind === 'update') updateCalls += 1
      return {
        requestId: command.requestId, command: command.kind, outcome: 'committed',
        appliedAt: '2026-08-23T00:00:00.000Z', replayed: false,
      }
    },
  }
  const agent = {
    id: 'agent-owner',
    ctx: {
      tools: {
        register: (definition: unknown) => {
          const tool = definition as ToolDefinition
          registered.set(tool.name, tool)
          return () => { registered.delete(tool.name) }
        },
      },
    },
  }
  const dispose = registerAutomationTools(service as never, agent)
  const signal = new AbortController().signal

  const createResult = await registered.get('automation_create')!.execute({
    name: 'Ambiguous cadence',
    prompt: 'Inspect one bounded condition.',
    kind: 'daily',
    time_zone: 'UTC',
    time: '09:00',
    every_minutes: 5,
  }, { agent, signal }) as { readonly ok: boolean; readonly message?: string }
  assert.equal(createResult.ok, false)
  assert.match(createResult.message ?? '', /daily schedule does not accept every_minutes/)
  assert.equal(createCalls, 0)

  const updateResult = await registered.get('automation_update')!.execute({
    id: 'automation-1',
    name: 'New name',
    time_zone: 'UTC',
  }, { agent, signal }) as { readonly ok: boolean; readonly message?: string }
  assert.equal(updateResult.ok, false)
  assert.match(updateResult.message ?? '', /kind is required/)
  assert.equal(updateCalls, 0)
  dispose()
})

test('Agent create tools expose explicit model policy and dispatch one durable command', async () => {
  const registered = new Map<string, ToolDefinition>()
  const calls: Array<{ readonly scope: unknown; readonly command: any; readonly signal: AbortSignal | undefined }> = []
  const service = {
    dispatch: async (scope: unknown, command: unknown, signal?: AbortSignal) => {
      calls.push({ scope, command, signal })
      return {
        requestId: (command as { requestId: string }).requestId,
        command: 'create', outcome: 'committed', entityId: 'automation-model', revision: 1,
        appliedAt: '2026-08-23T00:00:00.000Z', replayed: false,
      }
    },
  }
  const agent = {
    id: 'agent-owner',
    ctx: { tools: { register: (definition: unknown) => {
      const tool = definition as ToolDefinition
      registered.set(tool.name, tool)
      return () => { registered.delete(tool.name) }
    } } },
  }
  const dispose = registerAutomationTools(service as never, agent)
  const signal = new AbortController().signal
  const result = await registered.get('automation_create')!.execute({
    name: 'Pinned reasoning task',
    prompt: 'Inspect one bounded condition.',
    kind: 'daily', time_zone: 'UTC', time: '09:00',
    model_mode: 'pinned', provider: 'deepseek', model: 'deepseek-reasoner', reasoning_effort: 'high',
  }, { agent, signal, callId: 'model-policy-call' }) as { readonly ok: boolean; readonly receipt?: { readonly outcome: string } }

  assert.equal(result.ok, true)
  assert.equal(result.receipt?.outcome, 'committed')
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0]?.scope, { sessionId: 'agent-owner', creatorKind: 'agent' })
  assert.equal(calls[0]?.command.requestId, 'agent-create-model-policy-call')
  assert.deepEqual(calls[0]?.command.input.modelPolicy, {
    mode: 'pinned', provider: 'deepseek', model: 'deepseek-reasoner', reasoningEffort: 'high',
  })
  assert.equal(calls[0]?.signal, signal)
  dispose()
})

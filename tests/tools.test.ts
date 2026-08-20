import assert from 'node:assert/strict'
import test from 'node:test'
import { registerAutomationTools } from '../src/tools.ts'

interface ToolDefinition {
  readonly name: string
  execute(args: unknown, context: { readonly agent?: unknown; readonly signal: AbortSignal }): Promise<unknown>
}

test('Agent management tools require the exact registered Agent identity, not a recycled id', async () => {
  const registered = new Map<string, ToolDefinition>()
  let createCalls = 0
  const service = {
    create: async () => {
      createCalls += 1
      return { id: 'automation-created' }
    },
    snapshot: async () => ({ definitions: [], runs: [] }),
    update: async () => ({}),
    runNow: async () => ({}),
    delete: async () => ({}),
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
  assert.deepEqual(ownerResult, { ok: true, automation: { id: 'automation-created' } })
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
    create: async (_scope: unknown, _request: unknown, signal?: AbortSignal) => {
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
    create: async () => { createCalls += 1; return {} },
    update: async () => { updateCalls += 1; return {} },
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

/** Agent-scoped management tools over the host-wide AutomationService. */

import { defineTool, type JsonValue, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { AutomationService } from './service.ts'
import type { AutomationSchedule, PermissionPreset, Weekday } from './types.ts'

interface ToolAgent {
  readonly id: string
  readonly ctx: {
    readonly tools: { register(definition: unknown): () => void }
  }
}

const WEEKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

interface ScheduleArgs {
  readonly kind?: 'once' | 'interval' | 'daily' | 'weekly'
  readonly time_zone?: string
  readonly at?: string
  readonly every_minutes?: number
  readonly time?: string
  readonly weekdays?: string[]
}

interface CreateArgs extends ScheduleArgs {
  readonly name: string
  readonly prompt: string
  readonly kind: 'once' | 'interval' | 'daily' | 'weekly'
  readonly time_zone: string
  readonly permission?: PermissionPreset
}

interface UpdateArgs extends ScheduleArgs {
  readonly id: string
  readonly name?: string
  readonly prompt?: string
  readonly status?: 'active' | 'paused'
  readonly permission?: PermissionPreset
}

interface IdArgs { readonly id: string }

const SCHEDULE_FIELDS = ['time_zone', 'at', 'every_minutes', 'time', 'weekdays'] as const

function render(_args: unknown, value: JsonValue): { type: 'text'; text: string }[] {
  return [{ type: 'text', text: JSON.stringify(value) }]
}

const JSON_OUTPUT = {
  schema: { type: 'json' },
  render,
} as const

function json(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function present(title: string, kind: 'read' | 'other', rawInput?: unknown) {
  return { card: 'generic' as const, title, kind, ...(rawInput === undefined ? {} : { rawInput }) }
}

function validateScheduleSelector(args: ScheduleArgs): void {
  const presentFields = SCHEDULE_FIELDS.filter(field => args[field] !== undefined)
  if (args.kind === undefined) {
    if (presentFields.length > 0) throw new Error('kind is required when changing schedule fields')
    return
  }
  const required = args.kind === 'once'
    ? ['time_zone', 'at'] as const
    : args.kind === 'interval'
      ? ['time_zone', 'every_minutes'] as const
      : args.kind === 'daily'
        ? ['time_zone', 'time'] as const
        : ['time_zone', 'time', 'weekdays'] as const
  const allowed = new Set<string>(required)
  const missing = required.filter(field => args[field] === undefined)
  if (missing.length > 0) throw new Error(`${args.kind} schedule requires ${missing.join(', ')}`)
  const unrelated = presentFields.filter(field => !allowed.has(field))
  if (unrelated.length > 0) throw new Error(`${args.kind} schedule does not accept ${unrelated.join(', ')}`)
}

function scheduleFromArgs(args: ScheduleArgs, now: string): AutomationSchedule {
  validateScheduleSelector(args)
  const timeZone = String(args.time_zone ?? '')
  switch (args.kind) {
    case 'once':
      return { kind: 'once', at: String(args.at ?? ''), timeZone }
    case 'interval':
      return { kind: 'interval', everyMinutes: Number(args.every_minutes), anchor: now, timeZone }
    case 'daily':
      return { kind: 'daily', time: String(args.time ?? ''), timeZone }
    case 'weekly': {
      const weekdays = Array.isArray(args.weekdays) ? args.weekdays.map(String) : []
      if (weekdays.some(day => !WEEKDAYS.includes(day as Weekday))) throw new Error('weekdays contains an invalid day')
      return { kind: 'weekly', weekdays: weekdays as Weekday[], time: String(args.time ?? ''), timeZone }
    }
    default:
      throw new Error('kind must be once, interval, daily, or weekly')
  }
}

/** Install tools once into one exact root Agent scope. */
export function registerAutomationTools(service: AutomationService, agent: ToolAgent): () => void {
  const scope = { sessionId: agent.id, creatorKind: 'agent' as const }
  const disposers: Array<() => void> = []
  const register = (definition: unknown): void => { disposers.push(agent.ctx.tools.register(definition)) }
  try {
    register(defineTool({
      name: 'automation_create',
      description: 'Create a durable standalone automation for this exact workspace. Each trigger starts a fresh DSH session and does not inherit this conversation. Use an explicit IANA time zone. Minimum interval is five minutes. Default to read-only unless writing files is necessary.',
      parameters: {
        name: { type: 'string', required: true },
        prompt: { type: 'string', required: true, description: 'Self-contained task prompt for every fresh run.' },
        kind: { type: 'string', required: true, enum: ['once', 'interval', 'daily', 'weekly'] },
        time_zone: { type: 'string', required: true, description: 'IANA zone such as Asia/Shanghai.' },
        at: { type: 'string', description: 'Offset ISO instant for a once schedule.' },
        every_minutes: { type: 'integer', description: 'Interval in minutes, at least five.' },
        time: { type: 'string', description: 'Local HH:mm for daily or weekly.' },
        weekdays: { type: 'array', items: { type: 'string', enum: WEEKDAYS } },
        permission: { type: 'string', enum: ['read-only', 'workspace-write'] },
      },
      output: JSON_OUTPUT,
      async execute(args: CreateArgs, exec: ToolRunContext) {
        if (exec.agent !== agent || exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
        try {
          const now = new Date().toISOString()
          const value = await service.create(scope, {
            name: args.name,
            prompt: args.prompt,
            schedule: scheduleFromArgs(args, now),
            permissionPreset: args.permission ?? 'read-only',
          }, exec.signal)
          return json({ ok: true, automation: value })
        } catch (error: unknown) {
          if (exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
          return json({ ok: false, code: 'invalid_automation', message: error instanceof Error ? error.message : String(error) })
        }
      },
      presentCall: (args: CreateArgs) => present('Create automation', 'other', args.name),
    }))

    register(defineTool({
      name: 'automation_list',
      description: 'List durable standalone automations and recent run history for this exact workspace.',
      parameters: {},
      output: JSON_OUTPUT,
      async execute(_args: Record<string, never>, exec: ToolRunContext) {
        if (exec.agent !== agent || exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
        try {
          return json({ ok: true, value: await service.snapshot(scope, exec.signal) })
        } catch (error: unknown) {
          if (exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
          return json({ ok: false, code: 'automation_error', message: error instanceof Error ? error.message : String(error) })
        }
      },
      presentCall: () => present('List automations', 'read'),
    }))

    register(defineTool({
      name: 'automation_update',
      description: 'Update an existing automation in this workspace instead of creating a duplicate. Omitted fields stay unchanged. A replacement schedule requires kind and its matching fields. Resuming starts from future occurrences and does not replay an old backlog.',
      parameters: {
        id: { type: 'string', required: true },
        name: { type: 'string' },
        prompt: { type: 'string' },
        status: { type: 'string', enum: ['active', 'paused'] },
        kind: { type: 'string', enum: ['once', 'interval', 'daily', 'weekly'] },
        time_zone: { type: 'string' },
        at: { type: 'string' },
        every_minutes: { type: 'integer' },
        time: { type: 'string' },
        weekdays: { type: 'array', items: { type: 'string', enum: WEEKDAYS } },
        permission: { type: 'string', enum: ['read-only', 'workspace-write'] },
      },
      output: JSON_OUTPUT,
      async execute(args: UpdateArgs, exec: ToolRunContext) {
        if (exec.agent !== agent || exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
        try {
          validateScheduleSelector(args)
          const input: {
            name?: string
            prompt?: string
            status?: 'active' | 'paused'
            schedule?: AutomationSchedule
            permissionPreset?: PermissionPreset
          } = {}
          if (args.name !== undefined) input.name = String(args.name)
          if (args.prompt !== undefined) input.prompt = String(args.prompt)
          if (args.status !== undefined) input.status = args.status as 'active' | 'paused'
          if (args.permission !== undefined) input.permissionPreset = args.permission as PermissionPreset
          if (args.kind !== undefined) input.schedule = scheduleFromArgs(args, new Date().toISOString())
          if (Object.keys(input).length === 0) throw new Error('automation_update requires at least one changed field')
          const value = await service.update(scope, args.id, input, exec.signal)
          return json({ ok: true, automation: value })
        } catch (error: unknown) {
          if (exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
          return json({ ok: false, code: 'automation_error', message: error instanceof Error ? error.message : String(error) })
        }
      },
      presentCall: (args: UpdateArgs) => present('Update automation', 'other', args.id),
    }))

    register(defineTool({
      name: 'automation_runs',
      description: 'Read the bounded durable run history for automations in this exact workspace, including failures, skips, summaries, and result session IDs.',
      parameters: {},
      output: JSON_OUTPUT,
      async execute(_args: Record<string, never>, exec: ToolRunContext) {
        if (exec.agent !== agent || exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
        try {
          const snapshot = await service.snapshot(scope, exec.signal)
          return json({ ok: true, generatedAt: snapshot.generatedAt, runs: snapshot.runs })
        } catch (error: unknown) {
          if (exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
          return json({ ok: false, code: 'automation_error', message: error instanceof Error ? error.message : String(error) })
        }
      },
      presentCall: () => present('Read automation runs', 'read'),
    }))

    register(defineTool({
      name: 'automation_run_now',
      description: 'Queue one manual run of an existing standalone automation. The run still uses a fresh session and the automation permission boundary.',
      parameters: { id: { type: 'string', required: true } },
      output: JSON_OUTPUT,
      async execute(args: IdArgs, exec: ToolRunContext) {
        if (exec.agent !== agent || exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
        try {
          return json({ ok: true, run: await service.runNow(scope, args.id, exec.signal) })
        } catch (error: unknown) {
          if (exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
          return json({ ok: false, code: 'automation_error', message: error instanceof Error ? error.message : String(error) })
        }
      },
      presentCall: (args: IdArgs) => present('Run automation now', 'other', args.id),
    }))

    register(defineTool({
      name: 'automation_delete',
      description: 'Delete an automation definition from this workspace while retaining its run history for audit.',
      parameters: { id: { type: 'string', required: true } },
      output: JSON_OUTPUT,
      async execute(args: IdArgs, exec: ToolRunContext) {
        if (exec.agent !== agent || exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
        try {
          return json({ ok: true, value: await service.delete(scope, args.id, exec.signal) })
        } catch (error: unknown) {
          if (exec.signal.aborted) return json({ ok: false, code: 'cancelled' })
          return json({ ok: false, code: 'automation_error', message: error instanceof Error ? error.message : String(error) })
        }
      },
      presentCall: (args: IdArgs) => present('Delete automation', 'other', args.id),
    }))
  } catch (error) {
    for (const dispose of disposers.reverse()) dispose()
    throw error
  }
  return () => { for (const dispose of disposers.reverse()) dispose() }
}

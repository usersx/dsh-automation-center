import { createHash, randomUUID } from 'node:crypto'
import { z } from 'zod'
import { normalizeSchedule, scheduleToRRule } from './recurrence.ts'
import type {
  AutomationDefinition, AutomationRun, AutomationSchedule, CreateAutomationInput,
  DeleteAutomationPlan, ModelPolicy, UpdateAutomationInput,
  StoredAutomationCommandReceipt,
} from './types.ts'

const nonBlank = z.string().trim().min(1)
const instant = z.string().datetime({ offset: true })
const timeZone = nonBlank
const weekday = z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])
export const automationScheduleSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('once'), at: instant, timeZone }),
  z.object({ kind: z.literal('interval'), everyMinutes: z.number().int().min(5), anchor: instant, timeZone }),
  z.object({ kind: z.literal('daily'), time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), timeZone }),
  z.object({
    kind: z.literal('weekly'),
    weekdays: z.array(weekday).min(1),
    time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    timeZone,
  }),
])

const permissionPreset = z.enum(['read-only', 'workspace-write'])
const modelPolicy = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('inherit') }),
  z.object({
    mode: z.literal('pinned'),
    provider: nonBlank,
    model: nonBlank,
    reasoningEffort: nonBlank.optional(),
  }),
])
const creator = z.object({ kind: z.enum(['agent', 'web']), sessionId: nonBlank })
const targetSnapshotShape = z.object({
  workspaceId: nonBlank,
  cwd: nonBlank,
  agentPreset: nonBlank,
  modelPolicy,
  provider: z.string().nullable(),
  model: z.string().nullable(),
  permissionPreset,
  reviewMode: z.enum(['direct', 'worktree']),
  runTimeoutMinutes: z.number().int().min(1).max(1_440),
}).superRefine((value, ctx) => {
  if (value.reviewMode === 'worktree' && value.permissionPreset !== 'workspace-write') {
    ctx.addIssue({ code: 'custom', message: 'worktree review requires workspace-write permission', path: ['reviewMode'] })
  }
})

function legacyPolicy(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  const resolvedPolicy: ModelPolicy = record.modelPolicy !== undefined
    ? record.modelPolicy as ModelPolicy
    : typeof record.provider === 'string' && typeof record.model === 'string'
      ? { mode: 'pinned', provider: record.provider, model: record.model }
      : { mode: 'inherit' }
  return { ...record, modelPolicy: resolvedPolicy, reviewMode: record.reviewMode ?? 'direct' }
}

const targetSnapshot = z.preprocess(legacyPolicy, targetSnapshotShape)

const automationDefinitionShape = z.object({
  version: z.literal(1),
  id: nonBlank,
  revision: z.number().int().positive(),
  name: nonBlank,
  prompt: nonBlank,
  status: z.enum(['active', 'paused']),
  schedule: automationScheduleSchema,
  rrule: nonBlank,
  timeZone,
  workspaceId: nonBlank,
  cwd: nonBlank,
  agentPreset: nonBlank,
  modelPolicy,
  provider: z.string().nullable(),
  model: z.string().nullable(),
  permissionPreset,
  reviewMode: z.enum(['direct', 'worktree']),
  runTimeoutMinutes: z.number().int().min(1).max(1_440),
  createdBy: creator,
  createdAt: instant,
  updatedAt: instant,
}).superRefine((value, ctx) => {
  try {
    if (value.timeZone !== value.schedule.timeZone) {
      ctx.addIssue({ code: 'custom', message: 'timeZone must match schedule.timeZone', path: ['timeZone'] })
    }
    if (value.rrule !== scheduleToRRule(value.schedule)) {
      ctx.addIssue({ code: 'custom', message: 'rrule must be derived from schedule', path: ['rrule'] })
    }
    const expectedProvider = value.modelPolicy.mode === 'pinned' ? value.modelPolicy.provider : null
    const expectedModel = value.modelPolicy.mode === 'pinned' ? value.modelPolicy.model : null
    if (value.provider !== expectedProvider || value.model !== expectedModel) {
      ctx.addIssue({ code: 'custom', message: 'provider/model must match modelPolicy', path: ['modelPolicy'] })
    }
    if (value.reviewMode === 'worktree' && value.permissionPreset !== 'workspace-write') {
      ctx.addIssue({ code: 'custom', message: 'worktree review requires workspace-write permission', path: ['reviewMode'] })
    }
  } catch (error) {
    ctx.addIssue({ code: 'custom', message: String(error), path: ['schedule'] })
  }
})

export const automationDefinitionSchema: z.ZodType<AutomationDefinition> = z.preprocess(
  legacyPolicy,
  automationDefinitionShape,
) as z.ZodType<AutomationDefinition>

const runPhase = z.enum(['claim', 'setup', 'executing', 'settling', 'delivery'])
const runOutcome = z.enum([
  'pending', 'unknown', 'no_change', 'changes_ready', 'needs_input', 'succeeded',
  'failed', 'blocked', 'cancelled', 'interrupted', 'skipped', 'partial',
])
const runAttention = z.enum(['none', 'review', 'needs_input', 'failed', 'blocked', 'unknown'])
const automationRunShape = z.object({
  version: z.literal(1),
  id: nonBlank,
  automationId: nonBlank,
  definitionRevision: z.number().int().positive(),
  occurrenceKey: nonBlank,
  trigger: z.enum(['schedule', 'manual']),
  scheduledFor: instant,
  admittedAt: instant,
  attempt: z.number().int().positive(),
  sequence: z.number().int().nonnegative(),
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'skipped', 'cancelled', 'interrupted']),
  phase: runPhase.nullable(),
  lease: z.object({
    ownerId: nonBlank,
    acquiredAt: instant,
    heartbeatAt: instant,
    expiresAt: instant,
    sideEffectsPossible: z.boolean(),
  }).nullable(),
  promptSnapshot: nonBlank,
  targetSnapshot,
  sessionId: z.string().nullable(),
  startedAt: instant.nullable(),
  finishedAt: instant.nullable(),
  summary: z.string().nullable(),
  error: z.object({ code: nonBlank, message: nonBlank }).nullable(),
  outcome: runOutcome,
  attention: runAttention,
  effect: z.object({
    status: z.enum(['none', 'possible', 'completed', 'unknown']),
    updatedAt: instant,
    externalId: nonBlank.optional(),
  }),
  unread: z.boolean(),
  effectiveModel: z.object({
    provider: nonBlank,
    model: nonBlank,
    reasoningEffort: nonBlank.optional(),
  }).nullable(),
  effectiveContext: z.object({
    actor: z.object({
      kind: z.literal('automation'),
      sourceKind: z.enum(['agent', 'web']),
      sourceId: nonBlank,
    }),
    permissionPreset,
    agentPreset: nonBlank,
    tools: z.array(nonBlank),
    approvalPolicy: z.literal('never'),
    backgroundProcesses: z.literal(false),
    capturedAt: instant,
  }).nullable(),
  review: z.object({
    mode: z.literal('worktree'),
    status: z.enum(['ready', 'kept', 'accepted', 'discarded', 'failed']),
    baseSha: nonBlank,
    worktreePath: nonBlank,
    patchSha256: nonBlank.nullable(),
    diffStat: z.string().nullable(),
    error: z.object({ code: nonBlank, message: nonBlank }).optional(),
    cleanup: z.object({
      status: z.enum(['owned', 'settling', 'released', 'unknown']),
      action: z.enum(['accept', 'discard']).nullable(),
      updatedAt: instant,
    }),
  }).nullable(),
})

export const automationRunSchema: z.ZodType<AutomationRun> = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return raw
  const record = raw as Record<string, unknown>
  const status = record.status
  const outcome = record.outcome ?? (
    status === 'queued' || status === 'running' ? 'pending'
      : status === 'succeeded' ? 'succeeded'
        : status === 'failed' ? 'failed'
          : status === 'cancelled' ? 'cancelled'
            : status === 'interrupted' ? 'interrupted'
              : status === 'skipped' ? 'skipped'
                : 'unknown'
  )
  const rawReview = typeof record.review === 'object' && record.review !== null
    ? record.review as Record<string, unknown>
    : undefined
  const review = rawReview === undefined ? record.review : {
    ...rawReview,
    cleanup: rawReview.cleanup ?? {
      status: rawReview.status === 'accepted' || rawReview.status === 'discarded'
        ? 'released'
        : rawReview.status === 'failed' ? 'unknown' : 'owned',
      action: null,
      updatedAt: record.finishedAt ?? record.startedAt ?? record.admittedAt ?? record.scheduledFor,
    },
  }
  return {
    ...record,
    admittedAt: record.admittedAt ?? record.scheduledFor,
    attempt: record.attempt ?? 1,
    sequence: record.sequence ?? 0,
    phase: record.phase ?? (status === 'queued' ? 'claim' : status === 'running' ? 'executing' : null),
    lease: record.lease ?? null,
    effectiveModel: record.effectiveModel ?? null,
    effectiveContext: record.effectiveContext ?? null,
    review: review ?? null,
    outcome,
    attention: record.attention ?? (
      outcome === 'failed' || outcome === 'interrupted' ? 'failed'
        : outcome === 'blocked' ? 'blocked'
          : outcome === 'needs_input' ? 'needs_input'
            : outcome === 'unknown' || outcome === 'partial' ? 'unknown'
              : 'none'
    ),
    effect: record.effect ?? {
      status: (record.lease as { sideEffectsPossible?: unknown } | null | undefined)?.sideEffectsPossible === true
        ? 'possible'
        : 'none',
      updatedAt: record.finishedAt ?? record.startedAt ?? record.admittedAt ?? record.scheduledFor,
    },
  }
}, automationRunShape) as z.ZodType<AutomationRun>

// `defineDomain()` and `domainTable()` are identity helpers in DSH. Keeping the
// declaration as a plain spec avoids making this public repository depend on a
// private DSH package merely to run its pure domain tests; the Host validates
// the same zod schemas when it opens the domain.
export const automationDomainSpec = {
  name: 'dsh_automation_center',
  version: 1,
  tables: {
    definitions: { valueSchema: automationDefinitionSchema },
    runs: { valueSchema: automationRunSchema },
    receipts: { valueSchema: z.object({
      requestId: nonBlank,
      command: z.enum([
        'create', 'update', 'pause', 'resume', 'delete', 'run-now', 'cancel-run', 'mark-read',
        'review-accept', 'review-keep', 'review-discard',
      ]),
      outcome: z.enum(['committed', 'rejected', 'unknown']),
      entityId: nonBlank.optional(),
      revision: z.number().int().positive().optional(),
      appliedAt: instant,
      error: z.object({ code: nonBlank, message: nonBlank }).optional(),
      scopeKey: nonBlank,
      fingerprint: nonBlank,
    }) as z.ZodType<StoredAutomationCommandReceipt> },
  },
} as const

export function createDefinition(input: CreateAutomationInput): AutomationDefinition {
  const schedule = normalizeSchedule(input.schedule)
  const now = parseInstant(input.now, 'now')
  const resolvedModelPolicy = normalizeModelPolicy(input.modelPolicy, input.provider, input.model)
  return automationDefinitionSchema.parse({
    version: 1,
    id: requireNonBlank(input.id, 'id'),
    revision: 1,
    name: requireNonBlank(input.name, 'name'),
    prompt: requireNonBlank(input.prompt, 'prompt'),
    status: 'active',
    schedule,
    rrule: scheduleToRRule(schedule),
    timeZone: schedule.timeZone,
    workspaceId: requireNonBlank(input.workspaceId, 'workspaceId'),
    cwd: requireNonBlank(input.cwd, 'cwd'),
    agentPreset: requireNonBlank(input.agentPreset, 'agentPreset'),
    modelPolicy: resolvedModelPolicy,
    provider: resolvedModelPolicy.mode === 'pinned' ? resolvedModelPolicy.provider : null,
    model: resolvedModelPolicy.mode === 'pinned' ? resolvedModelPolicy.model : null,
    permissionPreset: input.permissionPreset ?? 'read-only',
    reviewMode: input.reviewMode ?? 'direct',
    runTimeoutMinutes: input.runTimeoutMinutes ?? 60,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  })
}

export function automationRunIdentity(run: AutomationRun) {
  return {
    automationId: run.automationId,
    definitionRevision: run.definitionRevision,
    occurrenceKey: run.occurrenceKey,
    workspaceId: run.targetSnapshot.workspaceId,
  } as const
}

export function updateDefinition(
  current: AutomationDefinition,
  input: UpdateAutomationInput,
): AutomationDefinition {
  automationDefinitionSchema.parse(current)
  const schedule = normalizeSchedule(input.schedule ?? current.schedule)
  const resolvedModelPolicy = input.modelPolicy === undefined
    ? current.modelPolicy
    : normalizeModelPolicy(input.modelPolicy)
  return automationDefinitionSchema.parse({
    ...current,
    revision: current.revision + 1,
    name: input.name === undefined ? current.name : requireNonBlank(input.name, 'name'),
    prompt: input.prompt === undefined ? current.prompt : requireNonBlank(input.prompt, 'prompt'),
    status: input.status ?? current.status,
    schedule,
    rrule: scheduleToRRule(schedule),
    timeZone: schedule.timeZone,
    agentPreset: input.agentPreset === undefined
      ? current.agentPreset
      : requireNonBlank(input.agentPreset, 'agentPreset'),
    modelPolicy: resolvedModelPolicy,
    provider: resolvedModelPolicy.mode === 'pinned' ? resolvedModelPolicy.provider : null,
    model: resolvedModelPolicy.mode === 'pinned' ? resolvedModelPolicy.model : null,
    permissionPreset: input.permissionPreset ?? current.permissionPreset,
    reviewMode: input.reviewMode ?? current.reviewMode,
    runTimeoutMinutes: input.runTimeoutMinutes ?? current.runTimeoutMinutes,
    updatedAt: parseInstant(input.now, 'now'),
  })
}

export function pauseDefinition(current: AutomationDefinition, now: string): AutomationDefinition {
  return setStatus(current, 'paused', now)
}

export function resumeDefinition(current: AutomationDefinition, now: string): AutomationDefinition {
  return setStatus(current, 'active', now)
}

export function deleteDefinition(current: AutomationDefinition): DeleteAutomationPlan {
  automationDefinitionSchema.parse(current)
  return { id: current.id, preserveRunHistory: true }
}

export function occurrenceKey(
  automationId: string,
  definitionRevision: number,
  scheduledFor: string,
): string {
  return `${requireNonBlank(automationId, 'automationId')}:${positiveInteger(definitionRevision, 'definitionRevision')}:${parseInstant(scheduledFor, 'scheduledFor')}`
}

export function runIdForOccurrence(key: string): string {
  return `run_${createHash('sha256').update(requireNonBlank(key, 'occurrenceKey')).digest('hex').slice(0, 32)}`
}

export function createScheduledRun(definition: AutomationDefinition, scheduledFor: string): AutomationRun {
  automationDefinitionSchema.parse(definition)
  const normalizedInstant = parseInstant(scheduledFor, 'scheduledFor')
  const key = occurrenceKey(definition.id, definition.revision, normalizedInstant)
  return queuedRun(definition, normalizedInstant, 'schedule', key, runIdForOccurrence(key))
}

export function createManualRun(
  definition: AutomationDefinition,
  scheduledFor: string,
  nonce: string = randomUUID(),
): AutomationRun {
  automationDefinitionSchema.parse(definition)
  const normalizedInstant = parseInstant(scheduledFor, 'scheduledFor')
  const key = `manual:${definition.id}:${requireNonBlank(nonce, 'nonce')}`
  return queuedRun(definition, normalizedInstant, 'manual', key, runIdForOccurrence(key))
}

function setStatus(
  current: AutomationDefinition,
  status: AutomationDefinition['status'],
  now: string,
): AutomationDefinition {
  automationDefinitionSchema.parse(current)
  if (current.status === status) return current
  return automationDefinitionSchema.parse({
    ...current,
    status,
    revision: current.revision + 1,
    updatedAt: parseInstant(now, 'now'),
  })
}

function queuedRun(
  definition: AutomationDefinition,
  scheduledFor: string,
  trigger: AutomationRun['trigger'],
  key: string,
  id: string,
): AutomationRun {
  return automationRunSchema.parse({
    version: 1,
    id,
    automationId: definition.id,
    definitionRevision: definition.revision,
    occurrenceKey: key,
    trigger,
    scheduledFor,
    admittedAt: scheduledFor,
    attempt: 1,
    sequence: 0,
    status: 'queued',
    phase: 'claim',
    lease: null,
    promptSnapshot: definition.prompt,
    targetSnapshot: {
      workspaceId: definition.workspaceId,
      cwd: definition.cwd,
      agentPreset: definition.agentPreset,
      modelPolicy: definition.modelPolicy,
      provider: definition.provider,
      model: definition.model,
      permissionPreset: definition.permissionPreset,
      reviewMode: definition.reviewMode,
      runTimeoutMinutes: definition.runTimeoutMinutes,
    },
    sessionId: null,
    startedAt: null,
    finishedAt: null,
    summary: null,
    error: null,
    outcome: 'pending',
    attention: 'none',
    effect: { status: 'none', updatedAt: scheduledFor },
    unread: true,
    effectiveModel: null,
    effectiveContext: null,
    review: null,
  })
}

function normalizeModelPolicy(
  policy: ModelPolicy | undefined,
  legacyProvider?: string | null,
  legacyModel?: string | null,
): ModelPolicy {
  if (policy?.mode === 'pinned') {
    const provider = requireNonBlank(policy.provider, 'modelPolicy.provider')
    const model = requireNonBlank(policy.model, 'modelPolicy.model')
    const reasoningEffort = policy.reasoningEffort?.trim()
    return {
      mode: 'pinned', provider, model,
      ...(reasoningEffort === undefined || reasoningEffort === '' ? {} : { reasoningEffort }),
    }
  }
  if (policy?.mode === 'inherit') return { mode: 'inherit' }
  if (legacyProvider != null && legacyModel != null) {
    return {
      mode: 'pinned',
      provider: requireNonBlank(legacyProvider, 'provider'),
      model: requireNonBlank(legacyModel, 'model'),
    }
  }
  return { mode: 'inherit' }
}

function requireNonBlank(value: string, field: string): string {
  const trimmed = value.trim()
  if (trimmed === '') throw new Error(`${field} must not be blank`)
  return trimmed
}

function parseInstant(value: string, field: string): string {
  const result = instant.safeParse(value)
  if (!result.success) throw new Error(`${field} must be an ISO-8601 instant with an explicit offset`)
  return new Date(result.data).toISOString()
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${field} must be a positive integer`)
  return value
}

export type { AutomationSchedule }

/** Loopback-only Host RPC adapter for the Automation Web client. */

import type { AutomationService } from './service.ts'
import { automationRunIdentity } from './domain.ts'
import type { AutomationSchedule as DomainSchedule, ModelPolicy, Weekday } from './types.ts'

const WEEKDAYS: readonly Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

interface RpcContext {
  readonly connection: {
    readonly rpc: {
      handle(
        channel: string,
        handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>,
        options?: { readonly authority: 'loopback' | 'trusted-host' },
      ): () => Promise<void>
    }
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function string(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${label} must be a non-empty string`)
  return value
}

function optionalString(value: unknown, label: string): string | undefined {
  return value === undefined ? undefined : string(value, label)
}

function integer(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error(`${label} must be an integer`)
  return value
}

function positiveInteger(value: unknown, label: string): number {
  const result = integer(value, label)
  if (result < 1) throw new Error(`${label} must be a positive integer`)
  return result
}

function toDomainSchedule(raw: unknown, timeZone: string): DomainSchedule {
  const schedule = record(raw, 'schedule')
  const kind = string(schedule.kind, 'schedule.kind')
  switch (kind) {
    case 'once':
      return { kind, at: string(schedule.at, 'schedule.at'), timeZone }
    case 'interval': {
      const everyMinutes = integer(schedule.everyMinutes, 'schedule.everyMinutes')
      return {
        kind,
        everyMinutes,
        anchor: optionalString(schedule.anchor, 'schedule.anchor') ?? new Date().toISOString(),
        timeZone,
      }
    }
    case 'daily':
      return { kind, time: string(schedule.time, 'schedule.time'), timeZone }
    case 'weekly': {
      if (!Array.isArray(schedule.weekdays)) throw new Error('schedule.weekdays must be an array')
      const weekdays = schedule.weekdays.map((value) => {
        const number = integer(value, 'schedule.weekdays[]')
        const weekday = WEEKDAYS[number - 1]
        if (weekday === undefined) throw new Error('schedule.weekdays must contain numbers from 1 to 7')
        return weekday
      })
      return { kind, time: string(schedule.time, 'schedule.time'), weekdays, timeZone }
    }
    default:
      throw new Error('schedule.kind must be once, interval, daily, or weekly')
  }
}

function toClientSchedule(schedule: DomainSchedule): Record<string, unknown> {
  if (schedule.kind !== 'weekly') return { ...schedule }
  return {
    ...schedule,
    weekdays: schedule.weekdays.map(day => WEEKDAYS.indexOf(day) + 1),
  }
}

function toModelPolicy(raw: unknown): ModelPolicy {
  const policy = record(raw, 'input.modelPolicy')
  const mode = string(policy.mode, 'input.modelPolicy.mode')
  if (mode === 'inherit') return { mode }
  if (mode !== 'pinned') throw new Error('input.modelPolicy.mode must be inherit or pinned')
  return {
    mode,
    provider: string(policy.provider, 'input.modelPolicy.provider'),
    model: string(policy.model, 'input.modelPolicy.model'),
    ...(policy.reasoningEffort === undefined
      ? {}
      : { reasoningEffort: string(policy.reasoningEffort, 'input.modelPolicy.reasoningEffort') }),
  }
}

function errorResult(
  error: unknown,
  aborted = false,
): { readonly ok: false; readonly error: Record<string, unknown> } {
  if (aborted) {
    return {
      ok: false,
      error: { code: 'cancelled', message: 'The automation request was cancelled.', details: {} },
    }
  }
  const message = error instanceof Error ? error.message : String(error)
  const badRequest = /must|required|unknown automation|another workspace|scheduled in the future|already has a queued or running run|not registered|requires a live source session|has no workspace|request was cancelled|changed since it was opened/.test(message)
  return {
    ok: false,
    error: {
      code: badRequest ? 'bad-request' : 'internal',
      message: badRequest
        ? 'The automation request is invalid or no longer applicable.'
        : 'The automation request failed inside the Host.',
      details: badRequest ? { issues: [] } : {},
    },
  }
}

function scopeOf(payload: Record<string, unknown>) {
  if (payload.sessionId !== undefined) {
    return { sessionId: string(payload.sessionId, 'sessionId'), creatorKind: 'agent' as const }
  }
  return {
    creatorKind: 'web' as const,
    ...(payload.workspaceId === undefined ? {} : { workspaceId: string(payload.workspaceId, 'workspaceId') }),
  }
}

async function snapshotValue(service: AutomationService, payload: Record<string, unknown>, signal: AbortSignal) {
  const snapshot = await service.snapshot(scopeOf(payload), signal)
  const names = new Map(snapshot.definitions.map(definition => [definition.id, definition.name]))
  return {
    filterWorkspaceId: snapshot.filterWorkspaceId,
    workspaces: snapshot.workspaces,
    presets: snapshot.presets,
    defaultModel: snapshot.defaultModel,
    models: snapshot.models,
    automations: snapshot.definitions.map(definition => ({
      id: definition.id,
      revision: definition.revision,
      name: definition.name,
      prompt: definition.prompt,
      status: definition.status,
      schedule: toClientSchedule(definition.schedule),
      // Kept for wire compatibility; the Client localizes the structured schedule.
      scheduleSummary: definition.rrule,
      timeZone: definition.timeZone,
      permission: definition.permissionPreset,
      reviewMode: definition.reviewMode,
      workspaceId: definition.workspaceId,
      workspaceName: snapshot.workspaces.find(item => item.id === definition.workspaceId)?.title ?? definition.workspaceId,
      agentPreset: definition.agentPreset,
      modelPolicy: definition.modelPolicy,
      health: {
        status: definition.health.status,
        issues: definition.health.issues,
        expectedAt: definition.health.expectedAt,
        admittedAt: definition.health.admittedAt,
        claimedAt: definition.health.claimedAt,
        lastProgressAt: definition.health.lastProgressAt,
        overdueByMs: definition.health.overdueByMs,
        queueWaitMs: definition.health.queueWaitMs,
        admissionStatus: definition.health.admissionStatus,
        ...(definition.health.effectiveModel == null
          ? {}
          : { effectiveModel: definition.health.effectiveModel }),
      },
      runTimeoutMinutes: definition.runTimeoutMinutes,
      ...(definition.nextRunAt === null ? {} : { nextRunAt: definition.nextRunAt }),
      ...(definition.lastRun === null ? {} : {
        lastRunAt: definition.lastRun.finishedAt ?? definition.lastRun.startedAt ?? definition.lastRun.scheduledFor,
        lastRunStatus: definition.lastRun.status,
      }),
      createdAt: definition.createdAt,
      updatedAt: definition.updatedAt,
    })),
    runs: snapshot.runs.map(run => ({
      id: run.id,
      automationId: run.automationId,
      automationName: names.get(run.automationId) ?? 'Deleted automation',
      status: run.status,
      ...(run.phase == null ? {} : { phase: run.phase }),
      ...(run.lease == null ? {} : {
        heartbeatAt: run.lease.heartbeatAt,
        leaseExpiresAt: run.lease.expiresAt,
        sideEffectsPossible: run.lease.sideEffectsPossible,
      }),
      ...(run.effectiveModel == null ? {} : { effectiveModel: run.effectiveModel }),
      ...(run.effectiveContext == null ? {} : { effectiveContext: run.effectiveContext }),
      ...(run.attempt == null ? {} : { attempt: run.attempt }),
      ...(run.sequence == null ? {} : { sequence: run.sequence }),
      ...(run.outcome == null ? {} : { outcome: run.outcome }),
      ...(run.attention == null ? {} : { attention: run.attention }),
      ...(run.effect == null ? {} : { effect: run.effect }),
      ...(run.review == null ? {} : { review: run.review }),
      identity: automationRunIdentity(run),
      trigger: run.trigger,
      scheduledFor: run.scheduledFor,
      ...(run.admittedAt == null ? {} : { admittedAt: run.admittedAt }),
      ...(run.startedAt === null ? {} : { startedAt: run.startedAt }),
      ...(run.finishedAt === null ? {} : { finishedAt: run.finishedAt }),
      ...(run.sessionId === null ? {} : { sessionId: run.sessionId }),
      sessionArchived: run.sessionArchived,
      ...(run.summary === null ? {} : { summary: run.summary }),
      ...(run.error === null ? {} : { error: run.error.message, errorCode: run.error.code }),
      unread: run.unread,
    })),
    migration: snapshot.migration,
    serverNow: snapshot.generatedAt,
  }
}

/**
 * Register one authenticated management channel. rc.8/rc.2 enforce the
 * requested loopback authority; alpha.1 authenticates the channel through its
 * one-time browser token and ignores the legacy third argument.
 */
export function registerAutomationRpc(ctx: RpcContext, service: AutomationService): () => Promise<void> {
  return ctx.connection.rpc.handle('/dsh-automation-center', async (endpoint, rawPayload, signal) => {
    try {
      if (signal.aborted) throw new Error('The request was cancelled.')
      const payload = record(rawPayload, 'payload')
      switch (endpoint) {
        case 'snapshot':
          return { ok: true, value: await snapshotValue(service, payload, signal) }
        case 'create': {
          const input = record(payload.input, 'input')
          const timeZone = string(input.timeZone, 'input.timeZone')
          const permission = input.permission === undefined ? 'read-only' : string(input.permission, 'input.permission')
          if (permission !== 'read-only' && permission !== 'workspace-write') {
            throw new Error('input.permission must be read-only or workspace-write')
          }
          const agentPreset = optionalString(input.agentPreset, 'input.agentPreset')
          const reviewMode = input.reviewMode === undefined ? 'direct' : string(input.reviewMode, 'input.reviewMode')
          if (reviewMode !== 'direct' && reviewMode !== 'worktree') {
            throw new Error('input.reviewMode must be direct or worktree')
          }
          const runTimeoutMinutes = input.runTimeoutMinutes === undefined
            ? undefined
            : positiveInteger(input.runTimeoutMinutes, 'input.runTimeoutMinutes')
          const receipt = await service.dispatch(scopeOf(payload), {
            kind: 'create',
            requestId: string(payload.clientRequestId, 'clientRequestId'),
            input: {
            name: string(input.name, 'input.name'),
            prompt: string(input.prompt, 'input.prompt'),
            schedule: toDomainSchedule(input.schedule, timeZone),
            permissionPreset: permission,
            reviewMode,
            ...(input.modelPolicy === undefined ? {} : { modelPolicy: toModelPolicy(input.modelPolicy) }),
            ...(agentPreset === undefined ? {} : { agentPreset }),
            ...(runTimeoutMinutes === undefined ? {} : { runTimeoutMinutes }),
            },
          }, signal)
          return { ok: true, value: receipt }
        }
        case 'update': {
          const id = string(payload.automationId, 'automationId')
          const input = record(payload.input, 'input')
          const value: {
            expectedRevision: number
            name?: string
            prompt?: string
            schedule?: DomainSchedule
            permissionPreset?: 'read-only' | 'workspace-write'
            reviewMode?: 'direct' | 'worktree'
            agentPreset?: string
            modelPolicy?: ModelPolicy
            runTimeoutMinutes?: number
          } = {
            expectedRevision: positiveInteger(payload.expectedRevision, 'expectedRevision'),
          }
          if (input.name !== undefined) value.name = string(input.name, 'input.name')
          if (input.prompt !== undefined) value.prompt = string(input.prompt, 'input.prompt')
          if (input.schedule !== undefined) {
            const timeZone = string(input.timeZone, 'input.timeZone')
            value.schedule = toDomainSchedule(input.schedule, timeZone)
          } else if (input.timeZone !== undefined) {
            throw new Error('input.timeZone requires input.schedule')
          }
          if (input.permission !== undefined) {
            const permission = string(input.permission, 'input.permission')
            if (permission !== 'read-only' && permission !== 'workspace-write') {
              throw new Error('input.permission must be read-only or workspace-write')
            }
            value.permissionPreset = permission
          }
          if (input.reviewMode !== undefined) {
            const reviewMode = string(input.reviewMode, 'input.reviewMode')
            if (reviewMode !== 'direct' && reviewMode !== 'worktree') {
              throw new Error('input.reviewMode must be direct or worktree')
            }
            value.reviewMode = reviewMode
          }
          if (input.agentPreset !== undefined) value.agentPreset = string(input.agentPreset, 'input.agentPreset')
          if (input.modelPolicy !== undefined) value.modelPolicy = toModelPolicy(input.modelPolicy)
          if (input.runTimeoutMinutes !== undefined) {
            value.runTimeoutMinutes = positiveInteger(input.runTimeoutMinutes, 'input.runTimeoutMinutes')
          }
          const receipt = await service.dispatch(scopeOf(payload), {
            kind: 'update',
            requestId: string(payload.clientRequestId, 'clientRequestId'),
            automationId: id,
            input: value,
          }, signal)
          return { ok: true, value: receipt }
        }
        case 'mutate': {
          const id = string(payload.automationId, 'automationId')
          const mutation = string(payload.mutation, 'mutation')
          if (mutation !== 'pause' && mutation !== 'resume' && mutation !== 'delete') {
            throw new Error('mutation must be pause, resume, or delete')
          }
          const receipt = await service.dispatch(scopeOf(payload), {
            kind: mutation,
            requestId: string(payload.clientRequestId, 'clientRequestId'),
            automationId: id,
          }, signal)
          return { ok: true, value: receipt }
        }
        case 'run-now': {
          const receipt = await service.dispatch(scopeOf(payload), {
            kind: 'run-now',
            requestId: string(payload.clientRequestId, 'clientRequestId'),
            automationId: string(payload.automationId, 'automationId'),
          }, signal)
          return { ok: true, value: receipt }
        }
        case 'mark-read': {
          const receipt = await service.dispatch(scopeOf(payload), {
            kind: 'mark-read',
            requestId: string(payload.clientRequestId, 'clientRequestId'),
            runId: string(payload.runId, 'runId'),
          }, signal)
          return { ok: true, value: receipt }
        }
        case 'cancel-run': {
          const receipt = await service.dispatch(scopeOf(payload), {
            kind: 'cancel-run',
            requestId: string(payload.clientRequestId, 'clientRequestId'),
            runId: string(payload.runId, 'runId'),
          }, signal)
          return { ok: true, value: receipt }
        }
        case 'review': {
          const action = string(payload.action, 'action')
          if (action !== 'accept' && action !== 'keep' && action !== 'discard') {
            throw new Error('action must be accept, keep, or discard')
          }
          const receipt = await service.dispatch(scopeOf(payload), {
            kind: `review-${action}`,
            requestId: string(payload.clientRequestId, 'clientRequestId'),
            runId: string(payload.runId, 'runId'),
          }, signal)
          return { ok: true, value: receipt }
        }
        default:
          throw new Error(`unknown automation endpoint '${endpoint}'`)
      }
    } catch (error) {
      return errorResult(error, signal.aborted)
    }
  }, { authority: 'loopback' })
}

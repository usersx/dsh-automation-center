/** Durable automation authority: definitions, occurrence claims, clock, and run execution. */

import { createHash, randomUUID } from 'node:crypto'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-agent-presets'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import type {} from '@deepseek-ai/dsh-workspace'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import {
  automationDomainSpec,
  createDefinition,
  createManualRun,
  createScheduledRun,
  deleteDefinition,
  updateDefinition,
} from './domain.ts'
import { executeAutomationRun } from './executor.ts'
import {
  legacyAutomationDomainSpec,
  type LegacyDefinition,
  type LegacyMigrationSummary,
  type LegacyRun,
} from './legacy.ts'
import { latestDueOccurrence, nextOccurrence } from './recurrence.ts'
import type {
  AutomationDefinition,
  AutomationRun,
  AutomationSchedule,
  PermissionPreset,
  UpdateAutomationInput,
} from './types.ts'

const MAX_TIMER_DELAY_MS = 2_147_483_647
export const AUTOMATION_SESSION_PREFIX = 'dsh-automation-session-'

export interface AutomationConfig {
  readonly maxConcurrentRuns: number
  readonly runTimeoutMs: number
  readonly misfireGraceMs: number
  readonly historyLimit: number
  readonly archiveRunSessions: boolean
}

export interface CreateRequest {
  readonly clientRequestId?: string
  readonly name: string
  readonly prompt: string
  readonly schedule: AutomationSchedule
  readonly permissionPreset?: PermissionPreset
  readonly agentPreset?: string
  readonly runTimeoutMinutes?: number
}

export type AutomationScope =
  | { readonly sessionId: string; readonly creatorKind: 'agent' }
  | { readonly workspaceId?: string; readonly creatorKind: 'web' }

export interface AutomationSnapshot {
  readonly generatedAt: string
  readonly filterWorkspaceId?: string
  readonly workspaces: readonly { readonly id: string; readonly title: string; readonly path: string }[]
  readonly presets: readonly { readonly id: string; readonly name: string; readonly broken: boolean }[]
  readonly definitions: readonly AutomationDefinitionView[]
  readonly runs: readonly AutomationRunView[]
  readonly migration: LegacyMigrationSummary
}

export interface AutomationDefinitionView extends AutomationDefinition {
  readonly nextRunAt: string | null
  readonly lastRun: AutomationRun | null
}

export interface AutomationRunView extends AutomationRun {
  readonly sessionArchived: boolean
}

interface SessionEventLike {
  readonly type: string
  readonly data: unknown
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function toIso(ms = Date.now()): string {
  return new Date(ms).toISOString()
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted === true) throw new Error('The automation request was cancelled.')
}

function compareRuns(left: AutomationRun, right: AutomationRun): number {
  return Date.parse(right.scheduledFor) - Date.parse(left.scheduledFor)
    || right.id.localeCompare(left.id)
}

/** One host-lifetime service. Timer state is disposable; domain records are authority. */
export class AutomationService {
  private definitions!: KvTable<string, AutomationDefinition>
  private runs!: KvTable<string, AutomationRun>
  private timer: ReturnType<typeof setTimeout> | undefined
  private operationTail: Promise<void> = Promise.resolve()
  private pumpScheduled = false
  private requested = false
  private started = false
  private stopping = false
  private readonly active = new Map<string, { readonly abort: AbortController; readonly promise: Promise<void> }>()
  private migration: LegacyMigrationSummary = {
    detectedDefinitions: 0,
    detectedRuns: 0,
    importedDefinitions: 0,
    importedRuns: 0,
  }

  private constructor(
    private readonly ctx: Context,
    private readonly domain: Domain<typeof automationDomainSpec>,
    private readonly config: AutomationConfig,
  ) {}

  static async open(ctx: Context, config: AutomationConfig): Promise<AutomationService> {
    const domain = await ctx.storageDomain.open(automationDomainSpec)
    try {
      const service = new AutomationService(ctx, domain, config)
      service.definitions = domain.table('definitions') as KvTable<string, AutomationDefinition>
      service.runs = domain.table('runs') as KvTable<string, AutomationRun>
      service.migration = await service.importLegacyData()
      await service.recoverInterruptedRuns()
      await service.archiveTerminalRunSessions()
      await service.pruneAllHistory()
      return service
    } catch (error) {
      await domain.close().catch(() => {})
      throw error
    }
  }

  /** Start the disposable clock only after the surrounding Loader has settled. */
  start(): void {
    if (this.started || this.stopping) return
    this.started = true
    this.requestPump()
  }

  /**
   * Automation-created sessions must never receive management tools. The run
   * table covers live/new sessions; durable message provenance covers an old
   * session even after its bounded run record has been pruned.
   */
  ownsSession(sessionId: string, events: readonly SessionEventLike[] = []): boolean {
    if (sessionId.startsWith(AUTOMATION_SESSION_PREFIX)) return true
    if ([...this.runs.entries()].some(([, run]) => run.sessionId === sessionId)) return true
    return events.some((event) => {
      if (event.type !== 'user/message' || typeof event.data !== 'object' || event.data === null) return false
      const source = (event.data as { readonly source?: unknown }).source
      return typeof source === 'object' && source !== null
        && (source as { readonly kind?: unknown }).kind === 'automation'
    })
  }

  async dispose(): Promise<void> {
    if (this.stopping) return
    this.stopping = true
    this.requested = false
    this.clearTimer()
    // A pump that was already admitted may be between durable writes. Drain
    // it before taking the active-run snapshot so no late run escapes abort.
    await this.operationTail.catch(() => {})
    for (const { abort } of this.active.values()) abort.abort()
    await Promise.allSettled([...this.active.values()].map(value => value.promise))
    await this.domain.close()
  }

  async snapshot(scope: AutomationScope, signal?: AbortSignal): Promise<AutomationSnapshot> {
    return this.serialize(async () => {
      throwIfCancelled(signal)
      const workspaces = this.ctx.workspaceRegistry.list()
        .map((workspace: { id: string; title: string; path: string }) => ({
          id: String(workspace.id), title: workspace.title, path: workspace.path,
        }))
      const selectedWorkspaceId = scope.creatorKind === 'agent'
        ? String((await this.resolveScope(scope)).workspace.id)
        : scope.workspaceId
      if (selectedWorkspaceId !== undefined && !workspaces.some((item: { id: string }) => item.id === selectedWorkspaceId)) {
        throw new Error('The selected workspace is not registered.')
      }
      const definitions = [...this.definitions.entries()]
        .map(([, definition]) => definition)
        .filter(definition => selectedWorkspaceId === undefined || definition.workspaceId === selectedWorkspaceId)
        .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      const workspaceRuns = [...this.runs.entries()]
        .map(([, run]) => run)
        .filter(run => selectedWorkspaceId === undefined || run.targetSnapshot.workspaceId === selectedWorkspaceId)
        .sort(compareRuns)
      const archivedSessionIds = new Set(this.ctx.workspaceRegistry.archivedSessionIds.map(String))
      const runs = workspaceRuns.slice(0, this.config.historyLimit).map((run): AutomationRunView => ({
        ...run,
        sessionArchived: run.sessionId !== null && archivedSessionIds.has(run.sessionId),
      }))
      const generatedAt = toIso()
      const presets = (await this.ctx.agentPresets.list()).map((preset: { id: string; name?: string; broken?: unknown }) => ({
        id: preset.id,
        name: preset.name ?? preset.id,
        broken: preset.broken !== undefined,
      }))
      return {
        generatedAt,
        ...(selectedWorkspaceId === undefined ? {} : { filterWorkspaceId: selectedWorkspaceId }),
        workspaces,
        presets,
        definitions: definitions.map((definition) => ({
          ...definition,
          nextRunAt: definition.status === 'active' ? nextOccurrence(definition.schedule, generatedAt) : null,
          lastRun: workspaceRuns.find(run => run.automationId === definition.id) ?? null,
        })),
        runs,
        migration: this.migration,
      }
    }, signal)
  }

  async create(scope: AutomationScope, request: CreateRequest, signal?: AbortSignal): Promise<AutomationDefinition> {
    const definition = await this.serialize(async () => {
      const resolved = await this.resolveScope(scope)
      throwIfCancelled(signal)
      const now = toIso()
      if (request.schedule.kind === 'once' && nextOccurrence(request.schedule, now) === null) {
        throw new Error('A one-time automation must be scheduled in the future.')
      }
      const loggedSelection = resolved.agent?.session.requestHeader()?.config
      const selection = loggedSelection ?? this.ctx.agentDefaultModel.currentSelection()
      const agentPreset = request.agentPreset
        ?? (resolved.agent === undefined ? undefined : this.ctx.agentPresets.composedPreset(resolved.agent.ctx))
        ?? resolved.agent?.session.header.agentPreset
        ?? this.ctx.agentPresets.defaultId
      const resolvedPreset = await this.ctx.agentPresets.resolve(agentPreset)
      if (resolvedPreset.broken !== undefined) throw new Error(`Agent preset '${agentPreset}' is unavailable.`)
      const requestId = request.clientRequestId?.trim() || randomUUID()
      const id = `automation_${createHash('sha256')
        .update(`${resolved.workspace.id}:${requestId}`)
        .digest('hex').slice(0, 32)}`
      const existing = this.definitions.get(id)
      if (existing !== undefined) return existing
      const value = createDefinition({
        id,
        name: request.name,
        prompt: request.prompt,
        schedule: request.schedule,
        workspaceId: resolved.workspace.id,
        cwd: resolved.workspace.path,
        agentPreset,
        provider: selection.provider,
        model: selection.model,
        permissionPreset: request.permissionPreset ?? 'read-only',
        runTimeoutMinutes: request.runTimeoutMinutes ?? Math.max(1, Math.round(this.config.runTimeoutMs / 60_000)),
        createdBy: {
          kind: scope.creatorKind,
          sessionId: scope.creatorKind === 'agent' ? scope.sessionId : `web:${resolved.workspace.id}`,
        },
        now,
      })
      await this.definitions.put(value.id, value)
      return value
    }, signal)
    this.requestPump()
    return definition
  }

  async update(
    scope: AutomationScope,
    id: string,
    input: Omit<UpdateAutomationInput, 'now'> & {
      readonly status?: 'active' | 'paused'
      readonly expectedRevision?: number
    },
    signal?: AbortSignal,
  ): Promise<AutomationDefinition> {
    const next = await this.serialize(async () => {
      const current = await this.ownedDefinition(scope, id)
      throwIfCancelled(signal)
      const now = toIso()
      const { status, expectedRevision, ...fields } = input
      if (expectedRevision !== undefined && current.revision !== expectedRevision) {
        throw new Error('The automation changed since it was opened. Close and reopen the editor before saving again.')
      }
      if (fields.schedule?.kind === 'once' && nextOccurrence(fields.schedule, now) === null) {
        throw new Error('A one-time automation must be scheduled in the future.')
      }
      const statusChanged = status !== undefined && status !== current.status
      const value = Object.keys(fields).length === 0 && !statusChanged
        ? current
        : updateDefinition(current, { ...fields, ...(status === undefined ? {} : { status }), now })
      if (value !== current) await this.definitions.put(id, value)
      return value
    }, signal)
    this.requestPump()
    return next
  }

  async delete(
    scope: AutomationScope,
    id: string,
    signal?: AbortSignal,
  ): Promise<{ readonly id: string; readonly deleted: boolean }> {
    const deleted = await this.serialize(async () => {
      const current = await this.ownedDefinition(scope, id)
      throwIfCancelled(signal)
      deleteDefinition(current)
      return this.definitions.delete(id)
    }, signal)
    this.requestPump()
    return { id, deleted }
  }

  async runNow(scope: AutomationScope, id: string, signal?: AbortSignal): Promise<AutomationRun> {
    const run = await this.serialize(async () => {
      const definition = await this.ownedDefinition(scope, id)
      throwIfCancelled(signal)
      const alreadyActive = [...this.runs.entries()].some(([, candidate]) => (
        candidate.automationId === id
        && (candidate.status === 'queued' || candidate.status === 'running')
      ))
      if (alreadyActive) throw new Error('The automation already has a queued or running run.')
      const value = createManualRun(definition, toIso())
      await this.runs.put(value.id, value)
      return value
    }, signal)
    this.requestPump()
    return run
  }

  async markRead(scope: AutomationScope, runId: string, signal?: AbortSignal): Promise<AutomationRun> {
    return this.serialize(async () => {
      const run = this.runs.get(runId)
      if (run === undefined) throw new Error(`unknown automation run '${runId}'`)
      if (scope.creatorKind === 'web' && scope.workspaceId === undefined) {
        throwIfCancelled(signal)
      } else {
        const { workspace } = await this.resolveScope(scope)
        if (run.targetSnapshot.workspaceId !== workspace.id) {
          throw new Error('The automation run belongs to another workspace.')
        }
      }
      throwIfCancelled(signal)
      if (!run.unread) return run
      const next = { ...run, unread: false }
      await this.runs.put(runId, next)
      return next
    }, signal)
  }

  async cancelRun(scope: AutomationScope, runId: string, signal?: AbortSignal): Promise<AutomationRun> {
    return this.serialize(async () => {
      const run = this.runs.get(runId)
      if (run === undefined) throw new Error(`unknown automation run '${runId}'`)
      if (!(scope.creatorKind === 'web' && scope.workspaceId === undefined)) {
        const { workspace } = await this.resolveScope(scope)
        if (run.targetSnapshot.workspaceId !== workspace.id) {
          throw new Error('The automation run belongs to another workspace.')
        }
      }
      throwIfCancelled(signal)
      if (run.status !== 'queued' && run.status !== 'running') {
        throw new Error('Only a queued or running automation can be cancelled.')
      }
      if (run.status === 'running') {
        this.active.get(runId)?.abort.abort()
        return run
      }
      const cancelled: AutomationRun = {
        ...run,
        status: 'cancelled',
        finishedAt: toIso(),
        error: { code: 'cancelled', message: 'The automation was cancelled before it started.' },
        unread: true,
      }
      await this.runs.put(runId, cancelled)
      return cancelled
    }, signal)
  }

  private async resolveScope(scope: AutomationScope) {
    if (scope.creatorKind === 'web') {
      if (scope.workspaceId === undefined) throw new Error('A workspace is required for this automation action.')
      const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(scope.workspaceId))
      if (workspace === undefined) throw new Error('The selected workspace is not registered.')
      return { workspace, agent: undefined }
    }
    const agent = this.ctx.agents.get(SessionId(scope.sessionId))
    if (agent === undefined) throw new Error('The automation UI/tool requires a live source session.')
    const cwd = agent.session.header.cwd
    if (cwd === undefined) throw new Error('The source session has no workspace directory.')
    const workspace = await this.ctx.workspaceRegistry.resolveByPath(cwd)
    if (workspace === undefined) throw new Error('The source session directory is not registered as a DSH workspace.')
    if (this.ctx.agents.get(SessionId(scope.sessionId)) !== agent) {
      throw new Error('The automation UI/tool requires a live source session.')
    }
    return { agent, workspace }
  }

  private async ownedDefinition(scope: AutomationScope, id: string): Promise<AutomationDefinition> {
    const definition = this.definitions.get(id)
    if (definition === undefined) throw new Error(`unknown automation '${id}'`)
    if (scope.creatorKind === 'web' && scope.workspaceId === undefined) return definition
    const { workspace } = await this.resolveScope(scope)
    if (definition.workspaceId !== workspace.id) throw new Error('The automation belongs to another workspace.')
    return definition
  }

  /** Import the old plugin's v1 domain without ever mutating or deleting it. */
  private async importLegacyData(): Promise<LegacyMigrationSummary> {
    const legacy = await this.ctx.storageDomain.open(legacyAutomationDomainSpec)
    try {
      const oldDefinitions = legacy.table('definitions') as KvTable<string, LegacyDefinition>
      const oldRuns = legacy.table('runs') as KvTable<string, LegacyRun>
      let importedDefinitions = 0
      let importedRuns = 0
      const defaultTimeout = Math.max(1, Math.round(this.config.runTimeoutMs / 60_000))
      for (const [id, old] of oldDefinitions.entries()) {
        const converted = { ...old, runTimeoutMinutes: defaultTimeout }
        const existing = this.definitions.get(id)
        if (existing !== undefined) {
          if (JSON.stringify(existing) !== JSON.stringify(converted)) {
            throw new Error(`legacy migration conflict for definition '${id}'`)
          }
          continue
        }
        await this.definitions.put(id, converted)
        importedDefinitions += 1
      }
      for (const [id, old] of oldRuns.entries()) {
        const converted = {
          ...old,
          targetSnapshot: { ...old.targetSnapshot, runTimeoutMinutes: defaultTimeout },
        }
        const existing = this.runs.get(id)
        if (existing !== undefined) {
          if (JSON.stringify(existing) !== JSON.stringify(converted)) {
            throw new Error(`legacy migration conflict for run '${id}'`)
          }
          continue
        }
        await this.runs.put(id, converted)
        importedRuns += 1
      }
      return {
        detectedDefinitions: oldDefinitions.size,
        detectedRuns: oldRuns.size,
        importedDefinitions,
        importedRuns,
      }
    } finally {
      await legacy.close()
    }
  }

  private requestPump(): void {
    if (this.stopping || !this.started) return
    this.clearTimer()
    this.requested = true
    if (this.pumpScheduled) return
    this.pumpScheduled = true
    void this.serialize(async () => {
      try {
        while (this.requested && !this.stopping) {
          this.requested = false
          await this.pumpOnce()
        }
      } catch (error: unknown) {
        this.ctx.logger.warn(`dsh-automation: scheduler pump failed: ${asMessage(error)}`)
        this.armRetryTimer()
      } finally {
        this.pumpScheduled = false
      }
    }).catch((error: unknown) => {
      if (!this.stopping) this.ctx.logger.warn(`dsh-automation: scheduler admission failed: ${asMessage(error)}`)
    })
  }

  private async pumpOnce(): Promise<void> {
    if (this.stopping) return
    const now = toIso()
    for (const [, definition] of this.definitions.entries()) {
      if (definition.status !== 'active') continue
      await this.claimLatestDue(definition, now)
    }
    if (this.stopping) return
    await this.startQueuedRuns()
    if (this.stopping) return
    this.armNextTimer(now)
  }

  private async claimLatestDue(definition: AutomationDefinition, now: string): Promise<void> {
    const scheduledFor = latestDueOccurrence(definition.schedule, now)
    // Creation, edits, and resume establish an exclusive activation boundary:
    // only occurrences strictly after it are eligible for unattended work.
    if (scheduledFor === null || Date.parse(scheduledFor) <= Date.parse(definition.updatedAt)) return
    const related = [...this.runs.entries()].map(([, run]) => run)
      .filter(run => run.automationId === definition.id)
    if (related.some(run => run.trigger === 'schedule' && run.scheduledFor === scheduledFor)) return
    const candidate = createScheduledRun(definition, scheduledFor)
    if (this.runs.get(candidate.id) !== undefined) return
    const overlapping = related.some(run => run.status === 'queued' || run.status === 'running')
    const age = Date.parse(now) - Date.parse(scheduledFor)
    if (overlapping || age > this.config.misfireGraceMs) {
      const reason = overlapping
        ? { code: 'overlap', message: 'Skipped because the previous run is still active.' }
        : { code: 'misfire', message: 'Skipped because the host resumed outside the catch-up window.' }
      await this.runs.put(candidate.id, {
        ...candidate,
        status: 'skipped',
        finishedAt: now,
        error: reason,
      })
      await this.pruneWorkspaceHistory(candidate.targetSnapshot.workspaceId)
      return
    }
    await this.runs.put(candidate.id, candidate)
  }

  private async startQueuedRuns(): Promise<void> {
    if (this.stopping) return
    const capacity = Math.max(0, this.config.maxConcurrentRuns - this.active.size)
    if (capacity === 0) return
    const activeAutomationIds = new Set(
      [...this.active.keys()]
        .map(id => this.runs.get(id)?.automationId)
        .filter((id): id is string => id !== undefined),
    )
    const candidates = [...this.runs.entries()].map(([, run]) => run)
      .filter(run => run.status === 'queued' && !this.active.has(run.id))
      .sort((left, right) => Date.parse(left.scheduledFor) - Date.parse(right.scheduledFor))
    const queued: AutomationRun[] = []
    for (const run of candidates) {
      if (activeAutomationIds.has(run.automationId)) continue
      activeAutomationIds.add(run.automationId)
      queued.push(run)
      if (queued.length === capacity) break
    }
    for (const run of queued) this.startRun(run)
  }

  private startRun(run: AutomationRun): void {
    const abort = new AbortController()
    const promise = this.executeRun(run, abort.signal)
      .catch(async (error: unknown) => {
        this.ctx.logger.warn(`dsh-automation: run '${run.id}' failed outside its execution boundary: ${asMessage(error)}`)
        try {
          const current = this.runs.get(run.id)
          if (current !== undefined && (current.status === 'queued' || current.status === 'running')) {
            const failed: AutomationRun = {
              ...current,
              status: 'failed',
              finishedAt: toIso(),
              error: { code: 'persistence_error', message: 'The run could not persist its execution state.' },
              unread: true,
            }
            await this.runs.put(run.id, failed)
            await this.archiveRunSession(failed)
            await this.pruneWorkspaceHistory(current.targetSnapshot.workspaceId)
          }
        } catch (recordError: unknown) {
          this.ctx.logger.warn(`dsh-automation: could not persist failure for run '${run.id}': ${asMessage(recordError)}`)
        }
      })
      .finally(() => {
        this.active.delete(run.id)
        this.requestPump()
      })
    this.active.set(run.id, { abort, promise })
  }

  private async executeRun(run: AutomationRun, signal: AbortSignal): Promise<void> {
    const definition = this.definitions.get(run.automationId)
    if (definition === undefined) {
      await this.runs.put(run.id, {
        ...run,
        status: 'failed',
        finishedAt: toIso(),
        error: { code: 'definition_deleted', message: 'The automation was deleted before this run started.' },
      })
      await this.pruneWorkspaceHistory(run.targetSnapshot.workspaceId)
      return
    }
    const startedAt = toIso()
    // The durable identity lives in the SessionId itself. This remains true
    // even if Agent creation fails before the first automation-sourced message
    // is appended and after bounded run history has pruned the owning row.
    const sessionId = `${AUTOMATION_SESSION_PREFIX}${randomUUID()}`
    const running: AutomationRun = { ...run, status: 'running', startedAt, sessionId }
    await this.runs.put(run.id, running)
    const completion = await executeAutomationRun(this.ctx, definition, run, {
      runTimeoutMs: run.targetSnapshot.runTimeoutMinutes * 60_000,
      sessionId,
      signal,
    })
    const finishedAt = toIso()
    const completed: AutomationRun = {
      ...running,
      status: completion.status,
      sessionId: completion.sessionId ?? null,
      finishedAt,
      summary: completion.summary ?? null,
      error: completion.error ?? null,
      unread: true,
    }
    await this.runs.put(run.id, completed)
    await this.archiveRunSession(completed)
    await this.pruneWorkspaceHistory(run.targetSnapshot.workspaceId)
  }

  private armNextTimer(now: string): void {
    if (this.stopping) return
    let target: number | undefined
    for (const [, definition] of this.definitions.entries()) {
      if (definition.status !== 'active') continue
      const next = nextOccurrence(definition.schedule, now)
      if (next === null) continue
      const candidate = Date.parse(next)
      if (target === undefined || candidate < target) target = candidate
    }
    if (target === undefined) return
    const delay = Math.max(1, Math.min(target - Date.parse(now), MAX_TIMER_DELAY_MS))
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.requestPump()
    }, delay)
  }

  private armRetryTimer(): void {
    if (this.stopping || this.timer !== undefined) return
    const delay = Math.max(1_000, Math.min(60_000, this.config.misfireGraceMs || 60_000))
    this.timer = setTimeout(() => {
      this.timer = undefined
      this.requestPump()
    }, delay)
  }

  private clearTimer(): void {
    if (this.timer === undefined) return
    clearTimeout(this.timer)
    this.timer = undefined
  }

  /** Serialize service-level mutations and scheduler admission around domain writes. */
  private serialize<T>(operation: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.stopping) return Promise.reject(new Error('The automation service is stopping.'))
    if (signal?.aborted === true) return Promise.reject(new Error('The automation request was cancelled.'))
    const result = this.operationTail.then(async () => {
      throwIfCancelled(signal)
      return operation()
    })
    this.operationTail = result.then(() => {}, () => {})
    return result
  }

  private async recoverInterruptedRuns(): Promise<void> {
    const finishedAt = toIso()
    for (const [id, run] of this.runs.entries()) {
      if (run.status !== 'queued' && run.status !== 'running') continue
      await this.runs.put(id, {
        ...run,
        status: 'failed',
        finishedAt,
        error: {
          code: 'host_interrupted',
          message: 'The DSH Host stopped before this automation run reached a terminal state.',
        },
        unread: true,
      })
    }
  }

  /** Archive terminal run Sessions without changing their durable run result. */
  private async archiveRunSession(run: AutomationRun): Promise<void> {
    if (!this.config.archiveRunSessions || run.sessionId === null
      || run.status === 'queued' || run.status === 'running') return
    try {
      await this.ctx.workspaceRegistry.archiveSession(SessionId(run.sessionId))
    } catch (error: unknown) {
      this.ctx.logger.warn(`dsh-automation: could not archive Session '${run.sessionId}': ${asMessage(error)}`)
    }
  }

  /** Retry terminal Session archival on startup before bounded run pruning. */
  private async archiveTerminalRunSessions(): Promise<void> {
    for (const [, run] of this.runs.entries()) await this.archiveRunSession(run)
  }

  /** Keep every active record plus the configured newest terminal records per automation. */
  private async pruneWorkspaceHistory(workspaceId: string): Promise<void> {
    const terminalByAutomation = new Map<string, AutomationRun[]>()
    for (const run of [...this.runs.entries()]
      .map(([, run]) => run)
      .filter(run => run.targetSnapshot.workspaceId === workspaceId
        && run.status !== 'queued' && run.status !== 'running')
    ) {
      const existing = terminalByAutomation.get(run.automationId) ?? []
      existing.push(run)
      terminalByAutomation.set(run.automationId, existing)
    }
    for (const terminal of terminalByAutomation.values()) {
      terminal.sort(compareRuns)
      for (const run of terminal.slice(this.config.historyLimit)) await this.runs.delete(run.id)
    }
  }

  private async pruneAllHistory(): Promise<void> {
    const workspaces = new Set(
      [...this.runs.entries()].map(([, run]) => run.targetSnapshot.workspaceId),
    )
    for (const workspaceId of workspaces) await this.pruneWorkspaceHistory(workspaceId)
  }
}

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
import { executeAutomationRun, unattendedToolNames } from './executor.ts'
import {
  legacyAutomationDomainSpec,
  type LegacyDefinition,
  type LegacyMigrationSummary,
  type LegacyRun,
} from './legacy.ts'
import { latestDueOccurrence, nextOccurrence } from './recurrence.ts'
import type {
  AutomationDefinition,
  AutomationLifecycleEvent,
  AutomationLifecycleKind,
  AutomationCommandReceipt,
  AutomationCommandName,
  AutomationModelSelection,
  ModelPolicy,
  AutomationRun,
  AutomationRunPhase,
  AutomationSchedule,
  PermissionPreset,
  StoredAutomationCommandReceipt,
  UpdateAutomationInput,
} from './types.ts'

const MAX_TIMER_DELAY_MS = 2_147_483_647
const RUN_LEASE_MS = 30_000
const RUN_HEARTBEAT_MS = 10_000
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
  readonly modelPolicy?: ModelPolicy
  readonly runTimeoutMinutes?: number
}

type UpdateRequest = Omit<UpdateAutomationInput, 'now'> & {
  readonly status?: 'active' | 'paused'
  readonly expectedRevision?: number
}

export type AutomationCommand =
  | { readonly kind: 'create'; readonly requestId: string; readonly input: CreateRequest }
  | { readonly kind: 'update'; readonly requestId: string; readonly automationId: string; readonly input: UpdateRequest }
  | { readonly kind: 'pause' | 'resume' | 'delete' | 'run-now'; readonly requestId: string; readonly automationId: string }
  | { readonly kind: 'cancel-run' | 'mark-read'; readonly requestId: string; readonly runId: string }

export type AutomationScope =
  | { readonly sessionId: string; readonly creatorKind: 'agent' }
  | { readonly workspaceId?: string; readonly creatorKind: 'web' }

export interface AutomationSnapshot {
  readonly generatedAt: string
  readonly filterWorkspaceId?: string
  readonly workspaces: readonly { readonly id: string; readonly title: string; readonly path: string }[]
  readonly presets: readonly { readonly id: string; readonly name: string; readonly broken: boolean }[]
  readonly defaultModel: AutomationModelSelection
  readonly models: readonly AutomationModelOption[]
  readonly definitions: readonly AutomationDefinitionView[]
  readonly runs: readonly AutomationRunView[]
  readonly migration: LegacyMigrationSummary
}

export interface AutomationDefinitionView extends AutomationDefinition {
  readonly nextRunAt: string | null
  readonly lastRun: AutomationRun | null
  readonly health: AutomationHealth
}

export interface AutomationModelOption extends AutomationModelSelection {
  readonly providerName: string
  readonly modelName: string
  readonly reasoningEfforts: readonly { readonly id: string; readonly name: string }[]
}

export interface AutomationHealth {
  readonly status: 'ready' | 'blocked' | 'overdue' | 'stalled'
  readonly issues: readonly { readonly code: string; readonly message: string }[]
  readonly effectiveModel: AutomationModelSelection | null
  readonly expectedAt: string | null
  readonly admittedAt: string | null
  readonly claimedAt: string | null
  readonly lastProgressAt: string | null
  readonly overdueByMs: number
  readonly queueWaitMs: number | null
  readonly admissionStatus: 'not_due' | 'not_admitted' | 'queued' | 'running' | 'terminal'
}

interface TargetHealth {
  readonly status: 'ready' | 'blocked'
  readonly issues: readonly { readonly code: string; readonly message: string }[]
  readonly effectiveModel: AutomationModelSelection | null
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
  private receipts!: KvTable<string, StoredAutomationCommandReceipt>
  private timer: ReturnType<typeof setTimeout> | undefined
  private operationTail: Promise<void> = Promise.resolve()
  private commandTail: Promise<void> = Promise.resolve()
  private pumpScheduled = false
  private requested = false
  private started = false
  private stopping = false
  private readonly ownerId = `automation-host-${randomUUID()}`
  private readonly active = new Map<string, { readonly abort: AbortController; readonly promise: Promise<void> }>()
  private migration: LegacyMigrationSummary = {
    detectedDefinitions: 0,
    detectedRuns: 0,
    importedDefinitions: 0,
    importedRuns: 0,
    plannedDefinitions: 0,
    plannedRuns: 0,
    skippedDeletedDefinitions: 0,
    sourceFingerprint: createHash('sha256').update('[]').digest('hex'),
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
      service.receipts = domain.table('receipts') as KvTable<string, StoredAutomationCommandReceipt>
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
    await this.commandTail.catch(() => {})
    for (const { abort } of this.active.values()) abort.abort({ code: 'host_stopping' })
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
      const defaultModel = this.defaultModelSelection()
      const models = await this.modelCatalog(signal)
      const targetHealth = new Map(await Promise.all(definitions.map(async definition => (
        [definition.id, await this.preflightTarget(definition, signal)] as const
      ))))
      return {
        generatedAt,
        ...(selectedWorkspaceId === undefined ? {} : { filterWorkspaceId: selectedWorkspaceId }),
        workspaces,
        presets,
        defaultModel,
        models,
        definitions: definitions.map((definition) => ({
          ...definition,
          nextRunAt: definition.status === 'active' ? nextOccurrence(definition.schedule, generatedAt) : null,
          lastRun: workspaceRuns.find(run => run.automationId === definition.id) ?? null,
          health: this.deriveAutomationHealth(
            definition,
            workspaceRuns.filter(run => run.automationId === definition.id),
            targetHealth.get(definition.id) ?? {
            status: 'blocked', issues: [{ code: 'preflight_unavailable', message: 'Preflight did not complete.' }], effectiveModel: null,
            },
            generatedAt,
          ),
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
      const agentPreset = request.agentPreset
        ?? (resolved.agent === undefined ? undefined : this.ctx.agentPresets.composedPreset(resolved.agent.ctx))
        ?? resolved.agent?.session.header.agentPreset
        ?? this.ctx.agentPresets.defaultId
      const resolvedPreset = await this.ctx.agentPresets.resolve(agentPreset)
      if (resolvedPreset.broken !== undefined) throw new Error(`Agent preset '${agentPreset}' is unavailable.`)
      const modelPolicy = request.modelPolicy ?? { mode: 'inherit' as const }
      await this.validateModelPolicy(modelPolicy, signal)
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
        modelPolicy,
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
    input: UpdateRequest,
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
      if (fields.modelPolicy !== undefined) await this.validateModelPolicy(fields.modelPolicy, signal)
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

  async runNow(scope: AutomationScope, id: string, signal?: AbortSignal, requestId?: string): Promise<AutomationRun> {
    const run = await this.serialize(async () => {
      const definition = await this.ownedDefinition(scope, id)
      throwIfCancelled(signal)
      const value = createManualRun(definition, toIso(), requestId)
      const existing = this.runs.get(value.id)
      if (existing !== undefined) return existing
      const alreadyActive = [...this.runs.entries()].some(([, candidate]) => (
        candidate.automationId === id
        && (candidate.status === 'queued' || candidate.status === 'running')
      ))
      if (alreadyActive) throw new Error('The automation already has a queued or running run.')
      return this.commitRun(value, 'admitted')
    }, signal)
    this.requestPump()
    return run
  }

  async dispatch(
    scope: AutomationScope,
    command: AutomationCommand,
    signal?: AbortSignal,
  ): Promise<AutomationCommandReceipt> {
    if (this.stopping) throw new Error('The automation service is stopping.')
    const result = this.commandTail.then(async (): Promise<AutomationCommandReceipt> => {
      throwIfCancelled(signal)
      const requestId = command.requestId.trim()
      if (requestId === '') throw new Error('requestId must not be blank')
      const scopeKey = scope.creatorKind === 'agent'
        ? `agent:${scope.sessionId}`
        : `web:${scope.workspaceId ?? '*'}`
      const fingerprint = createHash('sha256').update(JSON.stringify(command)).digest('hex')
      const receiptKey = createHash('sha256').update(`${scopeKey}:${requestId}`).digest('hex')
      const existing = this.receipts.get(receiptKey)
      if (existing !== undefined) {
        if (existing.fingerprint !== fingerprint) {
          return {
            requestId,
            command: command.kind,
            outcome: 'rejected',
            appliedAt: existing.appliedAt,
            replayed: true,
            error: { code: 'request_id_reused', message: 'The request id was already used for a different command.' },
          }
        }
        const { fingerprint: _fingerprint, scopeKey: _scopeKey, ...stored } = existing
        return { ...stored, replayed: true }
      }

      // Preserve the durable target before the mutation. A Host stop after a
      // legacy Definition delete but before the final Receipt must still keep
      // the source record tombstoned on the next open.
      let entityId = command.kind === 'delete' ? command.automationId : undefined
      // Reserve the id before applying the mutation. If the Host stops after
      // the write but before the final receipt, a replay returns `unknown`
      // and reconciles from storage instead of applying the command twice.
      const provisional: StoredAutomationCommandReceipt = {
        requestId,
        command: command.kind,
        outcome: 'unknown',
        ...(entityId === undefined ? {} : { entityId }),
        appliedAt: toIso(),
        error: {
          code: 'result_unknown',
          message: 'The command was admitted but its final outcome has not been recorded.',
        },
        scopeKey,
        fingerprint,
      }
      await this.receipts.put(receiptKey, provisional)

      let revision: number | undefined
      let outcome: AutomationCommandReceipt['outcome'] = 'committed'
      let error: AutomationCommandReceipt['error']
      try {
        const applied = await this.applyCommand(scope, command, signal)
        entityId = applied.entityId
        revision = applied.revision
      } catch (cause: unknown) {
        outcome = signal?.aborted === true ? 'unknown' : 'rejected'
        error = {
          code: signal?.aborted === true ? 'result_unknown' : this.commandErrorCode(cause),
          message: asMessage(cause),
        }
      }
      const stored: StoredAutomationCommandReceipt = {
        requestId,
        command: command.kind,
        outcome,
        ...(entityId === undefined ? {} : { entityId }),
        ...(revision === undefined ? {} : { revision }),
        appliedAt: toIso(),
        ...(error === undefined ? {} : { error }),
        scopeKey,
        fingerprint,
      }
      await this.receipts.put(receiptKey, stored)
      const { fingerprint: _fingerprint, scopeKey: _scopeKey, ...receipt } = stored
      return { ...receipt, replayed: false }
    })
    this.commandTail = result.then(() => {}, () => {})
    return result
  }

  private async applyCommand(
    scope: AutomationScope,
    command: AutomationCommand,
    signal?: AbortSignal,
  ): Promise<{ readonly entityId: string; readonly revision?: number }> {
    switch (command.kind) {
      case 'create': {
        const value = await this.create(scope, { ...command.input, clientRequestId: command.requestId }, signal)
        return { entityId: value.id, revision: value.revision }
      }
      case 'update': {
        const value = await this.update(scope, command.automationId, command.input, signal)
        return { entityId: value.id, revision: value.revision }
      }
      case 'pause':
      case 'resume': {
        const value = await this.update(scope, command.automationId, {
          status: command.kind === 'pause' ? 'paused' : 'active',
        }, signal)
        return { entityId: value.id, revision: value.revision }
      }
      case 'delete': {
        const value = await this.delete(scope, command.automationId, signal)
        return { entityId: value.id }
      }
      case 'run-now': {
        const value = await this.runNow(scope, command.automationId, signal, command.requestId)
        return { entityId: value.id }
      }
      case 'cancel-run': {
        const value = await this.cancelRun(scope, command.runId, signal)
        return { entityId: value.id }
      }
      case 'mark-read': {
        const value = await this.markRead(scope, command.runId, signal)
        return { entityId: value.id }
      }
    }
  }

  private commandErrorCode(error: unknown): string {
    const message = asMessage(error)
    if (/changed since it was opened/.test(message)) return 'revision_conflict'
    if (/unknown automation run/.test(message)) return 'run_not_found'
    if (/unknown automation/.test(message)) return 'automation_not_found'
    if (/workspace/i.test(message)) return 'workspace_unavailable'
    if (/preset/i.test(message)) return 'preset_unavailable'
    if (/(provider|model|reasoning)/i.test(message)) return 'model_unavailable'
    if (/permission/i.test(message)) return 'permission_denied'
    if (/queued or running/.test(message)) return 'already_running'
    return 'invalid_command'
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
      return this.commitRun(next, 'attention')
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
        this.active.get(runId)?.abort.abort({ code: 'cancelled' })
        return run
      }
      const cancelled: AutomationRun = {
        ...run,
        status: 'cancelled',
        finishedAt: toIso(),
        error: { code: 'cancelled', message: 'The automation was cancelled before it started.' },
        outcome: 'cancelled',
        attention: 'none',
        unread: false,
      }
      return this.commitRun(cancelled, 'terminal')
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

  private async validateModelPolicy(policy: ModelPolicy, signal?: AbortSignal): Promise<void> {
    if (policy.mode === 'inherit') return
    throwIfCancelled(signal)
    const llm = this.llmRuntime()
    if (llm === undefined) throw new Error('The selected model is unavailable because the LLM catalog is not mounted.')
    let info: Awaited<ReturnType<typeof llm.resolveModelInfo>>
    try {
      info = await llm.resolveModelInfo(policy.provider, policy.model, signal)
    } catch (error: unknown) {
      if (signal?.aborted === true) throw error
      throw new Error(`The selected model '${policy.provider}/${policy.model}' is unavailable: ${asMessage(error)}`)
    }
    if (policy.reasoningEffort !== undefined
      && !info.reasoning?.efforts.some(effort => String(effort.id) === policy.reasoningEffort)) {
      throw new Error(
        `Reasoning effort '${policy.reasoningEffort}' is unavailable for '${policy.provider}/${policy.model}'.`,
      )
    }
  }

  private defaultModelSelection(): AutomationModelSelection {
    const selection = this.ctx.agentDefaultModel.currentSelection()
    return {
      provider: selection.provider,
      model: selection.model,
      ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: String(selection.reasoningEffort) }),
    }
  }

  private llmRuntime(): {
    listProviders(): readonly { readonly id: string; readonly name: string }[]
    listModels(provider: string): Promise<readonly { readonly provider: string; readonly id: string; readonly name: string }[]>
    resolveModelInfo(provider: string, model: string, signal?: AbortSignal): Promise<{
      readonly reasoning?: {
        readonly efforts: readonly { readonly id: string; readonly name?: string }[]
        readonly defaultEffort?: string
      }
    }>
  } | undefined {
    return (this.ctx as Context & { readonly llm?: ReturnType<AutomationService['llmRuntime']> }).llm
  }

  private async modelCatalog(signal?: AbortSignal): Promise<readonly AutomationModelOption[]> {
    const llm = this.llmRuntime()
    const fallback = this.defaultModelSelection()
    if (llm === undefined) {
      return [{ ...fallback, providerName: fallback.provider, modelName: fallback.model, reasoningEfforts: [] }]
    }
    const values: AutomationModelOption[] = []
    for (const provider of llm.listProviders()) {
      throwIfCancelled(signal)
      let models: readonly { readonly provider: string; readonly id: string; readonly name: string }[] = []
      try { models = await llm.listModels(provider.id) } catch (error: unknown) {
        if (signal?.aborted === true) throw error
        continue
      }
      for (const model of models) {
        throwIfCancelled(signal)
        let reasoningEfforts: readonly { readonly id: string; readonly name: string }[] = []
        try {
          const resolved = await llm.resolveModelInfo(provider.id, model.id, signal)
          reasoningEfforts = resolved.reasoning?.efforts.map(effort => ({
            id: String(effort.id), name: effort.name ?? String(effort.id),
          })) ?? []
        } catch (error: unknown) {
          if (signal?.aborted === true) throw error
          // The catalog is advisory. Preflight reports exact-route failures.
        }
        values.push({
          provider: provider.id,
          providerName: provider.name,
          model: model.id,
          modelName: model.name,
          reasoningEfforts,
        })
      }
    }
    if (!values.some(value => value.provider === fallback.provider && value.model === fallback.model)) {
      values.unshift({
        ...fallback, providerName: fallback.provider, modelName: fallback.model, reasoningEfforts: [],
      })
    }
    return values
  }

  private async preflightTarget(
    target: Pick<AutomationDefinition, 'workspaceId' | 'cwd' | 'agentPreset' | 'modelPolicy'>,
    signal?: AbortSignal,
  ): Promise<TargetHealth> {
    const issues: Array<{ readonly code: string; readonly message: string }> = []
    const workspace = this.ctx.workspaceRegistry.get(WorkspaceId(target.workspaceId))
    if (workspace === undefined) {
      issues.push({ code: 'workspace_not_found', message: 'The target workspace is not registered.' })
    } else {
      try {
        if (workspace.path !== target.cwd || await workspace.status() !== 'ok') {
          issues.push({ code: 'workspace_unavailable', message: 'The target workspace directory is unavailable or changed.' })
        }
      } catch (error: unknown) {
        if (signal?.aborted === true) throw error
        issues.push({ code: 'workspace_unavailable', message: `The target workspace could not be checked: ${asMessage(error)}` })
      }
    }
    throwIfCancelled(signal)
    try {
      const preset = await this.ctx.agentPresets.resolve(target.agentPreset)
      if (preset.broken !== undefined) {
        issues.push({ code: 'preset_unavailable', message: `Agent preset '${target.agentPreset}' is unavailable.` })
      }
    } catch (error: unknown) {
      if (signal?.aborted === true) throw error
      issues.push({ code: 'preset_unavailable', message: asMessage(error) })
    }
    const effectiveModel = target.modelPolicy.mode === 'pinned'
      ? {
          provider: target.modelPolicy.provider,
          model: target.modelPolicy.model,
          ...(target.modelPolicy.reasoningEffort === undefined
            ? {}
            : { reasoningEffort: target.modelPolicy.reasoningEffort }),
        }
      : this.defaultModelSelection()
    try {
      await this.validateModelPolicy({
        mode: 'pinned',
        provider: effectiveModel.provider,
        model: effectiveModel.model,
        ...(effectiveModel.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: effectiveModel.reasoningEffort }),
      }, signal)
    } catch (error: unknown) {
      if (signal?.aborted === true) throw error
      issues.push({ code: 'model_unavailable', message: asMessage(error) })
    }
    return { status: issues.length === 0 ? 'ready' : 'blocked', issues, effectiveModel }
  }

  /** Derive scheduler health from the existing Definition and Run facts. */
  private deriveAutomationHealth(
    definition: AutomationDefinition,
    relatedRuns: readonly AutomationRun[],
    target: TargetHealth,
    now: string,
  ): AutomationHealth {
    const expectedCandidate = definition.status === 'active'
      ? latestDueOccurrence(definition.schedule, now)
      : null
    const expectedAt = expectedCandidate !== null
      && Date.parse(expectedCandidate) > Date.parse(definition.updatedAt)
      ? expectedCandidate
      : null
    const expectedRun = expectedAt === null ? undefined : relatedRuns.find(run => (
      run.trigger === 'schedule' && run.scheduledFor === expectedAt
    ))
    const latestRun = [...relatedRuns].sort(compareRuns)[0]
    const progressRun = expectedRun ?? latestRun
    const lastProgressAt = progressRun === undefined
      ? null
      : progressRun.finishedAt
        ?? progressRun.lease?.heartbeatAt
        ?? progressRun.startedAt
        ?? progressRun.admittedAt
    const admissionStatus: AutomationHealth['admissionStatus'] = expectedAt === null
      ? 'not_due'
      : expectedRun === undefined
        ? 'not_admitted'
        : expectedRun.status === 'queued'
          ? 'queued'
          : expectedRun.status === 'running'
            ? 'running'
            : 'terminal'
    const overdueThresholdMs = Math.max(60_000, Math.min(5 * 60_000, this.config.misfireGraceMs || 60_000))
    const overdueByMs = expectedAt === null || expectedRun !== undefined
      ? 0
      : Math.max(0, Date.parse(now) - Date.parse(expectedAt))
    const staleByMs = progressRun?.status === 'running' && lastProgressAt !== null
      ? Math.max(0, Date.parse(now) - Date.parse(lastProgressAt))
      : 0
    const queueWaitMs = progressRun === undefined
      ? null
      : Math.max(0, Date.parse(progressRun.startedAt ?? now) - Date.parse(progressRun.admittedAt))
    if (target.status === 'blocked') {
      return {
        ...target, expectedAt, admittedAt: expectedRun?.admittedAt ?? null,
        claimedAt: expectedRun?.startedAt ?? null, lastProgressAt, overdueByMs, queueWaitMs, admissionStatus,
      }
    }
    if (overdueByMs > overdueThresholdMs) {
      return {
        ...target,
        status: 'overdue',
        issues: [{
          code: 'occurrence_overdue',
          message: `The occurrence expected at ${expectedAt} has not been admitted.`,
        }],
        expectedAt, admittedAt: null, claimedAt: null, lastProgressAt,
        overdueByMs, queueWaitMs: null, admissionStatus,
      }
    }
    if (progressRun?.status === 'queued' && queueWaitMs !== null && queueWaitMs > overdueThresholdMs) {
      return {
        ...target,
        status: 'stalled',
        issues: [{
          code: 'queue_stalled',
          message: `The admitted run has waited ${Math.round(queueWaitMs / 1_000)} seconds without being claimed.`,
        }],
        expectedAt, admittedAt: progressRun.admittedAt, claimedAt: null,
        lastProgressAt, overdueByMs: queueWaitMs, queueWaitMs, admissionStatus,
      }
    }
    if (progressRun?.status === 'running' && staleByMs > RUN_LEASE_MS) {
      return {
        ...target,
        status: 'stalled',
        issues: [{
          code: 'run_stalled',
          message: `The run has made no durable progress since ${lastProgressAt}.`,
        }],
        expectedAt, admittedAt: progressRun.admittedAt, claimedAt: progressRun.startedAt,
        lastProgressAt, overdueByMs: staleByMs, queueWaitMs, admissionStatus,
      }
    }
    return {
      ...target, expectedAt, admittedAt: expectedRun?.admittedAt ?? null,
      claimedAt: expectedRun?.startedAt ?? null, lastProgressAt,
      overdueByMs: 0, queueWaitMs, admissionStatus,
    }
  }

  /** Import the old plugin's v1 domain without ever mutating or deleting it. */
  private async importLegacyData(): Promise<LegacyMigrationSummary> {
    const legacy = await this.ctx.storageDomain.open(legacyAutomationDomainSpec)
    try {
      const oldDefinitions = legacy.table('definitions') as KvTable<string, LegacyDefinition>
      const oldRuns = legacy.table('runs') as KvTable<string, LegacyRun>
      const definitionsToImport: Array<readonly [string, AutomationDefinition]> = []
      const runsToImport: Array<readonly [string, AutomationRun]> = []
      let skippedDeletedDefinitions = 0
      const defaultTimeout = Math.max(1, Math.round(this.config.runTimeoutMs / 60_000))
      for (const [id, old] of oldDefinitions.entries()) {
        if (this.hasLegacyDeleteTombstone(id)) {
          skippedDeletedDefinitions += 1
          continue
        }
        const modelPolicy = old.provider !== null && old.model !== null
          ? { mode: 'pinned' as const, provider: old.provider, model: old.model }
          : { mode: 'inherit' as const }
        const converted: AutomationDefinition = { ...old, modelPolicy, runTimeoutMinutes: defaultTimeout }
        const existing = this.definitions.get(id)
        if (existing !== undefined) {
          if (JSON.stringify(existing) !== JSON.stringify(converted)) {
            throw new Error(`legacy migration conflict for definition '${id}'`)
          }
          continue
        }
        definitionsToImport.push([id, converted])
      }
      for (const [id, old] of oldRuns.entries()) {
        const modelPolicy = old.targetSnapshot.provider !== null && old.targetSnapshot.model !== null
          ? { mode: 'pinned' as const, provider: old.targetSnapshot.provider, model: old.targetSnapshot.model }
          : { mode: 'inherit' as const }
        const converted: AutomationRun = {
          ...old,
          admittedAt: old.scheduledFor,
          attempt: 1,
          sequence: 0,
          outcome: old.status === 'queued' || old.status === 'running'
            ? 'pending'
            : old.status === 'succeeded'
              ? 'succeeded'
              : old.status === 'failed'
                ? 'failed'
                : old.status === 'cancelled'
                  ? 'cancelled'
                  : 'skipped',
          attention: old.status === 'failed'
            ? 'failed'
            : old.status === 'skipped'
              ? 'review'
              : 'none',
          effect: {
            status: 'none',
            updatedAt: old.finishedAt ?? old.startedAt ?? old.scheduledFor,
          },
          effectiveContext: null,
          targetSnapshot: { ...old.targetSnapshot, modelPolicy, runTimeoutMinutes: defaultTimeout },
          phase: old.status === 'queued' ? 'claim' : old.status === 'running' ? 'executing' : null,
          lease: null,
          effectiveModel: null,
        }
        const existing = this.runs.get(id)
        if (existing !== undefined) {
          if (JSON.stringify(existing) !== JSON.stringify(converted)) {
            throw new Error(`legacy migration conflict for run '${id}'`)
          }
          continue
        }
        runsToImport.push([id, converted])
      }
      // The loops above are a dry run: every conversion and conflict is
      // validated before the first destination write.
      for (const [id, converted] of definitionsToImport) await this.definitions.put(id, converted)
      for (const [id, converted] of runsToImport) await this.runs.put(id, converted)
      const sourceFingerprint = createHash('sha256').update(JSON.stringify({
        definitions: [...oldDefinitions.keys()].sort(),
        runs: [...oldRuns.keys()].sort(),
      })).digest('hex')
      return {
        detectedDefinitions: oldDefinitions.size,
        detectedRuns: oldRuns.size,
        importedDefinitions: definitionsToImport.length,
        importedRuns: runsToImport.length,
        plannedDefinitions: definitionsToImport.length,
        plannedRuns: runsToImport.length,
        skippedDeletedDefinitions,
        sourceFingerprint,
      }
    } finally {
      await legacy.close()
    }
  }

  /** A committed or ambiguous delete wins over the immutable legacy source. */
  private hasLegacyDeleteTombstone(automationId: string): boolean {
    return [...this.receipts.entries()].some(([, receipt]) => (
      receipt.command === 'delete'
      && receipt.entityId === automationId
      && (receipt.outcome === 'committed' || receipt.outcome === 'unknown')
    ))
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
    const candidate = { ...createScheduledRun(definition, scheduledFor), admittedAt: now }
    if (this.runs.get(candidate.id) !== undefined) return
    const overlapping = related.some(run => run.status === 'queued' || run.status === 'running')
    const age = Date.parse(now) - Date.parse(scheduledFor)
    if (overlapping || age > this.config.misfireGraceMs) {
      const reason = overlapping
        ? { code: 'overlap', message: 'Skipped because the previous run is still active.' }
        : { code: 'misfire', message: 'Skipped because the host resumed outside the catch-up window.' }
      await this.commitRun({
        ...candidate,
        status: 'skipped',
        finishedAt: now,
        error: reason,
        outcome: 'skipped',
        attention: 'review',
      }, 'terminal')
      await this.pruneWorkspaceHistory(candidate.targetSnapshot.workspaceId)
      return
    }
    await this.commitRun(candidate, 'admitted')
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
    const deadline = setTimeout(() => {
      abort.abort({ code: 'run_timeout' })
    }, Math.max(1, run.targetSnapshot.runTimeoutMinutes * 60_000))
    deadline.unref?.()
    const heartbeat = setInterval(() => {
      void this.refreshRunLease(run.id).catch((error: unknown) => {
        if (!this.stopping) this.ctx.logger.warn(`dsh-automation: heartbeat failed for run '${run.id}': ${asMessage(error)}`)
      })
    }, RUN_HEARTBEAT_MS)
    heartbeat.unref?.()
    const promise = this.executeRun(run, abort.signal)
      .catch(async (error: unknown) => {
        this.ctx.logger.warn(`dsh-automation: run '${run.id}' failed outside its execution boundary: ${asMessage(error)}`)
        try {
          const current = this.runs.get(run.id)
          if (current !== undefined && (current.status === 'queued' || current.status === 'running')) {
            const abortReason = abort.signal.reason
            const abortCode = typeof abortReason === 'object' && abortReason !== null && 'code' in abortReason
              ? String((abortReason as { readonly code: unknown }).code)
              : undefined
            const timedOut = abortCode === 'run_timeout'
            const cancelled = abortCode === 'cancelled' || abortCode === 'host_stopping'
            const failed: AutomationRun = {
              ...current,
              status: cancelled ? 'cancelled' : 'failed',
              phase: null,
              lease: null,
              finishedAt: toIso(),
              error: timedOut
                ? { code: 'run_timeout', message: 'The automation exceeded its whole-job time limit.' }
                : cancelled
                  ? { code: 'cancelled', message: 'The automation was cancelled before it completed.' }
                  : { code: 'persistence_error', message: 'The run could not persist its execution state.' },
              outcome: cancelled ? 'cancelled' : 'failed',
              attention: current.effect.status === 'none' ? (cancelled ? 'review' : 'failed') : 'unknown',
              effect: current.effect.status === 'none'
                ? current.effect
                : { ...current.effect, status: 'unknown', updatedAt: toIso() },
              unread: true,
            }
            await this.commitRun(failed, 'terminal')
            await this.archiveRunSession(failed)
            await this.pruneWorkspaceHistory(current.targetSnapshot.workspaceId)
          }
        } catch (recordError: unknown) {
          this.ctx.logger.warn(`dsh-automation: could not persist failure for run '${run.id}': ${asMessage(recordError)}`)
        }
      })
      .finally(() => {
        clearTimeout(deadline)
        clearInterval(heartbeat)
        this.active.delete(run.id)
        this.requestPump()
      })
    this.active.set(run.id, { abort, promise })
  }

  private async executeRun(run: AutomationRun, signal: AbortSignal): Promise<void> {
    const definition = this.definitions.get(run.automationId)
    if (definition === undefined) {
      await this.commitRun({
        ...run,
        status: 'failed',
        finishedAt: toIso(),
        error: { code: 'definition_deleted', message: 'The automation was deleted before this run started.' },
        outcome: 'failed',
        attention: 'failed',
      }, 'terminal')
      await this.pruneWorkspaceHistory(run.targetSnapshot.workspaceId)
      return
    }
    const health = await this.preflightTarget({
      workspaceId: run.targetSnapshot.workspaceId,
      cwd: run.targetSnapshot.cwd,
      agentPreset: run.targetSnapshot.agentPreset,
      modelPolicy: run.targetSnapshot.modelPolicy,
    }, signal)
    if (health.status === 'blocked') {
      const issue = health.issues[0] ?? {
        code: 'preflight_failed', message: 'The automation target failed preflight.',
      }
      await this.commitRun({
        ...run,
        status: 'failed',
        phase: null,
        lease: null,
        finishedAt: toIso(),
        effectiveModel: health.effectiveModel,
        error: issue,
        outcome: 'blocked',
        attention: 'blocked',
        unread: true,
      }, 'terminal')
      await this.pruneWorkspaceHistory(run.targetSnapshot.workspaceId)
      return
    }
    const startedAt = toIso()
    // The durable identity lives in the SessionId itself. This remains true
    // even if Agent creation fails before the first automation-sourced message
    // is appended and after bounded run history has pruned the owning row.
    const sessionId = `${AUTOMATION_SESSION_PREFIX}${randomUUID()}`
    const running: AutomationRun = {
      ...run,
      status: 'running',
      phase: 'setup',
      lease: this.newLease(startedAt, false),
      startedAt,
      sessionId,
      effectiveContext: {
        actor: {
          kind: 'automation',
          sourceKind: definition.createdBy.kind,
          sourceId: definition.createdBy.sessionId,
        },
        permissionPreset: run.targetSnapshot.permissionPreset,
        agentPreset: run.targetSnapshot.agentPreset,
        tools: unattendedToolNames(),
        approvalPolicy: 'never',
        backgroundProcesses: false,
        capturedAt: startedAt,
      },
    }
    await this.commitRun(running, 'phase')
    const completion = await executeAutomationRun(this.ctx, definition, run, {
      runTimeoutMs: run.targetSnapshot.runTimeoutMinutes * 60_000,
      sessionId,
      signal,
      onPhase: async (phase, sideEffectsPossible) => {
        await this.persistRunPhase(run.id, phase, sideEffectsPossible)
      },
    })
    await this.persistRunPhase(run.id, 'delivery', true)
    const abortReason = signal.reason
    const timedOut = signal.aborted === true
      && typeof abortReason === 'object' && abortReason !== null && 'code' in abortReason
      && String((abortReason as { readonly code: unknown }).code) === 'run_timeout'
    const delivering = this.runs.get(run.id) ?? running
    const finishedAt = toIso()
    const terminalOutcome = timedOut
      ? 'failed'
      : completion.outcome
        ?? (completion.status === 'cancelled' ? 'cancelled' : completion.status === 'failed' ? 'failed' : 'unknown')
    const terminalAttention = completion.cleanupIncomplete === true
      ? 'unknown'
      : timedOut
      ? (delivering.effect.status === 'none' ? 'failed' : 'unknown')
      : completion.attention
        ?? (completion.status === 'cancelled'
          ? (delivering.effect.status === 'none' ? 'review' : 'unknown')
          : completion.status === 'failed'
            ? (delivering.effect.status === 'none' ? 'failed' : 'unknown')
            : 'unknown')
    const terminalStatus = completion.status === 'succeeded' && terminalOutcome === 'blocked'
      ? 'failed'
      : timedOut ? 'failed' : completion.status
    const completed: AutomationRun = {
      ...delivering,
      status: terminalStatus,
      phase: null,
      lease: null,
      sessionId: completion.sessionId ?? null,
      finishedAt,
      summary: completion.summary ?? null,
      error: timedOut
        ? { code: 'run_timeout', message: 'The automation exceeded its whole-job time limit.' }
        : terminalOutcome === 'blocked'
          ? { code: 'task_blocked', message: 'The automation reported that it could not proceed.' }
          : completion.error ?? null,
      outcome: terminalOutcome,
      attention: terminalAttention,
      effect: completion.cleanupIncomplete !== true && delivering.effect.status === 'none'
        ? delivering.effect
        : {
            ...delivering.effect,
            status: completion.cleanupIncomplete === true || timedOut || completion.status !== 'succeeded'
              ? 'unknown'
              : 'completed',
            updatedAt: finishedAt,
          },
      unread: terminalAttention !== 'none',
      effectiveModel: completion.effectiveModel ?? null,
    }
    await this.commitRun(completed, 'terminal')
    await this.archiveRunSession(completed)
    await this.pruneWorkspaceHistory(run.targetSnapshot.workspaceId)
  }

  private newLease(now: string, sideEffectsPossible: boolean) {
    return {
      ownerId: this.ownerId,
      acquiredAt: now,
      heartbeatAt: now,
      expiresAt: toIso(Date.parse(now) + RUN_LEASE_MS),
      sideEffectsPossible,
    }
  }

  /** Persist one monotonic lifecycle revision, then publish a catch-up-safe event. */
  private async commitRun(run: AutomationRun, kind: AutomationLifecycleKind): Promise<AutomationRun> {
    const current = this.runs.get(run.id)
    const stored: AutomationRun = {
      ...run,
      sequence: Math.max(run.sequence, current?.sequence ?? -1) + 1,
    }
    await this.runs.put(stored.id, stored)
    const event: AutomationLifecycleEvent = {
      kind,
      runId: stored.id,
      automationId: stored.automationId,
      definitionRevision: stored.definitionRevision,
      sequence: stored.sequence,
      at: stored.finishedAt ?? stored.lease?.heartbeatAt ?? stored.startedAt ?? stored.admittedAt,
      workspaceId: stored.targetSnapshot.workspaceId,
      status: stored.status,
      phase: stored.phase,
      outcome: stored.outcome,
      attention: stored.attention,
      sessionId: stored.sessionId,
    }
    try {
      this.ctx.emit?.('automation/lifecycle', event)
    } catch (error: unknown) {
      this.ctx.logger.warn(`dsh-automation: lifecycle consumer failed for run '${stored.id}': ${asMessage(error)}`)
    }
    return stored
  }

  private async persistRunPhase(
    runId: string,
    phase: AutomationRunPhase,
    sideEffectsPossible: boolean,
  ): Promise<void> {
    const current = this.runs.get(runId)
    if (current === undefined || current.status !== 'running') return
    const now = toIso()
    await this.commitRun({
      ...current,
      phase,
      lease: current.lease === null
        ? this.newLease(now, sideEffectsPossible)
        : {
            ...current.lease,
            heartbeatAt: now,
            expiresAt: toIso(Date.parse(now) + RUN_LEASE_MS),
            sideEffectsPossible: current.lease.sideEffectsPossible || sideEffectsPossible,
          },
      effect: sideEffectsPossible
        ? { ...current.effect, status: 'possible', updatedAt: now }
        : current.effect,
    }, 'phase')
  }

  private async refreshRunLease(runId: string): Promise<void> {
    const current = this.runs.get(runId)
    if (current?.status !== 'running' || current.lease?.ownerId !== this.ownerId) return
    const now = toIso()
    await this.runs.put(runId, {
      ...current,
      lease: { ...current.lease, heartbeatAt: now, expiresAt: toIso(Date.parse(now) + RUN_LEASE_MS) },
    })
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
      if (run.status === 'queued') {
        await this.runs.put(id, { ...run, phase: 'claim', lease: null })
        continue
      }
      if (run.status !== 'running') continue
      const safeToRetry = run.sessionId === null && run.lease?.sideEffectsPossible !== true
      if (safeToRetry) {
        await this.commitRun({
          ...run, status: 'queued', phase: 'claim', lease: null, startedAt: null, error: null,
          attempt: run.attempt + 1, outcome: 'pending', attention: 'none',
          effect: { status: 'none', updatedAt: finishedAt },
        }, 'reconciled')
        continue
      }
      await this.commitRun({
        ...run,
        status: 'interrupted',
        phase: null,
        lease: null,
        finishedAt,
        error: {
          code: 'host_interrupted',
          message: 'The DSH Host stopped after this run may have produced side effects; it was not retried.',
        },
        outcome: 'interrupted',
        attention: 'unknown',
        effect: run.effect.status === 'none' && run.lease?.sideEffectsPossible !== true
          ? run.effect
          : { ...run.effect, status: 'unknown', updatedAt: finishedAt },
        unread: true,
      }, 'reconciled')
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

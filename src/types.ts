export type AutomationStatus = 'active' | 'paused'
export type AutomationRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled' | 'interrupted'
export type AutomationRunPhase = 'claim' | 'setup' | 'executing' | 'settling' | 'delivery'
export type AutomationOutcome =
  | 'pending' | 'unknown' | 'no_change' | 'changes_ready' | 'needs_input' | 'succeeded'
  | 'failed' | 'blocked' | 'cancelled' | 'interrupted' | 'skipped' | 'partial'
export type AutomationAttention = 'none' | 'review' | 'needs_input' | 'failed' | 'blocked' | 'unknown'
export type AutomationLifecycleKind = 'admitted' | 'phase' | 'terminal' | 'attention' | 'reconciled'
export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'

export interface OnceSchedule {
  readonly kind: 'once'
  readonly at: string
  readonly timeZone: string
}

export interface IntervalSchedule {
  readonly kind: 'interval'
  readonly everyMinutes: number
  readonly anchor: string
  readonly timeZone: string
}

export interface DailySchedule {
  readonly kind: 'daily'
  readonly time: string
  readonly timeZone: string
}

export interface WeeklySchedule {
  readonly kind: 'weekly'
  readonly weekdays: readonly Weekday[]
  readonly time: string
  readonly timeZone: string
}

export type AutomationSchedule = OnceSchedule | IntervalSchedule | DailySchedule | WeeklySchedule
export type PermissionPreset = 'read-only' | 'workspace-write'
export type ReviewMode = 'direct' | 'worktree'

export interface InheritModelPolicy {
  readonly mode: 'inherit'
}

export interface PinnedModelPolicy {
  readonly mode: 'pinned'
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string | undefined
}

export type ModelPolicy = InheritModelPolicy | PinnedModelPolicy

export interface AutomationModelSelection {
  readonly provider: string
  readonly model: string
  readonly reasoningEffort?: string | undefined
}

export interface AutomationCreator {
  readonly kind: 'agent' | 'web'
  readonly sessionId: string
}

/** Durable provenance for the first message of one autonomous run. */
export interface AutomationMessageSource {
  readonly kind: 'automation'
  readonly automationId: string
  readonly runId: string
  readonly scheduledFor: string
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    automation: AutomationMessageSource
  }
}

export interface AutomationDefinition {
  readonly version: 1
  readonly id: string
  readonly revision: number
  readonly name: string
  readonly prompt: string
  readonly status: AutomationStatus
  readonly schedule: AutomationSchedule
  readonly rrule: string
  readonly timeZone: string
  readonly workspaceId: string
  readonly cwd: string
  readonly agentPreset: string
  readonly modelPolicy: ModelPolicy
  /** Compatibility projection for alpha.5 records and clients. */
  readonly provider: string | null
  readonly model: string | null
  readonly permissionPreset: PermissionPreset
  readonly reviewMode: ReviewMode
  readonly runTimeoutMinutes: number
  readonly createdBy: AutomationCreator
  readonly createdAt: string
  readonly updatedAt: string
}

export interface AutomationTargetSnapshot {
  readonly workspaceId: string
  readonly cwd: string
  readonly agentPreset: string
  readonly modelPolicy: ModelPolicy
  readonly provider: string | null
  readonly model: string | null
  readonly permissionPreset: PermissionPreset
  readonly reviewMode: ReviewMode
  readonly runTimeoutMinutes: number
}

export interface AutomationRunError {
  readonly code: string
  readonly message: string
}

export interface AutomationRunLease {
  readonly ownerId: string
  readonly acquiredAt: string
  readonly heartbeatAt: string
  readonly expiresAt: string
  readonly sideEffectsPossible: boolean
}

export interface AutomationEffectiveContext {
  readonly actor: {
    readonly kind: 'automation'
    readonly sourceKind: 'agent' | 'web'
    readonly sourceId: string
  }
  readonly permissionPreset: PermissionPreset
  readonly agentPreset: string
  readonly tools: readonly string[]
  readonly approvalPolicy: 'never'
  readonly backgroundProcesses: false
  readonly capturedAt: string
}

export interface AutomationReviewState {
  readonly mode: 'worktree'
  readonly status: 'ready' | 'kept' | 'accepted' | 'discarded' | 'failed'
  readonly baseSha: string
  readonly worktreePath: string
  readonly patchSha256: string | null
  readonly diffStat: string | null
  readonly error?: { readonly code: string; readonly message: string } | undefined
  /** Durable ownership of the isolated worktree until cleanup has settled. */
  readonly cleanup: {
    readonly status: 'owned' | 'settling' | 'released' | 'unknown'
    readonly action: 'accept' | 'discard' | null
    readonly updatedAt: string
  }
}

/** Stable, non-secret identity for replay, cache and lifecycle correlation. */
export interface AutomationRunIdentity {
  readonly automationId: string
  readonly definitionRevision: number
  readonly occurrenceKey: string
  readonly workspaceId: string
}

export interface AutomationRun {
  readonly version: 1
  readonly id: string
  readonly automationId: string
  readonly definitionRevision: number
  readonly occurrenceKey: string
  readonly trigger: 'schedule' | 'manual'
  readonly scheduledFor: string
  /** Durable admission time, distinct from the planned occurrence. */
  readonly admittedAt: string
  /** One-based execution attempt for this durable occurrence. */
  readonly attempt: number
  /** Monotonic lifecycle revision used by event consumers and snapshot catch-up. */
  readonly sequence: number
  readonly status: AutomationRunStatus
  readonly phase: AutomationRunPhase | null
  readonly lease: AutomationRunLease | null
  readonly promptSnapshot: string
  readonly targetSnapshot: AutomationTargetSnapshot
  readonly sessionId: string | null
  readonly startedAt: string | null
  readonly finishedAt: string | null
  readonly summary: string | null
  readonly error: AutomationRunError | null
  readonly outcome: AutomationOutcome
  readonly attention: AutomationAttention
  readonly effect: {
    readonly status: 'none' | 'possible' | 'completed' | 'unknown'
    readonly updatedAt: string
    readonly externalId?: string | undefined
  }
  readonly unread: boolean
  readonly effectiveModel: AutomationModelSelection | null
  readonly effectiveContext: AutomationEffectiveContext | null
  readonly review: AutomationReviewState | null
}

export interface AutomationLifecycleEvent {
  readonly kind: AutomationLifecycleKind
  readonly runId: string
  readonly automationId: string
  readonly definitionRevision: number
  readonly sequence: number
  readonly at: string
  readonly workspaceId: string
  readonly status: AutomationRunStatus
  readonly phase: AutomationRunPhase | null
  readonly outcome: AutomationOutcome
  readonly attention: AutomationAttention
  readonly sessionId: string | null
  readonly identity: AutomationRunIdentity
}

export interface CreateAutomationInput {
  readonly id: string
  readonly name: string
  readonly prompt: string
  readonly schedule: AutomationSchedule
  readonly workspaceId: string
  readonly cwd: string
  readonly agentPreset: string
  readonly modelPolicy?: ModelPolicy
  readonly provider?: string | null
  readonly model?: string | null
  readonly permissionPreset?: PermissionPreset
  readonly reviewMode?: ReviewMode
  readonly runTimeoutMinutes?: number
  readonly createdBy: AutomationCreator
  readonly now: string
}

export interface UpdateAutomationInput {
  readonly name?: string
  readonly prompt?: string
  readonly status?: AutomationStatus
  readonly schedule?: AutomationSchedule
  readonly agentPreset?: string
  readonly modelPolicy?: ModelPolicy
  readonly provider?: string | null
  readonly model?: string | null
  readonly permissionPreset?: PermissionPreset
  readonly reviewMode?: ReviewMode
  readonly runTimeoutMinutes?: number
  readonly now: string
}

export interface DeleteAutomationPlan {
  readonly id: string
  readonly preserveRunHistory: true
}

export type AutomationCommandName =
  | 'create'
  | 'update'
  | 'pause'
  | 'resume'
  | 'delete'
  | 'run-now'
  | 'cancel-run'
  | 'mark-read'
  | 'review-accept'
  | 'review-keep'
  | 'review-discard'

export interface AutomationCommandReceipt {
  readonly requestId: string
  readonly command: AutomationCommandName
  readonly outcome: 'committed' | 'rejected' | 'unknown'
  readonly entityId?: string | undefined
  readonly revision?: number | undefined
  readonly appliedAt: string
  readonly replayed: boolean
  readonly error?: AutomationRunError | undefined
}

export interface StoredAutomationCommandReceipt extends Omit<AutomationCommandReceipt, 'replayed'> {
  readonly scopeKey: string
  readonly fingerprint: string
}

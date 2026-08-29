/** Durable automation authority: definitions, occurrence claims, clock, and run execution. */
import type { Context } from '@deepseek-ai/cordis';
import { type LegacyMigrationSummary } from './legacy.ts';
import type { AutomationDefinition, AutomationCommandReceipt, AutomationModelSelection, ModelPolicy, AutomationRun, AutomationSchedule, PermissionPreset, UpdateAutomationInput } from './types.ts';
export declare const AUTOMATION_SESSION_PREFIX = "dsh-automation-session-";
export interface AutomationConfig {
    readonly maxConcurrentRuns: number;
    readonly runTimeoutMs: number;
    readonly misfireGraceMs: number;
    readonly historyLimit: number;
    readonly archiveRunSessions: boolean;
}
export interface CreateRequest {
    readonly clientRequestId?: string;
    readonly name: string;
    readonly prompt: string;
    readonly schedule: AutomationSchedule;
    readonly permissionPreset?: PermissionPreset;
    readonly agentPreset?: string;
    readonly modelPolicy?: ModelPolicy;
    readonly runTimeoutMinutes?: number;
}
type UpdateRequest = Omit<UpdateAutomationInput, 'now'> & {
    readonly status?: 'active' | 'paused';
    readonly expectedRevision?: number;
};
export type AutomationCommand = {
    readonly kind: 'create';
    readonly requestId: string;
    readonly input: CreateRequest;
} | {
    readonly kind: 'update';
    readonly requestId: string;
    readonly automationId: string;
    readonly input: UpdateRequest;
} | {
    readonly kind: 'pause' | 'resume' | 'delete' | 'run-now';
    readonly requestId: string;
    readonly automationId: string;
} | {
    readonly kind: 'cancel-run' | 'mark-read';
    readonly requestId: string;
    readonly runId: string;
};
export type AutomationScope = {
    readonly sessionId: string;
    readonly creatorKind: 'agent';
} | {
    readonly workspaceId?: string;
    readonly creatorKind: 'web';
};
export interface AutomationSnapshot {
    readonly generatedAt: string;
    readonly filterWorkspaceId?: string;
    readonly workspaces: readonly {
        readonly id: string;
        readonly title: string;
        readonly path: string;
    }[];
    readonly presets: readonly {
        readonly id: string;
        readonly name: string;
        readonly broken: boolean;
    }[];
    readonly defaultModel: AutomationModelSelection;
    readonly models: readonly AutomationModelOption[];
    readonly definitions: readonly AutomationDefinitionView[];
    readonly runs: readonly AutomationRunView[];
    readonly migration: LegacyMigrationSummary;
}
export interface AutomationDefinitionView extends AutomationDefinition {
    readonly nextRunAt: string | null;
    readonly lastRun: AutomationRun | null;
    readonly health: AutomationHealth;
}
export interface AutomationModelOption extends AutomationModelSelection {
    readonly providerName: string;
    readonly modelName: string;
    readonly reasoningEfforts: readonly {
        readonly id: string;
        readonly name: string;
    }[];
}
export interface AutomationHealth {
    readonly status: 'ready' | 'blocked' | 'overdue' | 'stalled';
    readonly issues: readonly {
        readonly code: string;
        readonly message: string;
    }[];
    readonly effectiveModel: AutomationModelSelection | null;
    readonly expectedAt: string | null;
    readonly admittedAt: string | null;
    readonly claimedAt: string | null;
    readonly lastProgressAt: string | null;
    readonly overdueByMs: number;
    readonly queueWaitMs: number | null;
    readonly admissionStatus: 'not_due' | 'not_admitted' | 'queued' | 'running' | 'terminal';
}
export interface AutomationRunView extends AutomationRun {
    readonly sessionArchived: boolean;
}
interface SessionEventLike {
    readonly type: string;
    readonly data: unknown;
}
/** One host-lifetime service. Timer state is disposable; domain records are authority. */
export declare class AutomationService {
    private readonly ctx;
    private readonly domain;
    private readonly config;
    private definitions;
    private runs;
    private receipts;
    private timer;
    private operationTail;
    private commandTail;
    private pumpScheduled;
    private requested;
    private started;
    private stopping;
    private readonly ownerId;
    private readonly active;
    private migration;
    private constructor();
    static open(ctx: Context, config: AutomationConfig): Promise<AutomationService>;
    /** Start the disposable clock only after the surrounding Loader has settled. */
    start(): void;
    /**
     * Automation-created sessions must never receive management tools. The run
     * table covers live/new sessions; durable message provenance covers an old
     * session even after its bounded run record has been pruned.
     */
    ownsSession(sessionId: string, events?: readonly SessionEventLike[]): boolean;
    dispose(): Promise<void>;
    snapshot(scope: AutomationScope, signal?: AbortSignal): Promise<AutomationSnapshot>;
    create(scope: AutomationScope, request: CreateRequest, signal?: AbortSignal): Promise<AutomationDefinition>;
    update(scope: AutomationScope, id: string, input: UpdateRequest, signal?: AbortSignal): Promise<AutomationDefinition>;
    delete(scope: AutomationScope, id: string, signal?: AbortSignal): Promise<{
        readonly id: string;
        readonly deleted: boolean;
    }>;
    runNow(scope: AutomationScope, id: string, signal?: AbortSignal, requestId?: string): Promise<AutomationRun>;
    dispatch(scope: AutomationScope, command: AutomationCommand, signal?: AbortSignal): Promise<AutomationCommandReceipt>;
    private applyCommand;
    private commandErrorCode;
    markRead(scope: AutomationScope, runId: string, signal?: AbortSignal): Promise<AutomationRun>;
    cancelRun(scope: AutomationScope, runId: string, signal?: AbortSignal): Promise<AutomationRun>;
    private resolveScope;
    private ownedDefinition;
    private validateModelPolicy;
    private defaultModelSelection;
    private llmRuntime;
    private modelCatalog;
    private preflightTarget;
    /** Derive scheduler health from the existing Definition and Run facts. */
    private deriveAutomationHealth;
    /** Import the old plugin's v1 domain without ever mutating or deleting it. */
    private importLegacyData;
    /** A committed or ambiguous delete wins over the immutable legacy source. */
    private hasLegacyDeleteTombstone;
    private requestPump;
    private pumpOnce;
    private claimLatestDue;
    private startQueuedRuns;
    private startRun;
    private executeRun;
    private newLease;
    /** Persist one monotonic lifecycle revision, then publish a catch-up-safe event. */
    private commitRun;
    private persistRunPhase;
    private refreshRunLease;
    private armNextTimer;
    private armRetryTimer;
    private clearTimer;
    /** Serialize service-level mutations and scheduler admission around domain writes. */
    private serialize;
    private recoverInterruptedRuns;
    /** Archive terminal run Sessions without changing their durable run result. */
    private archiveRunSession;
    /** Retry terminal Session archival on startup before bounded run pruning. */
    private archiveTerminalRunSessions;
    /** Keep every active record plus the configured newest terminal records per automation. */
    private pruneWorkspaceHistory;
    private pruneAllHistory;
}
export {};

/** JSON contract shared conceptually with the dsh-automation Host RPC adapter. */
export type AutomationStatus = 'active' | 'paused';
export type AutomationRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled' | 'interrupted';
export type AutomationOutcome = 'pending' | 'unknown' | 'no_change' | 'changes_ready' | 'needs_input' | 'succeeded' | 'failed' | 'blocked' | 'cancelled' | 'interrupted' | 'skipped' | 'partial';
export type AutomationAttention = 'none' | 'review' | 'needs_input' | 'failed' | 'blocked' | 'unknown';
export type AutomationPermission = 'read-only' | 'workspace-write';
export type AutomationModelPolicy = {
    readonly mode: 'inherit';
} | {
    readonly mode: 'pinned';
    readonly provider: string;
    readonly model: string;
    readonly reasoningEffort?: string;
};
export interface AutomationModelOption {
    readonly provider: string;
    readonly providerName: string;
    readonly model: string;
    readonly modelName: string;
    readonly reasoningEfforts: readonly {
        readonly id: string;
        readonly name: string;
    }[];
}
export type AutomationSchedule = {
    readonly kind: 'once';
    readonly at: string;
    readonly timeZone?: string;
} | {
    readonly kind: 'interval';
    readonly everyMinutes: number;
    readonly anchor?: string;
    readonly timeZone?: string;
} | {
    readonly kind: 'daily';
    readonly time: string;
    readonly timeZone?: string;
} | {
    readonly kind: 'weekly';
    readonly time: string;
    readonly weekdays: readonly number[];
    readonly timeZone?: string;
};
export interface AutomationViewModel {
    readonly id: string;
    readonly revision: number;
    readonly name: string;
    readonly prompt: string;
    readonly status: AutomationStatus;
    readonly schedule: AutomationSchedule;
    readonly scheduleSummary: string;
    readonly timeZone: string;
    readonly permission: AutomationPermission;
    readonly workspaceId: string;
    readonly workspaceName: string;
    readonly agentPreset: string;
    readonly modelPolicy: AutomationModelPolicy;
    readonly health: {
        readonly status: 'ready' | 'blocked' | 'overdue' | 'stalled';
        readonly issues: readonly {
            readonly code: string;
            readonly message: string;
        }[];
        readonly effectiveModel?: {
            readonly provider: string;
            readonly model: string;
            readonly reasoningEffort?: string;
        };
        readonly expectedAt?: string | null;
        readonly admittedAt?: string | null;
        readonly claimedAt?: string | null;
        readonly lastProgressAt?: string | null;
        readonly overdueByMs?: number;
        readonly queueWaitMs?: number | null;
        readonly admissionStatus?: 'not_due' | 'not_admitted' | 'queued' | 'running' | 'terminal';
    };
    readonly runTimeoutMinutes: number;
    readonly nextRunAt?: string;
    readonly lastRunAt?: string;
    readonly lastRunStatus?: AutomationRunStatus;
    readonly createdAt: string;
    readonly updatedAt: string;
}
export interface AutomationRunViewModel {
    readonly id: string;
    readonly automationId: string;
    readonly automationName: string;
    readonly status: AutomationRunStatus;
    readonly attempt?: number;
    readonly sequence?: number;
    readonly outcome?: AutomationOutcome;
    readonly attention?: AutomationAttention;
    readonly effect?: {
        readonly status: 'none' | 'possible' | 'completed' | 'unknown';
        readonly updatedAt: string;
        readonly externalId?: string;
    };
    readonly phase?: 'claim' | 'setup' | 'executing' | 'settling' | 'delivery';
    readonly heartbeatAt?: string;
    readonly leaseExpiresAt?: string;
    readonly sideEffectsPossible?: boolean;
    readonly effectiveModel?: {
        readonly provider: string;
        readonly model: string;
        readonly reasoningEffort?: string;
    };
    readonly effectiveContext?: {
        readonly actor: {
            readonly kind: 'automation';
            readonly sourceKind: 'agent' | 'web';
            readonly sourceId: string;
        };
        readonly permissionPreset: AutomationPermission;
        readonly agentPreset: string;
        readonly tools: readonly string[];
        readonly approvalPolicy: 'never';
        readonly backgroundProcesses: false;
        readonly capturedAt: string;
    };
    readonly trigger: 'schedule' | 'manual' | 'catch-up';
    readonly scheduledFor: string;
    readonly admittedAt?: string;
    readonly startedAt?: string;
    readonly finishedAt?: string;
    readonly sessionId?: string;
    readonly sessionArchived: boolean;
    readonly summary?: string;
    readonly error?: string;
    readonly errorCode?: string;
    readonly unread?: boolean;
}
export interface AutomationSnapshot {
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
    readonly defaultModel: {
        readonly provider: string;
        readonly model: string;
        readonly reasoningEffort?: string;
    };
    readonly models: readonly AutomationModelOption[];
    readonly automations: readonly AutomationViewModel[];
    readonly runs: readonly AutomationRunViewModel[];
    readonly migration: {
        readonly detectedDefinitions: number;
        readonly detectedRuns: number;
        readonly importedDefinitions: number;
        readonly importedRuns: number;
        readonly plannedDefinitions?: number;
        readonly plannedRuns?: number;
        readonly skippedDeletedDefinitions?: number;
        readonly sourceFingerprint?: string;
    };
    readonly serverNow: string;
}
export interface CreateAutomationInput {
    readonly name: string;
    readonly prompt: string;
    readonly schedule: AutomationSchedule;
    readonly timeZone: string;
    readonly permission: AutomationPermission;
    readonly workspaceId: string;
    readonly agentPreset: string;
    readonly modelPolicy: AutomationModelPolicy;
    readonly runTimeoutMinutes: number;
}
export interface UpdateAutomationInput {
    readonly name?: string;
    readonly prompt?: string;
    readonly schedule?: AutomationSchedule;
    readonly timeZone?: string;
    readonly permission?: AutomationPermission;
    readonly agentPreset?: string;
    readonly runTimeoutMinutes?: number;
    readonly modelPolicy?: AutomationModelPolicy;
}
export interface SnapshotRequest {
    readonly workspaceId?: string;
}
export interface CreateRequest {
    readonly workspaceId: string;
    readonly clientRequestId: string;
    readonly input: CreateAutomationInput;
}
export interface UpdateRequest {
    readonly workspaceId?: string;
    readonly clientRequestId: string;
    readonly automationId: string;
    readonly expectedRevision: number;
    readonly input: UpdateAutomationInput;
}
export interface MutateRequest {
    readonly workspaceId?: string;
    readonly clientRequestId: string;
    readonly automationId: string;
    readonly mutation: 'pause' | 'resume' | 'delete';
}
export interface RunNowRequest {
    readonly workspaceId?: string;
    readonly clientRequestId: string;
    readonly automationId: string;
}
export interface MarkReadRequest {
    readonly workspaceId?: string;
    readonly clientRequestId: string;
    readonly runId: string;
}
export interface CancelRunRequest {
    readonly workspaceId?: string;
    readonly clientRequestId: string;
    readonly runId: string;
}
export interface AutomationCommandReceipt {
    readonly requestId: string;
    readonly command: string;
    readonly outcome: 'committed' | 'rejected' | 'unknown';
    readonly entityId?: string;
    readonly revision?: number;
    readonly appliedAt: string;
    readonly replayed: boolean;
    readonly error?: {
        readonly code: string;
        readonly message: string;
    };
}
export interface RpcErrorValue {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
}
export type RpcResult<T> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: RpcErrorValue;
};
/** Fail closed when the host rejects a request or returns a malformed envelope. */
export declare function unwrapRpcResult<T>(value: unknown): T;

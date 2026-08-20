/** JSON contract shared conceptually with the dsh-automation Host RPC adapter. */
export type AutomationStatus = 'active' | 'paused';
export type AutomationRunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped' | 'cancelled' | 'interrupted';
export type AutomationPermission = 'read-only' | 'workspace-write';
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
    readonly trigger: 'schedule' | 'manual' | 'catch-up';
    readonly scheduledFor: string;
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
    readonly automations: readonly AutomationViewModel[];
    readonly runs: readonly AutomationRunViewModel[];
    readonly migration: {
        readonly detectedDefinitions: number;
        readonly detectedRuns: number;
        readonly importedDefinitions: number;
        readonly importedRuns: number;
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
    readonly automationId: string;
    readonly expectedRevision: number;
    readonly input: UpdateAutomationInput;
}
export interface MutateRequest {
    readonly workspaceId?: string;
    readonly automationId: string;
    readonly mutation: 'pause' | 'resume' | 'delete';
}
export interface RunNowRequest {
    readonly workspaceId?: string;
    readonly automationId: string;
}
export interface MarkReadRequest {
    readonly workspaceId?: string;
    readonly runId: string;
}
export interface CancelRunRequest {
    readonly workspaceId?: string;
    readonly runId: string;
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

/** Fresh-Agent execution boundary for one already-claimed automation run. */
import type { Context } from '@deepseek-ai/cordis';
import type { AutomationAttention, AutomationDefinition, AutomationOutcome, AutomationRun, AutomationRunPhase } from './types.ts';
interface SessionEventLike {
    readonly seq: number;
    readonly type: string;
    readonly data: Record<string, any>;
}
/** Stable, non-secret capability snapshot recorded on every admitted Agent. */
export declare function unattendedToolNames(): readonly string[];
/** Final scoped denial for capabilities that require a person or spawn another authority boundary. */
export declare function unattendedToolGuardReason(name: string, args: unknown, permissionPreset?: AutomationRun['targetSnapshot']['permissionPreset']): string | undefined;
export interface RunCompletion {
    readonly sessionId?: string;
    readonly status: 'succeeded' | 'failed' | 'cancelled';
    readonly summary?: string;
    readonly error?: {
        readonly code: string;
        readonly message: string;
    };
    readonly effectiveModel?: {
        readonly provider: string;
        readonly model: string;
        readonly reasoningEffort?: string;
    };
    readonly outcome?: AutomationOutcome;
    readonly attention?: AutomationAttention;
    readonly cleanupIncomplete?: boolean;
    readonly effectiveTools?: readonly string[];
}
export interface ExecutorConfig {
    readonly runTimeoutMs: number;
    readonly sessionId: string;
    readonly signal?: AbortSignal;
    readonly teardownGraceMs?: number;
    readonly executionCwd?: string;
    readonly onPhase?: (phase: Extract<AutomationRunPhase, 'executing' | 'settling'>, sideEffectsPossible: true) => Promise<void>;
}
/** Last assistant text and closed-turn reason for the interval owned by this run. */
export declare function summarizeRun(events: readonly SessionEventLike[], firstSeq: number): {
    readonly text: string;
    readonly reason?: Record<string, any>;
};
export declare function classifyExecutorError(error: unknown): {
    readonly code: string;
    readonly message: string;
};
/**
 * Execute exactly one durable run in a fresh root Agent. The new Session owns
 * no source-chat history or grant; policy and model selection are installed
 * before publication.
 */
export declare function executeAutomationRun(ctx: Context, definition: AutomationDefinition, run: AutomationRun, config: ExecutorConfig): Promise<RunCompletion>;
export {};

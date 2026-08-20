/** Cordis Host plugin for durable standalone DSH automations. */
import type { Context } from '@deepseek-ai/cordis';
export declare const name = "dsh-automation-center";
export declare const inject: string[];
export interface Config {
    readonly maxConcurrentRuns?: number;
    readonly runTimeoutMinutes?: number;
    readonly misfireGraceMinutes?: number;
    readonly historyLimit?: number;
    readonly archiveRunSessions?: boolean;
}
export declare const Config: any;
export declare function needsHumanApproval(exec: {
    readonly name: string;
    readonly arguments?: unknown;
    readonly signal: AbortSignal;
}, isMountedAgent: boolean): boolean;
export declare function humanApprovalReason(toolName: string): string;
interface LoaderEntryView {
    readonly options: {
        readonly id?: string;
        readonly name?: string;
        readonly disabled?: unknown;
    };
}
/** Find an enabled legacy scheduler before either plugin can start a clock. */
export declare function findLegacyAutomationConflict(entries: Iterable<LoaderEntryView>): LoaderEntryView | undefined;
/** Mount one host-wide authority and agent-scoped management tools. */
export declare function apply(ctx: Context, rawConfig: Config): Promise<void>;
export type * from './types.ts';
export { automationDomainSpec } from './domain.ts';

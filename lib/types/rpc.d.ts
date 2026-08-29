/** Loopback-only Host RPC adapter for the Automation Web client. */
import type { AutomationService } from './service.ts';
interface RpcContext {
    readonly connection: {
        readonly rpc: {
            handle(channel: string, handler: (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>, options?: {
                readonly authority: 'loopback' | 'trusted-host';
            }): () => Promise<void>;
        };
    };
}
/**
 * Register one authenticated management channel. rc.8/rc.2 enforce the
 * requested loopback authority; alpha.1 authenticates the channel through its
 * one-time browser token and ignores the legacy third argument.
 */
export declare function registerAutomationRpc(ctx: RpcContext, service: AutomationService): () => Promise<void>;
export {};

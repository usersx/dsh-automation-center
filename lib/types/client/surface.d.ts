import type { ClientContext, Translate } from './contracts.js';
import type { AutomationRuntime } from './runtime.js';
export type AutomationSurfaceMode = 'native-shell' | 'conversation';
/**
 * Select and register the deepest Automation Center surface supported by the
 * running DSH client. The enhanced layout service is the capability marker;
 * stock rc.8 receives the manifest-declared, session-scoped Conversation tab
 * without changing the Host, storage, RPC, or Automation Engine interfaces.
 */
export declare function registerAutomationSurface(ctx: ClientContext, runtime: AutomationRuntime, t: Translate): AutomationSurfaceMode;

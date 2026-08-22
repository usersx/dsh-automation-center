import type { ClientContext, Translate } from './contracts.js';
import type { AutomationRuntime } from './runtime.js';
export type AutomationSurfaceMode = 'native-shell' | 'conversation';
/**
 * Select and register the deepest Automation Center surface supported by the
 * running DSH client. Settings is the stock global management surface. The
 * enhanced layout service adds a Sidebar root action/page, while stock rc.8
 * also keeps the manifest-declared, Session-scoped Conversation shortcut.
 */
export declare function registerAutomationSurface(ctx: ClientContext, runtime: AutomationRuntime, t: Translate): AutomationSurfaceMode;

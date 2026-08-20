import type { ClientContext } from './contracts.js';
export declare const name = "dsh-automation-center-client";
export declare const inject: string[];
/** Register the best native Automation Center surface this DSH build exposes. */
export declare function apply(ctx: ClientContext): void;
export { registerAutomationSurface } from './surface.js';
export type { AutomationSurfaceMode } from './surface.js';

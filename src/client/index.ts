import type { ClientContext } from './contracts.js'
import { en, NS, zh } from './locales.js'
import { createAutomationRuntime } from './runtime.js'
import { installStyles } from './styles.js'
import { registerAutomationSurface } from './surface.js'

export const name = 'dsh-automation-center-client'
export const inject = ['slots', 'locale', 'connection', 'sessions', 'layout']

/** Register the best native Automation Center surface this DSH build exposes. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => installStyles(), 'dsh-automation-center: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-automation-center: locale')
  const t = ctx.locale.bind(NS)
  const runtime = createAutomationRuntime(ctx.connection.rpc)
  registerAutomationSurface(ctx, runtime, t)
}

export { registerAutomationSurface } from './surface.js'
export type { AutomationSurfaceMode } from './surface.js'

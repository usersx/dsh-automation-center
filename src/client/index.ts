import { AutomationSidebarAction } from './AutomationSidebarAction.js'
import { AutomationView } from './AutomationView.js'
import type { ClientContext } from './contracts.js'
import { en, NS, zh } from './locales.js'
import { createAutomationRuntime } from './runtime.js'
import { installStyles } from './styles.js'

export const name = 'dsh-automation-center-client'
export const inject = ['slots', 'locale', 'connection', 'sessions', 'layout']

/** Register the global page and its root-level sidebar action. */
export function apply(ctx: ClientContext): void {
  for (const required of ['shell.page', 'sidebar.primary.action'] as const) {
    try {
      ctx.slots.entriesOfSlot(required)
    } catch {
      throw new Error(`DSH_AUTOMATION_INCOMPATIBLE: this DSH build does not provide the required '${required}' client slot`)
    }
  }
  ctx.effect(() => installStyles(), 'dsh-automation-center: styles')
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-automation-center: locale')
  const t = ctx.locale.bind(NS)
  const runtime = createAutomationRuntime(ctx.connection.rpc)

  ctx.slots.inject('shell.page', () => ctx.slots.register({
    name: 'shell.page',
    id: 'automation',
    order: 20,
    locale: NS,
    inject: () => ({
      hooks: { automationState: runtime.source },
      refresh: runtime.refresh,
      createAutomation: runtime.createAutomation,
      updateAutomation: runtime.updateAutomation,
      mutateAutomation: runtime.mutateAutomation,
      runNow: runtime.runNow,
      markRunRead: runtime.markRunRead,
      cancelRun: runtime.cancelRun,
      openSession: (runId: string, runSessionId: string) => runtime.openRunSession(runId, async () => {
        await ctx.sessions.refresh()
        ctx.layout.showConversation()
        ctx.sessions.open(runSessionId)
      }),
    }),
  }, AutomationView))

  ctx.slots.inject('sidebar.primary.action', () => ctx.slots.register({
    name: 'sidebar.primary.action',
    id: 'automation',
    order: 20,
    locale: NS,
    inject: () => ({
      hooks: {
        automationState: runtime.source,
        shellSurface: ctx.layout.surface,
      },
      refresh: runtime.refresh,
      open: () => { ctx.layout.openPage('automation') },
    }),
  }, AutomationSidebarAction))
}

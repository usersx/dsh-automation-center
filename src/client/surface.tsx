import { AutomationSidebarAction } from './AutomationSidebarAction.js'
import { AutomationView } from './AutomationView.js'
import type {
  AutomationViewProps,
  ClientContext,
  Translate,
} from './contracts.js'
import { NS } from './locales.js'
import type { AutomationRuntime } from './runtime.js'

export type AutomationSurfaceMode = 'native-shell' | 'conversation'

function pageShares(
  ctx: ClientContext,
  runtime: AutomationRuntime,
  showConversation: () => void,
): Record<string, unknown> {
  return {
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
      showConversation()
      ctx.sessions.open(runSessionId)
    }),
  }
}

function ConversationAutomationView(
  props: AutomationViewProps & { readonly sessionId?: string },
): JSX.Element {
  return (
    <div className="dsh-automation-conversation-surface" data-conversation-composer-overlay="">
      <AutomationView {...props} />
    </div>
  )
}

function registerNativeShell(
  ctx: ClientContext,
  runtime: AutomationRuntime,
): void {
  const layout = ctx.layout
  if (layout?.surface === undefined || layout.openPage === undefined || layout.showConversation === undefined) {
    throw new Error('DSH_AUTOMATION_INCOMPATIBLE: native shell slots exist without the required layout navigation interface')
  }

  ctx.slots.inject('shell.page', () => ctx.slots.register({
    name: 'shell.page',
    id: 'automation',
    order: 20,
    locale: NS,
    inject: () => pageShares(ctx, runtime, () => { layout.showConversation?.() }),
  }, AutomationView))

  ctx.slots.inject('sidebar.primary.action', () => ctx.slots.register({
    name: 'sidebar.primary.action',
    id: 'automation',
    order: 20,
    locale: NS,
    inject: () => ({
      hooks: {
        automationState: runtime.source,
        shellSurface: layout.surface,
      },
      refresh: runtime.refresh,
      open: () => { layout.openPage?.('automation') },
    }),
  }, AutomationSidebarAction))
}

function registerConversationFallback(
  ctx: ClientContext,
  runtime: AutomationRuntime,
  t: Translate,
): void {
  ctx.slots.inject('conversation.view', () => ctx.slots.register({
    name: 'conversation.view',
    id: 'automation',
    order: 40,
    locale: NS,
    label: () => t('tab'),
    inject: () => pageShares(ctx, runtime, () => undefined),
  }, ConversationAutomationView))
}

/**
 * Select and register the deepest Automation Center surface supported by the
 * running DSH client. The enhanced layout service is the capability marker;
 * stock rc.8 receives the manifest-declared, session-scoped Conversation tab
 * without changing the Host, storage, RPC, or Automation Engine interfaces.
 */
export function registerAutomationSurface(
  ctx: ClientContext,
  runtime: AutomationRuntime,
  t: Translate,
): AutomationSurfaceMode {
  const hasNativeNavigation = ctx.layout?.surface !== undefined
    && ctx.layout.openPage !== undefined
    && ctx.layout.showConversation !== undefined

  if (hasNativeNavigation) {
    registerNativeShell(ctx, runtime)
    return 'native-shell'
  }
  registerConversationFallback(ctx, runtime, t)
  return 'conversation'
}

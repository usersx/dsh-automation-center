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

function SettingsAutomationView(
  props: AutomationViewProps & { readonly close: () => void },
): JSX.Element {
  const { close, openSession, ...view } = props
  return (
    <AutomationView
      {...view}
      openSession={async (runId, sessionId) => {
        close()
        await openSession(runId, sessionId)
      }}
    />
  )
}

function registerSettingsSection(
  ctx: ClientContext,
  runtime: AutomationRuntime,
  t: Translate,
): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'automation',
    order: 35,
    locale: NS,
    label: () => t('tab'),
    inject: () => pageShares(ctx, runtime, () => undefined),
  }, SettingsAutomationView))
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
 * running DSH client. Settings is the stock global management surface. The
 * enhanced layout service adds a Sidebar root action/page, while stock rc.8
 * also keeps the manifest-declared, Session-scoped Conversation shortcut.
 */
export function registerAutomationSurface(
  ctx: ClientContext,
  runtime: AutomationRuntime,
  t: Translate,
): AutomationSurfaceMode {
  registerSettingsSection(ctx, runtime, t)
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

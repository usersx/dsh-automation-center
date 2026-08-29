import type { ComponentType, ReactNode } from 'react'
import type { AutomationLocaleKey } from './locales.js'
import type { AutomationClientState, AutomationRuntime } from './runtime.js'

export type Translate = (key: AutomationLocaleKey, params?: Record<string, unknown>) => string

export interface SelectorHook<T> {
  <Selected>(selector: (value: T) => Selected): Selected
}

export interface AutomationViewProps {
  readonly t: Translate
  readonly useAutomationState: SelectorHook<AutomationClientState>
  readonly refresh: AutomationRuntime['refresh']
  readonly createAutomation: AutomationRuntime['createAutomation']
  readonly updateAutomation: AutomationRuntime['updateAutomation']
  readonly mutateAutomation: AutomationRuntime['mutateAutomation']
  readonly runNow: AutomationRuntime['runNow']
  readonly markRunRead: AutomationRuntime['markRunRead']
  readonly cancelRun: AutomationRuntime['cancelRun']
  readonly reviewRun: AutomationRuntime['reviewRun']
  readonly openSession: (runId: string, sessionId: string) => Promise<void>
}

export interface AutomationSidebarActionProps {
  readonly wide: boolean
  readonly renderAction?: (props: {
    readonly label: string
    readonly icon: ReactNode
    readonly active?: boolean
    readonly badge?: { readonly label: string; readonly value: string }
    readonly onClick: () => void
  }) => ReactNode
  readonly t: Translate
  readonly useAutomationState: SelectorHook<AutomationClientState>
  readonly useShellSurface: SelectorHook<{ kind: 'conversation' } | { kind: 'page'; pageId: string }>
  readonly refresh: AutomationRuntime['refresh']
  readonly open: () => void
}

export interface ClientRpc {
  call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<unknown>
}

interface BaseRegistrationOptions {
  readonly id: string
  readonly order: number
  readonly locale: string
}

type RegistrationOptions =
  | (BaseRegistrationOptions & {
      readonly name: 'shell.page' | 'sidebar.primary.action'
      readonly inject: () => Record<string, unknown>
    })
  | (BaseRegistrationOptions & {
      readonly name: 'conversation.view'
      readonly label: () => string
      readonly inject: (sessionId: string) => Record<string, unknown>
    })
  | (BaseRegistrationOptions & {
      readonly name: 'settings.section'
      readonly label: string | (() => string)
      readonly inject: () => Record<string, unknown>
    })

export interface ClientContext {
  effect(factory: () => void | (() => void), label?: string): void
  connection: { readonly rpc: ClientRpc }
  layout?: {
    readonly surface?: {
      getSnapshot(): { kind: 'conversation' } | { kind: 'page'; pageId: string }
      subscribe(listener: () => void): () => void
    }
    openPage?(pageId: string): void
    showConversation?(): void
  }
  sessions: {
    refresh(): Promise<void>
    open(sessionId: string): void
  }
  locale: {
    register(
      namespace: string,
      dictionaries: { readonly zh: Record<string, string>; readonly en: Record<string, string> },
    ): () => void
    bind(namespace: string): Translate
  }
  slots: {
    entriesOfSlot(name: string): readonly unknown[]
    inject(name: 'shell.page' | 'sidebar.primary.action' | 'conversation.view' | 'settings.section', register: () => void | (() => void)): void
    register(options: RegistrationOptions, component: ComponentType<any>): () => void
  }
}

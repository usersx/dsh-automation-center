import type { ClientRpc } from './contracts.js'
import type {
  AutomationSnapshot,
  CancelRunRequest,
  CreateAutomationInput,
  CreateRequest,
  MarkReadRequest,
  MutateRequest,
  RunNowRequest,
  SnapshotRequest,
  UpdateAutomationInput,
  UpdateRequest,
} from './protocol.js'
import { unwrapRpcResult } from './protocol.js'

const CHANNEL = '/dsh-automation-center'

export interface AutomationClientState {
  readonly phase: 'idle' | 'loading' | 'ready' | 'error'
  readonly snapshot?: AutomationSnapshot
  readonly error?: string
  readonly refreshedAt?: number
}

export interface AutomationStateSource {
  getSnapshot(): AutomationClientState
  subscribe(listener: () => void): () => void
}

export interface AutomationRuntime {
  readonly source: AutomationStateSource
  refresh(): Promise<void>
  createAutomation(input: CreateAutomationInput): Promise<void>
  updateAutomation(automationId: string, expectedRevision: number, input: UpdateAutomationInput): Promise<void>
  mutateAutomation(automationId: string, mutation: MutateRequest['mutation']): Promise<void>
  runNow(automationId: string): Promise<void>
  markRunRead(runId: string): Promise<void>
  cancelRun(runId: string): Promise<void>
  openRunSession(runId: string, open: () => Promise<void>): Promise<void>
}

/** One root-scoped observable shared by the global Automation Center and its sidebar action. */
export function createAutomationRuntime(rpc: ClientRpc): AutomationRuntime {
  let state: AutomationClientState = { phase: 'idle' }
  let refreshPromise: Promise<void> | undefined
  const listeners = new Set<() => void>()
  const createRequestIds = new Map<string, string>()
  const publish = (next: AutomationClientState): void => {
    state = next
    for (const listener of [...listeners]) listener()
  }
  const source: AutomationStateSource = {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }

  const refresh = async (): Promise<void> => {
    if (refreshPromise !== undefined) return refreshPromise
    const previous = state.snapshot
    publish(previous === undefined
      ? { phase: 'loading' }
      : {
          phase: 'loading',
          snapshot: previous,
          ...(state.refreshedAt === undefined ? {} : { refreshedAt: state.refreshedAt }),
        })
    refreshPromise = (async () => {
      try {
        const payload: SnapshotRequest = {}
        const response = await rpc.call(CHANNEL, 'snapshot', payload)
        const snapshot = unwrapRpcResult<AutomationSnapshot>(response)
        publish({ phase: 'ready', snapshot, refreshedAt: Date.now() })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        publish(previous === undefined
          ? { phase: 'error', error: message }
          : {
              phase: 'error',
              snapshot: previous,
              error: message,
              ...(state.refreshedAt === undefined ? {} : { refreshedAt: state.refreshedAt }),
            })
        throw error
      } finally {
        refreshPromise = undefined
      }
    })()
    return refreshPromise
  }

  const mutateThenRefresh = async (endpoint: string, payload: unknown): Promise<void> => {
    unwrapRpcResult<unknown>(await rpc.call(CHANNEL, endpoint, payload))
    // A poll may have started before the mutation completed. Let it settle,
    // then require a post-mutation snapshot instead of accepting stale data.
    const pendingBeforeRefresh = refreshPromise
    if (pendingBeforeRefresh !== undefined) await pendingBeforeRefresh.catch(() => undefined)
    await refresh()
  }
  const markRunRead = async (runId: string): Promise<void> => {
    const payload: MarkReadRequest = { runId }
    await mutateThenRefresh('mark-read', payload)
  }

  return {
    source,
    refresh,
    async createAutomation(input) {
      const key = JSON.stringify(input)
      let clientRequestId = createRequestIds.get(key)
      if (clientRequestId === undefined) {
        clientRequestId = globalThis.crypto?.randomUUID?.()
          ?? `request_${Date.now()}_${Math.random().toString(36).slice(2)}`
        createRequestIds.set(key, clientRequestId)
      }
      const payload: CreateRequest = { workspaceId: input.workspaceId, clientRequestId, input }
      await mutateThenRefresh('create', payload)
    },
    async updateAutomation(automationId, expectedRevision, input) {
      const payload: UpdateRequest = { automationId, expectedRevision, input }
      await mutateThenRefresh('update', payload)
    },
    async mutateAutomation(automationId, mutation) {
      const payload: MutateRequest = { automationId, mutation }
      await mutateThenRefresh('mutate', payload)
    },
    async runNow(automationId) {
      const payload: RunNowRequest = { automationId }
      await mutateThenRefresh('run-now', payload)
    },
    markRunRead,
    async cancelRun(runId) {
      const payload: CancelRunRequest = { runId }
      await mutateThenRefresh('cancel-run', payload)
    },
    async openRunSession(runId, open) {
      // A failed navigation must leave the run unread so it still asks for
      // attention. Mark it only after the destination Session is available.
      await open()
      await markRunRead(runId)
    },
  }
}

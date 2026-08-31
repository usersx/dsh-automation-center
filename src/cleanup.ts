/** Retryable ownership for asynchronous cleanup without widening the public package API. */

export interface OwnedCleanup {
  readonly run: () => Promise<void>
  readonly state: () => 'owned' | 'settling' | 'released'
}

/** Keep one cleanup owner until its asynchronous operation has actually settled. */
export function createOwnedCleanup(operation: () => Promise<void>): OwnedCleanup {
  let state: 'owned' | 'settling' | 'released' = 'owned'
  let pending: Promise<void> | undefined
  return {
    state: () => state,
    run: () => {
      if (state === 'released') return Promise.resolve()
      if (pending !== undefined) return pending
      state = 'settling'
      pending = operation().then(() => {
        state = 'released'
      }, (error: unknown) => {
        state = 'owned'
        pending = undefined
        throw error
      })
      return pending
    },
  }
}

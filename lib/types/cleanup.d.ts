/** Retryable ownership for asynchronous cleanup without widening the public package API. */
export interface OwnedCleanup {
    readonly run: () => Promise<void>;
    readonly state: () => 'owned' | 'settling' | 'released';
}
/** Keep one cleanup owner until its asynchronous operation has actually settled. */
export declare function createOwnedCleanup(operation: () => Promise<void>): OwnedCleanup;

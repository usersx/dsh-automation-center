/** Isolated Git worktree review lifecycle for workspace-write automations. */
import type { AutomationReviewState as GitReviewState } from './types.ts';
/** Prepare a clean detached worktree without changing the source checkout. */
export declare function prepareGitReview(sourceCwd: string): Promise<GitReviewState>;
/** Capture tracked and untracked changes as one reviewable patch digest/stat. */
export declare function collectGitReview(review: GitReviewState): Promise<GitReviewState>;
/** Apply an unchanged-base review to a clean source checkout, then clean up. */
export declare function acceptGitReview(sourceCwd: string, review: GitReviewState): Promise<GitReviewState>;
export declare function keepGitReview(review: GitReviewState): GitReviewState;
export declare function discardGitReview(sourceCwd: string, review: GitReviewState): Promise<GitReviewState>;
export declare function beginGitReviewSettlement(review: GitReviewState, action: 'accept' | 'discard', updatedAt?: string): GitReviewState;
export declare function failGitReviewSettlement(review: GitReviewState, _error: unknown, updatedAt?: string): GitReviewState;

/** Isolated Git worktree review lifecycle for workspace-write automations. */

import { createHash } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { access, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { AutomationReviewState as GitReviewState } from './types.ts'

const execFileAsync = promisify(execFile)
const REVIEW_PREFIX = join(tmpdir(), 'dsh-automation-review-')

async function git(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', cwd, ...args], {
    encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
  })
  return result.stdout.trim()
}

async function gitRaw(cwd: string, args: readonly string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', cwd, ...args], {
    encoding: 'utf8', maxBuffer: 20 * 1024 * 1024,
  })
  return result.stdout
}

function assertManagedWorktree(path: string): void {
  if (!path.startsWith(REVIEW_PREFIX) || dirname(path) === tmpdir()) {
    throw new Error('review worktree path is outside the managed temporary boundary')
  }
}

async function removeManagedWorktree(sourceCwd: string, worktreePath: string): Promise<void> {
  assertManagedWorktree(worktreePath)
  const present = await access(worktreePath).then(() => true, () => false)
  if (present) await git(sourceCwd, ['worktree', 'remove', '--force', worktreePath])
  else await git(sourceCwd, ['worktree', 'prune'])
  await rm(dirname(worktreePath), { recursive: true, force: true })
}

function patchDigest(patch: string): string {
  return createHash('sha256').update(patch).digest('hex')
}

async function capturePatch(cwd: string): Promise<{
  readonly patch: string
  readonly digest: string
  readonly diffStat: string
}> {
  const untracked = (await gitRaw(cwd, ['ls-files', '--others', '--exclude-standard', '-z']))
    .split('\0').filter(path => path !== '')
  await git(cwd, ['add', '-N', '--all'])
  try {
    const patch = await git(cwd, ['diff', '--binary', '--full-index', 'HEAD'])
    const diffStat = await git(cwd, ['diff', '--stat', 'HEAD'])
    return { patch, digest: patchDigest(patch), diffStat }
  } finally {
    // `git add -N` is only a patch-capture mechanism. Never leave the source
    // checkout or retained review worktree with synthetic intent-to-add rows.
    if (untracked.length > 0) await git(cwd, ['reset', '--', ...untracked])
  }
}

/** Prepare a clean detached worktree without changing the source checkout. */
export async function prepareGitReview(sourceCwd: string): Promise<GitReviewState> {
  const status = await git(sourceCwd, ['status', '--porcelain=v1'])
  if (status !== '') throw new Error('git-review requires a clean source checkout')
  const baseSha = await git(sourceCwd, ['rev-parse', 'HEAD'])
  const root = await mkdtemp(REVIEW_PREFIX)
  const worktreePath = join(root, 'worktree')
  try {
    await git(sourceCwd, ['worktree', 'add', '--detach', worktreePath, baseSha])
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
  const updatedAt = new Date().toISOString()
  return {
    mode: 'worktree', status: 'ready', baseSha, worktreePath, patchSha256: null, diffStat: null,
    cleanup: { status: 'owned', action: null, updatedAt },
  }
}

/** Capture tracked and untracked changes as one reviewable patch digest/stat. */
export async function collectGitReview(review: GitReviewState): Promise<GitReviewState> {
  assertManagedWorktree(review.worktreePath)
  const { patch, digest, diffStat } = await capturePatch(review.worktreePath)
  return {
    ...review,
    status: 'ready',
    patchSha256: digest,
    diffStat: diffStat === '' ? 'No changes' : diffStat,
  }
}

async function applyPatch(sourceCwd: string, patch: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('git', ['-C', sourceCwd, 'apply', '--3way', '--whitespace=nowarn', '-'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', chunk => { stderr += String(chunk) })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`git apply failed (${code ?? 'signal'}): ${stderr.trim()}`))
    })
    child.stdin.end(patch)
  })
}

/** Apply an unchanged-base review to a clean source checkout, then clean up. */
export async function acceptGitReview(sourceCwd: string, review: GitReviewState): Promise<GitReviewState> {
  assertManagedWorktree(review.worktreePath)
  if (await git(sourceCwd, ['rev-parse', 'HEAD']) !== review.baseSha) {
    throw new Error('cannot accept review because the source HEAD changed')
  }
  const sourceDirty = await git(sourceCwd, ['status', '--porcelain=v1']) !== ''
  if (sourceDirty) {
    const source = await capturePatch(sourceCwd)
    if (review.patchSha256 === null || source.digest !== review.patchSha256) {
      throw new Error('cannot accept review into a dirty source checkout')
    }
  } else {
    const worktreePresent = await access(review.worktreePath).then(() => true, () => false)
    if (!worktreePresent) {
      if (review.patchSha256 !== patchDigest('')) {
        throw new Error('cannot reconcile accepted review because its worktree is missing')
      }
    } else {
      const captured = await capturePatch(review.worktreePath)
      if (review.patchSha256 !== null && captured.digest !== review.patchSha256) {
        throw new Error('cannot accept review because its patch identity changed')
      }
      if (captured.patch !== '') await applyPatch(sourceCwd, `${captured.patch}\n`)
    }
  }
  await removeManagedWorktree(sourceCwd, review.worktreePath)
  return {
    ...review, status: 'accepted',
    cleanup: { status: 'released', action: 'accept', updatedAt: new Date().toISOString() },
  }
}

export function keepGitReview(review: GitReviewState): GitReviewState {
  assertManagedWorktree(review.worktreePath)
  return { ...review, status: 'kept' }
}

export async function discardGitReview(sourceCwd: string, review: GitReviewState): Promise<GitReviewState> {
  await removeManagedWorktree(sourceCwd, review.worktreePath)
  return {
    ...review, status: 'discarded',
    cleanup: { status: 'released', action: 'discard', updatedAt: new Date().toISOString() },
  }
}

export function beginGitReviewSettlement(
  review: GitReviewState,
  action: 'accept' | 'discard',
  updatedAt = new Date().toISOString(),
): GitReviewState {
  assertManagedWorktree(review.worktreePath)
  if (review.cleanup.status !== 'owned') throw new Error('review cleanup is already settling or released')
  return { ...review, cleanup: { status: 'settling', action, updatedAt } }
}

export function failGitReviewSettlement(
  review: GitReviewState,
  _error: unknown,
  updatedAt = new Date().toISOString(),
): GitReviewState {
  return {
    ...review,
    status: 'failed',
    error: {
      code: 'review_cleanup_failed',
      message: 'Git review cleanup did not settle; manual reconciliation is required.',
    },
    cleanup: { ...review.cleanup, status: 'unknown', updatedAt },
  }
}

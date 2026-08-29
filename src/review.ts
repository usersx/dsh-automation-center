/** Isolated Git worktree review lifecycle for workspace-write automations. */

import { createHash } from 'node:crypto'
import { execFile, spawn } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
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

function assertManagedWorktree(path: string): void {
  if (!path.startsWith(REVIEW_PREFIX) || dirname(path) === tmpdir()) {
    throw new Error('review worktree path is outside the managed temporary boundary')
  }
}

async function removeManagedWorktree(sourceCwd: string, worktreePath: string): Promise<void> {
  assertManagedWorktree(worktreePath)
  await git(sourceCwd, ['worktree', 'remove', '--force', worktreePath])
  await rm(dirname(worktreePath), { recursive: true, force: true })
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
  return { mode: 'worktree', status: 'ready', baseSha, worktreePath, patchSha256: null, diffStat: null }
}

/** Capture tracked and untracked changes as one reviewable patch digest/stat. */
export async function collectGitReview(review: GitReviewState): Promise<GitReviewState> {
  assertManagedWorktree(review.worktreePath)
  await git(review.worktreePath, ['add', '-N', '--all'])
  const patch = await git(review.worktreePath, ['diff', '--binary', '--full-index', 'HEAD'])
  const diffStat = await git(review.worktreePath, ['diff', '--stat', 'HEAD'])
  return {
    ...review,
    status: 'ready',
    patchSha256: createHash('sha256').update(patch).digest('hex'),
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
  if (await git(sourceCwd, ['status', '--porcelain=v1']) !== '') {
    throw new Error('cannot accept review into a dirty source checkout')
  }
  if (await git(sourceCwd, ['rev-parse', 'HEAD']) !== review.baseSha) {
    throw new Error('cannot accept review because the source HEAD changed')
  }
  await git(review.worktreePath, ['add', '-N', '--all'])
  const patch = await git(review.worktreePath, ['diff', '--binary', '--full-index', 'HEAD'])
  if (patch !== '') await applyPatch(sourceCwd, `${patch}\n`)
  await removeManagedWorktree(sourceCwd, review.worktreePath)
  return { ...review, status: 'accepted' }
}

export function keepGitReview(review: GitReviewState): GitReviewState {
  assertManagedWorktree(review.worktreePath)
  return { ...review, status: 'kept' }
}

export async function discardGitReview(sourceCwd: string, review: GitReviewState): Promise<GitReviewState> {
  await removeManagedWorktree(sourceCwd, review.worktreePath)
  return { ...review, status: 'discarded' }
}

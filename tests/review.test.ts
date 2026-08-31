import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import {
  acceptGitReview,
  beginGitReviewSettlement,
  collectGitReview,
  discardGitReview,
  keepGitReview,
  prepareGitReview,
} from '../src/review.ts'

const execFileAsync = promisify(execFile)

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n')
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await execFileAsync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
  return result.stdout.trim()
}

async function repository(): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'dsh-review-test-'))
  await git(cwd, 'init')
  await git(cwd, 'config', 'user.name', 'Automation Test')
  await git(cwd, 'config', 'user.email', 'automation@example.invalid')
  await writeFile(join(cwd, 'tracked.txt'), 'before\n')
  await git(cwd, 'add', 'tracked.txt')
  await git(cwd, 'commit', '-m', 'initial')
  return cwd
}

test('git review isolates edits and accepts tracked plus untracked files', async () => {
  const cwd = await repository()
  const prepared = await prepareGitReview(cwd)
  await writeFile(join(prepared.worktreePath, 'tracked.txt'), 'after\n')
  await writeFile(join(prepared.worktreePath, 'new.txt'), 'new\n')
  const collected = await collectGitReview(prepared)
  assert.equal(collected.cleanup.status, 'owned')
  assert.match(collected.patchSha256 ?? '', /^[a-f0-9]{64}$/)
  assert.match(collected.diffStat ?? '', /2 files changed/)

  const kept = keepGitReview(collected)
  assert.equal(kept.status, 'kept')
  const accepted = await acceptGitReview(cwd, kept)
  assert.equal(accepted.status, 'accepted')
  assert.deepEqual(accepted.cleanup.status, 'released')
  assert.equal(normalizeLineEndings(await readFile(join(cwd, 'tracked.txt'), 'utf8')), 'after\n')
  assert.equal(normalizeLineEndings(await readFile(join(cwd, 'new.txt'), 'utf8')), 'new\n')
})

test('git review discard removes isolation without changing the source', async () => {
  const cwd = await repository()
  const prepared = await prepareGitReview(cwd)
  await writeFile(join(prepared.worktreePath, 'tracked.txt'), 'discarded\n')
  const discarded = await discardGitReview(cwd, await collectGitReview(prepared))
  assert.equal(discarded.status, 'discarded')
  assert.equal(discarded.cleanup.status, 'released')
  assert.equal(normalizeLineEndings(await readFile(join(cwd, 'tracked.txt'), 'utf8')), 'before\n')
})

test('git review acceptance is idempotent after the patch applied but cleanup did not settle', async () => {
  const cwd = await repository()
  const prepared = await prepareGitReview(cwd)
  await writeFile(join(prepared.worktreePath, 'tracked.txt'), 'reconciled\n')
  const collected = await collectGitReview(prepared)
  const settling = beginGitReviewSettlement(collected, 'accept', '2026-08-30T00:00:00.000Z')
  // Simulate a process stop after the patch crossed the side-effect boundary
  // but before the worktree owner was released.
  const patch = await execFileAsync('git', [
    '-C', prepared.worktreePath, 'diff', '--binary', '--full-index', 'HEAD',
  ], { encoding: 'utf8' })
  await new Promise<void>((resolve, reject) => {
    const child = execFile('git', ['-C', cwd, 'apply', '--3way', '--whitespace=nowarn', '-'], (error) => {
      if (error) reject(error)
      else resolve()
    })
    child.stdin?.end(patch.stdout)
  })

  const recovered = await acceptGitReview(cwd, settling)
  assert.equal(recovered.status, 'accepted')
  assert.equal(recovered.cleanup.status, 'released')
  assert.equal(normalizeLineEndings(await readFile(join(cwd, 'tracked.txt'), 'utf8')), 'reconciled\n')
})

test('idempotent acceptance preserves the source index state', async () => {
  const cwd = await repository()
  const prepared = await prepareGitReview(cwd)
  await writeFile(join(prepared.worktreePath, 'new.txt'), 'new\n')
  const collected = await collectGitReview(prepared)
  const settling = beginGitReviewSettlement(collected, 'accept')
  await git(prepared.worktreePath, 'add', '-N', '--all')
  const patch = await execFileAsync('git', [
    '-C', prepared.worktreePath, 'diff', '--binary', '--full-index', 'HEAD',
  ], { encoding: 'utf8' })
  await git(prepared.worktreePath, 'reset', '--', 'new.txt')
  await new Promise<void>((resolve, reject) => {
    const child = execFile('git', ['-C', cwd, 'apply', '--3way', '--whitespace=nowarn', '-'], (error) => {
      if (error) reject(error)
      else resolve()
    })
    child.stdin?.end(patch.stdout)
  })

  const statusBeforeRecovery = await git(cwd, 'status', '--porcelain=v1')
  assert.equal(statusBeforeRecovery, 'A  new.txt')
  await acceptGitReview(cwd, settling)
  assert.equal(await git(cwd, 'status', '--porcelain=v1'), statusBeforeRecovery)
})

test('idempotent acceptance preserves matching untracked source files', async () => {
  const cwd = await repository()
  const prepared = await prepareGitReview(cwd)
  await writeFile(join(prepared.worktreePath, 'new.txt'), 'new\n')
  const settling = beginGitReviewSettlement(await collectGitReview(prepared), 'accept')
  await writeFile(join(cwd, 'new.txt'), 'new\n')

  const recovered = await acceptGitReview(cwd, settling)
  assert.equal(recovered.cleanup.status, 'released')
  assert.equal(await git(cwd, 'status', '--porcelain=v1'), '?? new.txt')
})

test('discard cleanup is idempotent when the managed worktree is already absent', async () => {
  const cwd = await repository()
  const prepared = await prepareGitReview(cwd)
  const settling = beginGitReviewSettlement(await collectGitReview(prepared), 'discard')
  await discardGitReview(cwd, settling)
  const recovered = await discardGitReview(cwd, settling)
  assert.equal(recovered.cleanup.status, 'released')
})

test('git review refuses source drift before acceptance', async () => {
  const cwd = await repository()
  const prepared = await prepareGitReview(cwd)
  await writeFile(join(cwd, 'tracked.txt'), 'local drift\n')
  await assert.rejects(() => acceptGitReview(cwd, prepared), /dirty source checkout/)
  await discardGitReview(cwd, prepared)
})

import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'
import { acceptGitReview, collectGitReview, discardGitReview, keepGitReview, prepareGitReview } from '../src/review.ts'

const execFileAsync = promisify(execFile)

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
  assert.match(collected.patchSha256 ?? '', /^[a-f0-9]{64}$/)
  assert.match(collected.diffStat ?? '', /2 files changed/)

  const kept = keepGitReview(collected)
  assert.equal(kept.status, 'kept')
  const accepted = await acceptGitReview(cwd, kept)
  assert.equal(accepted.status, 'accepted')
  assert.equal(await readFile(join(cwd, 'tracked.txt'), 'utf8'), 'after\n')
  assert.equal(await readFile(join(cwd, 'new.txt'), 'utf8'), 'new\n')
})

test('git review discard removes isolation without changing the source', async () => {
  const cwd = await repository()
  const prepared = await prepareGitReview(cwd)
  await writeFile(join(prepared.worktreePath, 'tracked.txt'), 'discarded\n')
  const discarded = await discardGitReview(cwd, await collectGitReview(prepared))
  assert.equal(discarded.status, 'discarded')
  assert.equal(await readFile(join(cwd, 'tracked.txt'), 'utf8'), 'before\n')
})

test('git review refuses source drift before acceptance', async () => {
  const cwd = await repository()
  const prepared = await prepareGitReview(cwd)
  await writeFile(join(cwd, 'tracked.txt'), 'local drift\n')
  await assert.rejects(() => acceptGitReview(cwd, prepared), /dirty source checkout/)
  await discardGitReview(cwd, prepared)
})

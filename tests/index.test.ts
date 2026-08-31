import assert from 'node:assert/strict'
import test from 'node:test'
import { createOwnedCleanup } from '../src/cleanup.ts'
import { findLegacyAutomationConflict, humanApprovalReason, needsHumanApproval } from '../src/index.ts'

test('cleanup ownership survives failure, coalesces callers, and releases only after settle', async () => {
  let calls = 0
  let release = () => {}
  const gate = new Promise<void>(resolve => { release = resolve })
  const cleanup = createOwnedCleanup(async () => {
    calls += 1
    if (calls === 1) throw new Error('transient cleanup failure')
    await gate
  })

  await assert.rejects(cleanup.run(), /transient cleanup failure/)
  assert.equal(cleanup.state(), 'owned')
  const first = cleanup.run()
  const second = cleanup.run()
  assert.equal(first, second)
  assert.equal(cleanup.state(), 'settling')
  assert.equal(calls, 2)
  release()
  await first
  assert.equal(cleanup.state(), 'released')
  await cleanup.run()
  assert.equal(calls, 2)
})

test('approval is scoped to mounted Agents, includes delete, and ignores cancelled calls', () => {
  const signal = new AbortController().signal
  assert.equal(needsHumanApproval({ name: 'automation_create', signal }, true), true)
  assert.equal(needsHumanApproval({ name: 'automation_delete', signal }, true), true)
  assert.equal(needsHumanApproval({
    name: 'automation_update',
    arguments: { id: 'automation-1', status: 'paused' },
    signal,
  }, true), false)
  assert.equal(needsHumanApproval({ name: 'automation_create', signal }, false), false)

  const cancelled = new AbortController()
  cancelled.abort()
  assert.equal(needsHumanApproval({ name: 'automation_run_now', signal: cancelled.signal }, true), false)
  assert.match(humanApprovalReason('automation_delete'), /permanently deletes/)
})

test('legacy scheduler conflict is explicit and ignores disabled rows', () => {
  assert.equal(findLegacyAutomationConflict([
    { options: { id: 'old-disabled', name: '@dsh-external/dsh-automation', disabled: true } },
    { options: { id: 'unrelated', name: 'another-plugin' } },
  ]), undefined)
  assert.deepEqual(findLegacyAutomationConflict([
    { options: { id: 'old-live', name: '@dsh-external/dsh-automation' } },
  ])?.options.id, 'old-live')
})

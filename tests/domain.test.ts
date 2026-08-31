import assert from 'node:assert/strict'
import test from 'node:test'
import {
  automationDefinitionSchema, automationDomainSpec, automationRunIdentity, automationRunSchema,
  createDefinition, createManualRun, createScheduledRun, deleteDefinition,
  pauseDefinition, resumeDefinition, runIdForOccurrence, updateDefinition,
} from '../src/domain.ts'

const definition = () => createDefinition({
  id: 'automation-security',
  name: 'Security review',
  prompt: 'Review dependency security and summarize concrete findings.',
  schedule: { kind: 'daily', time: '09:00', timeZone: 'Asia/Shanghai' },
  workspaceId: 'workspace-1',
  cwd: '/workspace/repo',
  agentPreset: 'coding',
  createdBy: { kind: 'agent', sessionId: 'session-source' },
  now: '2026-08-13T00:00:00Z',
})

test('domain declaration owns definitions, runs, and durable command receipts', () => {
  assert.equal(automationDomainSpec.name, 'dsh_automation_center')
  assert.equal(automationDomainSpec.version, 1)
  assert.deepEqual(Object.keys(automationDomainSpec.tables).sort(), ['definitions', 'receipts', 'runs'])
})

test('creation derives canonical RRULE and rejects inconsistent stored records', () => {
  const value = definition()
  assert.equal(value.revision, 1)
  assert.equal(value.timeZone, 'Asia/Shanghai')
  assert.match(value.rrule, /FREQ=DAILY/)
  assert.equal(automationDefinitionSchema.safeParse(value).success, true)
  assert.equal(automationDefinitionSchema.safeParse({ ...value, rrule: 'RRULE:FREQ=HOURLY' }).success, false)
  assert.equal(automationDefinitionSchema.safeParse({ ...value, timeZone: 'Europe/Paris' }).success, false)
})

test('model policy is explicit and every run snapshots the requested selection', () => {
  const inherited = definition()
  assert.deepEqual(inherited.modelPolicy, { mode: 'inherit' })
  assert.deepEqual(createManualRun(inherited, '2026-08-14T01:00:00Z', 'inherit').targetSnapshot.modelPolicy, {
    mode: 'inherit',
  })

  const pinned = createDefinition({
    id: 'automation-pinned-model',
    name: 'Pinned model',
    prompt: 'Use the selected model for this task.',
    schedule: { kind: 'daily', time: '09:00', timeZone: 'UTC' },
    workspaceId: 'workspace-1',
    cwd: '/workspace/repo',
    agentPreset: 'coding',
    modelPolicy: {
      mode: 'pinned',
      provider: 'deepseek',
      model: 'deepseek-reasoner',
      reasoningEffort: 'high',
    },
    createdBy: { kind: 'web', sessionId: 'web:workspace-1' },
    now: '2026-08-13T00:00:00Z',
  })
  assert.deepEqual(pinned.modelPolicy, {
    mode: 'pinned', provider: 'deepseek', model: 'deepseek-reasoner', reasoningEffort: 'high',
  })
  assert.deepEqual(createManualRun(pinned, '2026-08-14T01:00:00Z', 'pinned').targetSnapshot.modelPolicy, pinned.modelPolicy)
})

test('update and status transitions are immutable, revisioned pure transforms', () => {
  const original = definition()
  const updated = updateDefinition(original, {
    name: 'Daily security review',
    schedule: {
      kind: 'weekly', weekdays: ['FR', 'MO'], time: '10:30', timeZone: 'America/New_York',
    },
    now: '2026-08-13T01:00:00Z',
  })
  assert.equal(original.revision, 1)
  assert.equal(updated.revision, 2)
  assert.deepEqual(updated.schedule.kind === 'weekly' ? updated.schedule.weekdays : [], ['MO', 'FR'])
  assert.equal(updated.timeZone, 'America/New_York')

  const paused = pauseDefinition(updated, '2026-08-13T02:00:00Z')
  assert.equal(paused.status, 'paused')
  assert.equal(paused.revision, 3)
  assert.equal(pauseDefinition(paused, '2026-08-13T03:00:00Z'), paused)
  const resumed = resumeDefinition(paused, '2026-08-13T04:00:00Z')
  assert.equal(resumed.status, 'active')
  assert.equal(resumed.revision, 4)
  assert.deepEqual(deleteDefinition(resumed), { id: resumed.id, preserveRunHistory: true })
})

test('scheduled occurrence id is deterministic while manual runs require a nonce', () => {
  const value = definition()
  const first = createScheduledRun(value, '2026-08-14T01:00:00Z')
  const duplicate = createScheduledRun(value, '2026-08-14T09:00:00+08:00')
  assert.equal(first.occurrenceKey, duplicate.occurrenceKey)
  assert.equal(first.id, duplicate.id)
  assert.equal(first.id, runIdForOccurrence(first.occurrenceKey))
  assert.equal(automationRunSchema.safeParse(first).success, true)
  assert.equal(first.phase, 'claim')
  assert.equal(first.lease, null)

  const manualOne = createManualRun(value, '2026-08-14T01:00:00Z', 'click-1')
  const manualTwo = createManualRun(value, '2026-08-14T01:00:00Z', 'click-2')
  assert.notEqual(manualOne.id, manualTwo.id)
  assert.deepEqual(automationRunIdentity(manualOne), {
    automationId: value.id,
    definitionRevision: value.revision,
    occurrenceKey: manualOne.occurrenceKey,
    workspaceId: value.workspaceId,
  })
})

test('legacy review rows gain durable cleanup ownership without changing their patch identity', () => {
  const run = createManualRun(definition(), '2026-08-14T01:00:00Z', 'legacy-review')
  const parsed = automationRunSchema.parse({
    ...run,
    review: {
      mode: 'worktree', status: 'ready', baseSha: 'abc', worktreePath: '/tmp/worktree',
      patchSha256: 'def', diffStat: '1 file changed',
    },
  })
  assert.deepEqual(parsed.review?.cleanup, {
    status: 'owned', action: null, updatedAt: run.admittedAt,
  })
})

test('strict validation rejects blank prompts and unsafe permission presets', () => {
  assert.throws(() => createDefinition({
    id: 'x', name: 'x', prompt: '  ',
    schedule: { kind: 'interval', everyMinutes: 5, anchor: '2026-08-13T00:00:00Z', timeZone: 'Etc/UTC' },
    workspaceId: 'w', cwd: '/repo', agentPreset: 'coding',
    createdBy: { kind: 'web', sessionId: 's' }, now: '2026-08-13T00:00:00Z',
  }), /prompt/)
  assert.equal(automationDefinitionSchema.safeParse({
    ...definition(), permissionPreset: 'danger-full-access',
  }).success, false)
  assert.throws(() => createDefinition({
    ...definition(), id: 'worktree-read-only', reviewMode: 'worktree',
    permissionPreset: 'read-only', now: '2026-08-13T00:00:00Z',
  }), /worktree review requires workspace-write/)
  const reviewed = createDefinition({
    ...definition(), id: 'worktree-write', reviewMode: 'worktree',
    permissionPreset: 'workspace-write', now: '2026-08-13T00:00:00Z',
  })
  assert.equal(reviewed.reviewMode, 'worktree')
  assert.equal(createManualRun(reviewed, '2026-08-13T01:00:00Z').targetSnapshot.reviewMode, 'worktree')
})

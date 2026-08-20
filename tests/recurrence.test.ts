import assert from 'node:assert/strict'
import test from 'node:test'
import {
  latestDueOccurrence, nextOccurrence, normalizeSchedule, occurrencesBetween, scheduleToRRule,
} from '../src/recurrence.ts'

test('rejects short intervals and zones that are not explicit IANA names', () => {
  assert.throws(() => scheduleToRRule({
    kind: 'interval', everyMinutes: 4, anchor: '2026-08-13T00:00:00Z', timeZone: 'Asia/Shanghai',
  }), /at least 5/)
  assert.throws(() => scheduleToRRule({
    kind: 'daily', time: '09:00', timeZone: 'local',
  }), /explicit IANA zone/)
  assert.match(scheduleToRRule({ kind: 'daily', time: '09:00', timeZone: 'UTC' }), /TZID=UTC/)
})

test('emits RFC 5545 lines and normalizes weekly day order', () => {
  const schedule = normalizeSchedule({
    kind: 'weekly', weekdays: ['FR', 'MO'], time: '09:30', timeZone: 'Asia/Shanghai',
  })
  assert.equal(schedule.kind, 'weekly')
  if (schedule.kind !== 'weekly') throw new Error('expected normalized weekly schedule')
  assert.deepEqual(schedule.weekdays, ['MO', 'FR'])
  const rule = scheduleToRRule(schedule)
  assert.match(rule, /^DTSTART;TZID=Asia\/Shanghai:\d{8}T093000\n/)
  assert.match(rule, /RRULE:FREQ=WEEKLY;BYDAY=MO,FR;BYHOUR=9;BYMINUTE=30;BYSECOND=0$/)
})

test('interval occurrences are fixed-rate and exclusive of the lower bound', () => {
  const schedule = {
    kind: 'interval' as const,
    everyMinutes: 15,
    anchor: '2026-08-13T00:00:00Z',
    timeZone: 'Etc/UTC',
  }
  assert.deepEqual(
    occurrencesBetween(schedule, '2026-08-13T00:00:00Z', '2026-08-13T00:45:00Z', 10),
    [
      '2026-08-13T00:15:00.000Z',
      '2026-08-13T00:30:00.000Z',
      '2026-08-13T00:45:00.000Z',
    ],
  )
  assert.equal(latestDueOccurrence(schedule, '2026-08-13T00:14:59Z'), null)
  assert.equal(latestDueOccurrence(schedule, '2026-08-13T00:15:00Z'), '2026-08-13T00:15:00.000Z')
  assert.equal(latestDueOccurrence(schedule, '2026-08-13T00:44:00Z'), '2026-08-13T00:30:00.000Z')
  assert.equal(nextOccurrence(schedule, '2026-08-12T23:59:00Z'), '2026-08-13T00:15:00.000Z')
  assert.match(scheduleToRRule(schedule), /^DTSTART:20260813T001500Z\n/)
})

test('daily recurrence keeps local wall time across fall-back DST', () => {
  const schedule = { kind: 'daily' as const, time: '09:00', timeZone: 'America/New_York' }
  assert.deepEqual(
    occurrencesBetween(schedule, '2026-10-31T12:00:00Z', '2026-11-02T15:00:00Z'),
    [
      '2026-10-31T13:00:00.000Z',
      '2026-11-01T14:00:00.000Z',
      '2026-11-02T14:00:00.000Z',
    ],
  )
})

test('nonexistent spring-forward wall time is skipped, not shifted', () => {
  const schedule = { kind: 'daily' as const, time: '02:30', timeZone: 'America/New_York' }
  assert.deepEqual(
    occurrencesBetween(schedule, '2026-03-07T00:00:00Z', '2026-03-10T00:00:00Z'),
    ['2026-03-07T07:30:00.000Z', '2026-03-09T06:30:00.000Z'],
  )
})

test('weekly selection and one-shot next occurrence are bounded correctly', () => {
  assert.deepEqual(occurrencesBetween(
    { kind: 'weekly', weekdays: ['MO', 'WE'], time: '10:00', timeZone: 'Asia/Shanghai' },
    '2026-08-09T00:00:00Z',
    '2026-08-15T00:00:00Z',
  ), ['2026-08-10T02:00:00.000Z', '2026-08-12T02:00:00.000Z'])
  assert.equal(nextOccurrence(
    { kind: 'once', at: '2026-08-13T09:00:00+08:00', timeZone: 'Asia/Shanghai' },
    '2026-08-13T00:00:00Z',
  ), '2026-08-13T01:00:00.000Z')
})

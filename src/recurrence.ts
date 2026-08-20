import { DateTime, IANAZone } from 'luxon'
import type { AutomationSchedule, Weekday } from './types.ts'

const WEEKDAY_NUMBERS: Readonly<Record<Weekday, number>> = {
  MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 7,
}
const WEEKDAY_ORDER = Object.keys(WEEKDAY_NUMBERS) as Weekday[]
const LOCAL_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function assertValidSchedule(schedule: AutomationSchedule): void {
  assertTimeZone(schedule.timeZone)
  if (schedule.kind === 'once') {
    parseInstant(schedule.at, 'once.at')
    return
  }
  if (schedule.kind === 'interval') {
    if (!Number.isInteger(schedule.everyMinutes) || schedule.everyMinutes < 5) {
      throw new Error('interval.everyMinutes must be an integer of at least 5')
    }
    parseInstant(schedule.anchor, 'interval.anchor')
    return
  }
  if (!LOCAL_TIME.test(schedule.time)) {
    throw new Error(`${schedule.kind}.time must use 24-hour HH:mm format`)
  }
  if (schedule.kind === 'weekly') {
    if (schedule.weekdays.length === 0) throw new Error('weekly.weekdays must not be empty')
    if (new Set(schedule.weekdays).size !== schedule.weekdays.length) {
      throw new Error('weekly.weekdays must not contain duplicates')
    }
    for (const weekday of schedule.weekdays) {
      if (!(weekday in WEEKDAY_NUMBERS)) throw new Error(`invalid weekday '${weekday}'`)
    }
  }
}

export function normalizeSchedule(schedule: AutomationSchedule): AutomationSchedule {
  assertValidSchedule(schedule)
  if (schedule.kind !== 'weekly') return schedule
  const selected = new Set(schedule.weekdays)
  return { ...schedule, weekdays: WEEKDAY_ORDER.filter(day => selected.has(day)) }
}

export function scheduleToRRule(schedule: AutomationSchedule): string {
  const normalized = normalizeSchedule(schedule)
  if (normalized.kind === 'once') {
    const at = parseInstant(normalized.at, 'once.at').toUTC()
    return `DTSTART:${formatUtc(at)}\nRRULE:FREQ=DAILY;COUNT=1`
  }
  if (normalized.kind === 'interval') {
    const first = parseInstant(normalized.anchor, 'interval.anchor')
      .toUTC()
      .plus({ minutes: normalized.everyMinutes })
    return `DTSTART:${formatUtc(first)}\nRRULE:FREQ=MINUTELY;INTERVAL=${normalized.everyMinutes}`
  }
  const [hour, minute] = parseLocalTime(normalized.time)
  // DTSTART is a deterministic shape anchor. Actual due-time calculation is
  // performed by occurrencesBetween and is not constrained to this date.
  const base = DateTime.fromObject({ year: 1970, month: 1, day: 5 }, { zone: normalized.timeZone })
  const start = firstValidLocalOccurrence(normalized, base, hour, minute)
  const byDay = normalized.kind === 'weekly' ? `;BYDAY=${normalized.weekdays.join(',')}` : ''
  const frequency = normalized.kind === 'weekly' ? 'WEEKLY' : 'DAILY'
  return `DTSTART;TZID=${normalized.timeZone}:${formatLocal(start)}\nRRULE:FREQ=${frequency}${byDay};BYHOUR=${hour};BYMINUTE=${minute};BYSECOND=0`
}

export function nextOccurrence(schedule: AutomationSchedule, afterExclusive: string): string | null {
  const values = occurrencesBetween(schedule, afterExclusive, farFutureIso, 1)
  return values[0] ?? null
}

/** Latest scheduled occurrence at or before `now`, without materializing a backlog. */
export function latestDueOccurrence(schedule: AutomationSchedule, now: string): string | null {
  assertValidSchedule(schedule)
  const nowMs = parseInstant(now, 'now').toMillis()
  if (schedule.kind === 'once') {
    const at = parseInstant(schedule.at, 'once.at').toMillis()
    return at <= nowMs ? DateTime.fromMillis(at, { zone: 'utc' }).toISO() : null
  }
  if (schedule.kind === 'interval') {
    const anchor = parseInstant(schedule.anchor, 'interval.anchor').toMillis()
    const step = schedule.everyMinutes * 60_000
    // The anchor fixes cadence; it is not itself a run. "Every 30 minutes"
    // created now first fires 30 minutes from now, never immediately.
    if (anchor + step > nowMs) return null
    return DateTime.fromMillis(
      anchor + Math.floor((nowMs - anchor) / step) * step,
      { zone: 'utc' },
    ).toISO()
  }
  const lookbackDays = schedule.kind === 'daily' ? 2 : 8
  const values = occurrencesBetween(
    schedule,
    DateTime.fromMillis(nowMs - lookbackDays * 86_400_000, { zone: 'utc' }).toISO()!,
    DateTime.fromMillis(nowMs, { zone: 'utc' }).toISO()!,
    16,
  )
  return values.at(-1) ?? null
}

export function occurrencesBetween(
  schedule: AutomationSchedule,
  afterExclusive: string,
  untilInclusive: string,
  limit = 1_000,
): string[] {
  const normalized = normalizeSchedule(schedule)
  const after = parseInstant(afterExclusive, 'afterExclusive').toUTC()
  const until = parseInstant(untilInclusive, 'untilInclusive').toUTC()
  if (until < after || !Number.isInteger(limit) || limit < 1) return []

  if (normalized.kind === 'once') {
    const at = parseInstant(normalized.at, 'once.at').toUTC()
    return at > after && at <= until ? [at.toISO()!] : []
  }
  if (normalized.kind === 'interval') {
    return intervalOccurrences(normalized.anchor, normalized.everyMinutes, after, until, limit)
  }

  const [hour, minute] = parseLocalTime(normalized.time)
  const allowed = normalized.kind === 'weekly'
    ? new Set(normalized.weekdays.map(day => WEEKDAY_NUMBERS[day]))
    : null
  const values: string[] = []
  let date = after.setZone(normalized.timeZone).startOf('day')
  const finalLocalDate = until.setZone(normalized.timeZone).startOf('day')
  while (date <= finalLocalDate && values.length < limit) {
    if (allowed === null || allowed.has(date.weekday)) {
      const candidate = localCandidate(date, hour, minute, normalized.timeZone)
      if (candidate !== null) {
        const utc = candidate.toUTC()
        if (utc > after && utc <= until) values.push(utc.toISO()!)
      }
    }
    date = date.plus({ days: 1 })
  }
  return values
}

function intervalOccurrences(
  anchorIso: string,
  everyMinutes: number,
  after: DateTime,
  until: DateTime,
  limit: number,
): string[] {
  const anchor = parseInstant(anchorIso, 'interval.anchor').toUTC()
  const stepMs = everyMinutes * 60_000
  const elapsed = after.toMillis() - anchor.toMillis()
  // The anchor establishes cadence; the first occurrence is one full
  // interval later. This matches the persisted RRULE and due scanner.
  const steps = Math.max(1, Math.floor(elapsed / stepMs) + 1)
  let candidateMs = anchor.toMillis() + steps * stepMs
  const values: string[] = []
  while (candidateMs <= until.toMillis() && values.length < limit) {
    values.push(DateTime.fromMillis(candidateMs, { zone: 'utc' }).toISO()!)
    candidateMs += stepMs
  }
  return values
}

function firstValidLocalOccurrence(
  schedule: Exclude<AutomationSchedule, { kind: 'once' | 'interval' }>,
  from: DateTime,
  hour: number,
  minute: number,
): DateTime {
  const allowed = schedule.kind === 'weekly'
    ? new Set(schedule.weekdays.map(day => WEEKDAY_NUMBERS[day]))
    : null
  for (let offset = 0; offset < 8; offset += 1) {
    const date = from.startOf('day').plus({ days: offset })
    if (allowed !== null && !allowed.has(date.weekday)) continue
    const value = localCandidate(date, hour, minute, schedule.timeZone)
    if (value !== null && value >= from) return value
  }
  throw new Error('schedule has no valid local occurrence in the next week')
}

function localCandidate(date: DateTime, hour: number, minute: number, zone: string): DateTime | null {
  const value = DateTime.fromObject(
    { year: date.year, month: date.month, day: date.day, hour, minute, second: 0, millisecond: 0 },
    { zone },
  )
  // Luxon shifts nonexistent spring-forward wall times; skipping is explicit and stable.
  return value.isValid && value.hour === hour && value.minute === minute ? value : null
}

function parseInstant(value: string, field: string): DateTime {
  const parsed = DateTime.fromISO(value, { setZone: true })
  if (!parsed.isValid || parsed.offsetNameShort === null || !/(?:Z|[+-]\d\d:\d\d)$/.test(value)) {
    throw new Error(`${field} must be an ISO-8601 instant with an explicit offset`)
  }
  return parsed
}

function assertTimeZone(zone: string): void {
  if (!IANAZone.isValidZone(zone)) {
    throw new Error(`timeZone '${zone}' must be an explicit IANA zone such as Asia/Shanghai`)
  }
}

function parseLocalTime(value: string): [number, number] {
  const [hour, minute] = value.split(':').map(Number)
  return [hour!, minute!]
}

function formatUtc(value: DateTime): string {
  return value.toFormat("yyyyMMdd'T'HHmmss'Z'")
}

function formatLocal(value: DateTime): string {
  return value.toFormat("yyyyMMdd'T'HHmmss")
}

const farFutureIso = '9999-12-31T23:59:59.999Z'

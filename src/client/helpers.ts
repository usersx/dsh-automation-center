import type { Translate } from './contracts.js'
import type { AutomationLocaleKey } from './locales.js'
import type {
  AutomationSchedule,
  AutomationRunStatus,
  AutomationSnapshot,
  AutomationViewModel,
  CreateAutomationInput,
  UpdateAutomationInput,
} from './protocol.js'
import { nextOccurrence } from '../recurrence.js'

export type ScheduleKind = 'once' | 'interval' | 'daily' | 'weekly'

export interface AutomationFormState {
  readonly name: string
  readonly prompt: string
  readonly scheduleKind: ScheduleKind
  readonly onceAt: string
  readonly everyMinutes: string
  readonly intervalAnchor?: string
  readonly time: string
  readonly weekdays: readonly number[]
  readonly timeZone: string
  readonly permission: CreateAutomationInput['permission']
  readonly workspaceId: string
  readonly agentPreset: string
  readonly runTimeoutMinutes: string
}

export type FormErrorKey =
  | 'form.error.name'
  | 'form.error.prompt'
  | 'form.error.once'
  | 'form.error.interval'
  | 'form.error.weekdays'
  | 'form.error.workspace'
  | 'form.error.preset'
  | 'form.error.timeout'

export class AutomationFormError extends Error {
  constructor(readonly key: FormErrorKey) {
    super(key)
  }
}

export function localDateTimeValue(date = new Date()): string {
  const future = new Date(date.getTime() + 60 * 60 * 1000)
  future.setMinutes(0, 0, 0)
  const offset = future.getTimezoneOffset() * 60_000
  return new Date(future.getTime() - offset).toISOString().slice(0, 16)
}

export function defaultFormState(
  now = new Date(), workspaceId = '', agentPreset = 'standard',
): AutomationFormState {
  return {
    name: '',
    prompt: '',
    scheduleKind: 'daily',
    onceAt: localDateTimeValue(now),
    everyMinutes: '60',
    time: '09:00',
    weekdays: [1, 2, 3, 4, 5],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    permission: 'read-only',
    workspaceId,
    agentPreset,
    runTimeoutMinutes: '60',
  }
}

function exactLocalDateTimeValue(iso: string): string {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

/** Build an editable draft from the complete durable definition, not its card preview. */
export function formStateFromAutomation(automation: AutomationViewModel): AutomationFormState {
  const defaults = defaultFormState()
  const schedule = automation.schedule
  return {
    ...defaults,
    name: automation.name,
    prompt: automation.prompt,
    scheduleKind: schedule.kind,
    onceAt: schedule.kind === 'once' ? exactLocalDateTimeValue(schedule.at) : defaults.onceAt,
    everyMinutes: schedule.kind === 'interval' ? String(schedule.everyMinutes) : defaults.everyMinutes,
    ...(schedule.kind === 'interval' && schedule.anchor !== undefined
      ? { intervalAnchor: schedule.anchor }
      : {}),
    time: schedule.kind === 'daily' || schedule.kind === 'weekly' ? schedule.time : defaults.time,
    weekdays: schedule.kind === 'weekly' ? [...schedule.weekdays] : defaults.weekdays,
    timeZone: automation.timeZone,
    permission: automation.permission,
    workspaceId: automation.workspaceId,
    agentPreset: automation.agentPreset,
    runTimeoutMinutes: String(automation.runTimeoutMinutes),
  }
}

export function buildCreateInput(form: AutomationFormState, now = new Date()): CreateAutomationInput {
  const name = form.name.trim()
  const prompt = form.prompt.trim()
  if (name === '') throw new AutomationFormError('form.error.name')
  if (prompt === '') throw new AutomationFormError('form.error.prompt')
  if (form.workspaceId === '') throw new AutomationFormError('form.error.workspace')
  if (form.agentPreset === '') throw new AutomationFormError('form.error.preset')
  const runTimeoutMinutes = Number(form.runTimeoutMinutes)
  if (!Number.isInteger(runTimeoutMinutes) || runTimeoutMinutes < 1 || runTimeoutMinutes > 1_440) {
    throw new AutomationFormError('form.error.timeout')
  }

  let schedule: CreateAutomationInput['schedule']
  switch (form.scheduleKind) {
    case 'once': {
      const at = new Date(form.onceAt)
      if (!Number.isFinite(at.getTime()) || at.getTime() <= now.getTime()) {
        throw new AutomationFormError('form.error.once')
      }
      schedule = { kind: 'once', at: at.toISOString(), timeZone: form.timeZone }
      break
    }
    case 'interval': {
      const everyMinutes = Number(form.everyMinutes)
      if (!Number.isInteger(everyMinutes) || everyMinutes < 5 || everyMinutes > 43_200) {
        throw new AutomationFormError('form.error.interval')
      }
      schedule = {
        kind: 'interval',
        everyMinutes,
        anchor: form.intervalAnchor ?? now.toISOString(),
        timeZone: form.timeZone,
      }
      break
    }
    case 'daily':
      schedule = { kind: 'daily', time: form.time, timeZone: form.timeZone }
      break
    case 'weekly':
      if (form.weekdays.length === 0) throw new AutomationFormError('form.error.weekdays')
      schedule = { kind: 'weekly', time: form.time, weekdays: [...form.weekdays].sort((a, b) => a - b), timeZone: form.timeZone }
      break
  }
  return {
    name, prompt, schedule, timeZone: form.timeZone, permission: form.permission,
    workspaceId: form.workspaceId,
    agentPreset: form.agentPreset,
    runTimeoutMinutes,
  }
}

/** Best-effort live preview; invalid drafts remain editable and show no misleading date. */
export function previewNextRun(form: AutomationFormState, now = new Date()): string | undefined {
  try {
    const common = { timeZone: form.timeZone }
    const schedule = form.scheduleKind === 'once'
      ? { kind: 'once' as const, at: new Date(form.onceAt).toISOString(), ...common }
      : form.scheduleKind === 'interval'
        ? {
            kind: 'interval' as const,
            everyMinutes: Number(form.everyMinutes),
            anchor: form.intervalAnchor ?? now.toISOString(),
            ...common,
          }
        : form.scheduleKind === 'daily'
          ? { kind: 'daily' as const, time: form.time, ...common }
          : {
              kind: 'weekly' as const,
              time: form.time,
              weekdays: form.weekdays.map(day => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][day - 1]!) as Array<'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'>,
              ...common,
            }
    return nextOccurrence(schedule, now.toISOString()) ?? undefined
  } catch {
    return undefined
  }
}

function scheduleMatchesDraft(form: AutomationFormState, automation: AutomationViewModel): boolean {
  const schedule = automation.schedule
  if (form.scheduleKind !== schedule.kind || form.timeZone !== automation.timeZone) return false
  switch (schedule.kind) {
    case 'once':
      return form.onceAt === exactLocalDateTimeValue(schedule.at)
    case 'interval':
      return form.everyMinutes === String(schedule.everyMinutes)
        && form.intervalAnchor === schedule.anchor
    case 'daily':
      return form.time === schedule.time
    case 'weekly':
      return form.time === schedule.time
        && [...form.weekdays].sort((a, b) => a - b).join(',') === [...schedule.weekdays].sort((a, b) => a - b).join(',')
  }
}

/** Return only changed fields so editing a completed one-shot does not resubmit its past schedule. */
export function buildUpdateInput(
  form: AutomationFormState,
  automation: AutomationViewModel,
  now = new Date(),
): UpdateAutomationInput {
  const name = form.name.trim()
  const prompt = form.prompt.trim()
  if (name === '') throw new AutomationFormError('form.error.name')
  if (prompt === '') throw new AutomationFormError('form.error.prompt')
  if (form.agentPreset === '') throw new AutomationFormError('form.error.preset')
  const runTimeoutMinutes = Number(form.runTimeoutMinutes)
  if (!Number.isInteger(runTimeoutMinutes) || runTimeoutMinutes < 1 || runTimeoutMinutes > 1_440) {
    throw new AutomationFormError('form.error.timeout')
  }

  const scheduleChanged = !scheduleMatchesDraft(form, automation)
  const replacement = scheduleChanged ? buildCreateInput(form, now) : undefined
  return {
    ...(name === automation.name ? {} : { name }),
    ...(prompt === automation.prompt ? {} : { prompt }),
    ...(replacement === undefined ? {} : {
      schedule: replacement.schedule,
      timeZone: replacement.timeZone,
    }),
    ...(form.permission === automation.permission ? {} : { permission: form.permission }),
    ...(form.agentPreset === automation.agentPreset ? {} : { agentPreset: form.agentPreset }),
    ...(runTimeoutMinutes === automation.runTimeoutMinutes
      ? {}
      : { runTimeoutMinutes }),
  }
}

const ATTENTION_STATUSES = new Set<AutomationRunStatus>(['failed', 'interrupted'])

export interface OverviewStats {
  readonly total: number
  readonly active: number
  readonly attention: number
  readonly nextRunAt?: string
}

export function deriveOverview(snapshot: AutomationSnapshot): OverviewStats {
  const next = snapshot.automations
    .filter(item => item.status === 'active' && item.nextRunAt !== undefined)
    .map(item => item.nextRunAt as string)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0]
  return {
    total: snapshot.automations.length,
    active: snapshot.automations.filter(item => item.status === 'active').length,
    attention: snapshot.runs.filter(run => ATTENTION_STATUSES.has(run.status) && run.unread !== false).length,
    ...(next === undefined ? {} : { nextRunAt: next }),
  }
}

export function formatRelativeTime(iso: string, now: Date, t: Translate): string {
  const value = Date.parse(iso)
  if (!Number.isFinite(value)) return iso
  const deltaMinutes = Math.round((value - now.getTime()) / 60_000)
  const abs = Math.abs(deltaMinutes)
  if (abs < 1) return t('time.now')
  const future = deltaMinutes > 0
  if (abs < 60) return t(future ? 'time.inMinute' : 'time.minuteAgo', { count: abs })
  const hours = Math.round(abs / 60)
  if (hours < 24) return t(future ? 'time.inHour' : 'time.hourAgo', { count: hours })
  const days = Math.round(hours / 24)
  return t(future ? 'time.inDay' : 'time.dayAgo', { count: days })
}

export function shortSessionId(sessionId: string): string {
  return sessionId.length <= 12 ? sessionId : `${sessionId.slice(0, 8)}…${sessionId.slice(-4)}`
}

export function formatSchedule(schedule: AutomationSchedule, t: Translate): string {
  switch (schedule.kind) {
    case 'once':
      return t('schedule.onceAt', {
        time: new Date(schedule.at).toLocaleString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
        }),
      })
    case 'interval':
      return t('schedule.everyMinutes', { count: schedule.everyMinutes })
    case 'daily':
      return t('schedule.dailyAt', { time: schedule.time })
    case 'weekly':
      return t('schedule.weeklyAt', {
        days: schedule.weekdays.map(day => t(`day.${day}` as AutomationLocaleKey)).join(' · '),
        time: schedule.time,
      })
  }
}

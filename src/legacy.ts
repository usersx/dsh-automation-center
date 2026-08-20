/** Read-only compatibility contract for titanwings/dsh-automation v1 data. */

import { z } from 'zod'

const nonBlank = z.string().trim().min(1)
const instant = z.string().datetime({ offset: true })
const timeZone = nonBlank
const weekday = z.enum(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])
const schedule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('once'), at: instant, timeZone }),
  z.object({ kind: z.literal('interval'), everyMinutes: z.number().int().min(5), anchor: instant, timeZone }),
  z.object({ kind: z.literal('daily'), time: z.string(), timeZone }),
  z.object({ kind: z.literal('weekly'), weekdays: z.array(weekday).min(1), time: z.string(), timeZone }),
])
const permission = z.enum(['read-only', 'workspace-write'])
const target = z.object({
  workspaceId: nonBlank,
  cwd: nonBlank,
  agentPreset: nonBlank,
  provider: z.string().nullable(),
  model: z.string().nullable(),
  permissionPreset: permission,
})

export const legacyDefinitionSchema = z.object({
  version: z.literal(1),
  id: nonBlank,
  revision: z.number().int().positive(),
  name: nonBlank,
  prompt: nonBlank,
  status: z.enum(['active', 'paused']),
  schedule,
  rrule: nonBlank,
  timeZone,
  workspaceId: nonBlank,
  cwd: nonBlank,
  agentPreset: nonBlank,
  provider: z.string().nullable(),
  model: z.string().nullable(),
  permissionPreset: permission,
  createdBy: z.object({ kind: z.enum(['agent', 'web']), sessionId: nonBlank }),
  createdAt: instant,
  updatedAt: instant,
})

export const legacyRunSchema = z.object({
  version: z.literal(1),
  id: nonBlank,
  automationId: nonBlank,
  definitionRevision: z.number().int().positive(),
  occurrenceKey: nonBlank,
  trigger: z.enum(['schedule', 'manual']),
  scheduledFor: instant,
  status: z.enum(['queued', 'running', 'succeeded', 'failed', 'skipped', 'cancelled']),
  promptSnapshot: nonBlank,
  targetSnapshot: target,
  sessionId: z.string().nullable(),
  startedAt: instant.nullable(),
  finishedAt: instant.nullable(),
  summary: z.string().nullable(),
  error: z.object({ code: nonBlank, message: nonBlank }).nullable(),
  unread: z.boolean(),
})

export type LegacyDefinition = z.infer<typeof legacyDefinitionSchema>
export type LegacyRun = z.infer<typeof legacyRunSchema>

/** Opening this domain never deletes or updates source records. */
export const legacyAutomationDomainSpec = {
  name: 'dsh_automation',
  version: 1,
  tables: {
    definitions: { valueSchema: legacyDefinitionSchema },
    runs: { valueSchema: legacyRunSchema },
  },
} as const

export interface LegacyMigrationSummary {
  readonly detectedDefinitions: number
  readonly detectedRuns: number
  readonly importedDefinitions: number
  readonly importedRuns: number
}

/** Read-only compatibility contract for titanwings/dsh-automation v1 data. */
import { z } from 'zod';
export declare const legacyDefinitionSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    id: z.ZodString;
    revision: z.ZodNumber;
    name: z.ZodString;
    prompt: z.ZodString;
    status: z.ZodEnum<{
        active: "active";
        paused: "paused";
    }>;
    schedule: z.ZodDiscriminatedUnion<[z.ZodObject<{
        kind: z.ZodLiteral<"once">;
        at: z.ZodString;
        timeZone: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"interval">;
        everyMinutes: z.ZodNumber;
        anchor: z.ZodString;
        timeZone: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"daily">;
        time: z.ZodString;
        timeZone: z.ZodString;
    }, z.core.$strip>, z.ZodObject<{
        kind: z.ZodLiteral<"weekly">;
        weekdays: z.ZodArray<z.ZodEnum<{
            MO: "MO";
            TU: "TU";
            WE: "WE";
            TH: "TH";
            FR: "FR";
            SA: "SA";
            SU: "SU";
        }>>;
        time: z.ZodString;
        timeZone: z.ZodString;
    }, z.core.$strip>], "kind">;
    rrule: z.ZodString;
    timeZone: z.ZodString;
    workspaceId: z.ZodString;
    cwd: z.ZodString;
    agentPreset: z.ZodString;
    provider: z.ZodNullable<z.ZodString>;
    model: z.ZodNullable<z.ZodString>;
    permissionPreset: z.ZodEnum<{
        "read-only": "read-only";
        "workspace-write": "workspace-write";
    }>;
    createdBy: z.ZodObject<{
        kind: z.ZodEnum<{
            agent: "agent";
            web: "web";
        }>;
        sessionId: z.ZodString;
    }, z.core.$strip>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, z.core.$strip>;
export declare const legacyRunSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    id: z.ZodString;
    automationId: z.ZodString;
    definitionRevision: z.ZodNumber;
    occurrenceKey: z.ZodString;
    trigger: z.ZodEnum<{
        schedule: "schedule";
        manual: "manual";
    }>;
    scheduledFor: z.ZodString;
    status: z.ZodEnum<{
        queued: "queued";
        running: "running";
        succeeded: "succeeded";
        failed: "failed";
        skipped: "skipped";
        cancelled: "cancelled";
    }>;
    promptSnapshot: z.ZodString;
    targetSnapshot: z.ZodObject<{
        workspaceId: z.ZodString;
        cwd: z.ZodString;
        agentPreset: z.ZodString;
        provider: z.ZodNullable<z.ZodString>;
        model: z.ZodNullable<z.ZodString>;
        permissionPreset: z.ZodEnum<{
            "read-only": "read-only";
            "workspace-write": "workspace-write";
        }>;
    }, z.core.$strip>;
    sessionId: z.ZodNullable<z.ZodString>;
    startedAt: z.ZodNullable<z.ZodString>;
    finishedAt: z.ZodNullable<z.ZodString>;
    summary: z.ZodNullable<z.ZodString>;
    error: z.ZodNullable<z.ZodObject<{
        code: z.ZodString;
        message: z.ZodString;
    }, z.core.$strip>>;
    unread: z.ZodBoolean;
}, z.core.$strip>;
export type LegacyDefinition = z.infer<typeof legacyDefinitionSchema>;
export type LegacyRun = z.infer<typeof legacyRunSchema>;
/** Opening this domain never deletes or updates source records. */
export declare const legacyAutomationDomainSpec: {
    readonly name: "dsh_automation";
    readonly version: 1;
    readonly tables: {
        readonly definitions: {
            readonly valueSchema: z.ZodObject<{
                version: z.ZodLiteral<1>;
                id: z.ZodString;
                revision: z.ZodNumber;
                name: z.ZodString;
                prompt: z.ZodString;
                status: z.ZodEnum<{
                    active: "active";
                    paused: "paused";
                }>;
                schedule: z.ZodDiscriminatedUnion<[z.ZodObject<{
                    kind: z.ZodLiteral<"once">;
                    at: z.ZodString;
                    timeZone: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    kind: z.ZodLiteral<"interval">;
                    everyMinutes: z.ZodNumber;
                    anchor: z.ZodString;
                    timeZone: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    kind: z.ZodLiteral<"daily">;
                    time: z.ZodString;
                    timeZone: z.ZodString;
                }, z.core.$strip>, z.ZodObject<{
                    kind: z.ZodLiteral<"weekly">;
                    weekdays: z.ZodArray<z.ZodEnum<{
                        MO: "MO";
                        TU: "TU";
                        WE: "WE";
                        TH: "TH";
                        FR: "FR";
                        SA: "SA";
                        SU: "SU";
                    }>>;
                    time: z.ZodString;
                    timeZone: z.ZodString;
                }, z.core.$strip>], "kind">;
                rrule: z.ZodString;
                timeZone: z.ZodString;
                workspaceId: z.ZodString;
                cwd: z.ZodString;
                agentPreset: z.ZodString;
                provider: z.ZodNullable<z.ZodString>;
                model: z.ZodNullable<z.ZodString>;
                permissionPreset: z.ZodEnum<{
                    "read-only": "read-only";
                    "workspace-write": "workspace-write";
                }>;
                createdBy: z.ZodObject<{
                    kind: z.ZodEnum<{
                        agent: "agent";
                        web: "web";
                    }>;
                    sessionId: z.ZodString;
                }, z.core.$strip>;
                createdAt: z.ZodString;
                updatedAt: z.ZodString;
            }, z.core.$strip>;
        };
        readonly runs: {
            readonly valueSchema: z.ZodObject<{
                version: z.ZodLiteral<1>;
                id: z.ZodString;
                automationId: z.ZodString;
                definitionRevision: z.ZodNumber;
                occurrenceKey: z.ZodString;
                trigger: z.ZodEnum<{
                    schedule: "schedule";
                    manual: "manual";
                }>;
                scheduledFor: z.ZodString;
                status: z.ZodEnum<{
                    queued: "queued";
                    running: "running";
                    succeeded: "succeeded";
                    failed: "failed";
                    skipped: "skipped";
                    cancelled: "cancelled";
                }>;
                promptSnapshot: z.ZodString;
                targetSnapshot: z.ZodObject<{
                    workspaceId: z.ZodString;
                    cwd: z.ZodString;
                    agentPreset: z.ZodString;
                    provider: z.ZodNullable<z.ZodString>;
                    model: z.ZodNullable<z.ZodString>;
                    permissionPreset: z.ZodEnum<{
                        "read-only": "read-only";
                        "workspace-write": "workspace-write";
                    }>;
                }, z.core.$strip>;
                sessionId: z.ZodNullable<z.ZodString>;
                startedAt: z.ZodNullable<z.ZodString>;
                finishedAt: z.ZodNullable<z.ZodString>;
                summary: z.ZodNullable<z.ZodString>;
                error: z.ZodNullable<z.ZodObject<{
                    code: z.ZodString;
                    message: z.ZodString;
                }, z.core.$strip>>;
                unread: z.ZodBoolean;
            }, z.core.$strip>;
        };
    };
};
export interface LegacyMigrationSummary {
    readonly detectedDefinitions: number;
    readonly detectedRuns: number;
    readonly importedDefinitions: number;
    readonly importedRuns: number;
}

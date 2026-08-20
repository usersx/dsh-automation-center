import type { AutomationViewProps, Translate } from './contracts.js';
import type { AutomationRunViewModel } from './protocol.js';
export declare function RecentRun({ run, now, t, busy, onOpen, onMarkRead, onCancel }: {
    run: AutomationRunViewModel;
    now: Date;
    t: Translate;
    busy: boolean;
    onOpen: (runId: string, sessionId: string) => void;
    onMarkRead: (runId: string) => void;
    onCancel: (runId: string) => void;
}): JSX.Element;
/** Shared Automation Center view; all data and effects arrive through the selected Surface Adapter. */
export declare function AutomationView({ t, useAutomationState, refresh, createAutomation, updateAutomation, mutateAutomation, runNow, markRunRead, cancelRun, openSession, }: AutomationViewProps): JSX.Element;

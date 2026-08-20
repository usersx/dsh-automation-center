import { useEffect } from 'react'
import type { AutomationSidebarActionProps } from './contracts.js'
import { AutomationIcon } from './icons.js'

const BADGE_POLL_MS = 30_000

/** Root-level product action shown directly below New Session. */
export function AutomationSidebarAction({
  t, renderAction, useAutomationState, useShellSurface, refresh, open,
}: AutomationSidebarActionProps): JSX.Element {
  const state = useAutomationState(value => value)
  const active = useShellSurface(surface => surface.kind === 'page' && surface.pageId === 'automation')
  const attention = state.snapshot?.runs.filter(run => run.unread !== false
    && (run.status === 'failed' || run.status === 'interrupted' || run.status === 'skipped')).length ?? 0

  useEffect(() => {
    void refresh().catch(() => undefined)
    const timer = window.setInterval(() => { void refresh().catch(() => undefined) }, BADGE_POLL_MS)
    return () => { window.clearInterval(timer) }
  }, [refresh])

  if (renderAction === undefined) {
    throw new Error('DSH_AUTOMATION_INCOMPATIBLE: the sidebar shell does not provide host-owned primary action chrome')
  }
  return <>{renderAction({
    label: t('tab'),
    icon: <AutomationIcon />,
    active,
    ...(attention === 0 ? {} : {
      badge: { label: t('stats.attention'), value: attention > 99 ? '99+' : String(attention) },
    }),
    onClick: open,
  })}</>
}

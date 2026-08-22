/** Fresh-Agent execution boundary for one already-claimed automation run. */

import { installModelSelection, type ModelSelection } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-default-model'
import type {} from '@deepseek-ai/dsh-agent-presets'
import type { Context } from '@deepseek-ai/cordis'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { setSandboxMode } from '@deepseek-ai/dsh-sandbox-policy'
import { SessionId } from '@deepseek-ai/dsh-session'
import { setApprovalPolicy } from '@deepseek-ai/dsh-user-approval'
import { WorkspaceId } from '@deepseek-ai/dsh-workspace'
import type { ToolExecution } from '@deepseek-ai/dsh-tools'
import type { AutomationDefinition, AutomationRun, AutomationRunPhase } from './types.ts'

interface TextBlock { readonly type: string; readonly text?: string }
interface SessionEventLike {
  readonly seq: number
  readonly type: string
  readonly data: Record<string, any>
}

const UNATTENDED_TOOL_ALLOWLIST = new Set([
  'run_code',
  'bash', 'pwsh',
  'read', 'read_image', 'write', 'edit', 'str_replace_editor',
  'glob', 'grep', 'lsp',
  'web_search', 'web_fetch',
  'skill',
  'session_search', 'session_trace', 'session_event_read', 'session_event_search', 'session_event_trace',
])

/** Final scoped denial for capabilities that require a person or spawn another authority boundary. */
export function unattendedToolGuardReason(name: string, args: unknown): string | undefined {
  if ((name === 'bash' || name === 'pwsh')
    && typeof args === 'object' && args !== null
    && (args as Record<string, unknown>).run_in_background === true) {
    return 'Background processes are unavailable inside an unattended automation run.'
  }
  return UNATTENDED_TOOL_ALLOWLIST.has(name)
    ? undefined
    : `Tool '${name}' is not in the unattended automation capability allowlist.`
}

export interface RunCompletion {
  readonly sessionId?: string
  readonly status: 'succeeded' | 'failed' | 'cancelled'
  readonly summary?: string
  readonly error?: { readonly code: string; readonly message: string }
  readonly effectiveModel?: {
    readonly provider: string
    readonly model: string
    readonly reasoningEffort?: string
  }
}

export interface ExecutorConfig {
  readonly runTimeoutMs: number
  readonly sessionId: string
  readonly signal?: AbortSignal
  readonly onPhase?: (phase: Extract<AutomationRunPhase, 'executing' | 'settling'>, sideEffectsPossible: true) => Promise<void>
}

function abortCode(signal?: AbortSignal): string | undefined {
  if (signal?.aborted !== true) return undefined
  const reason = signal.reason
  return typeof reason === 'object' && reason !== null && 'code' in reason
    ? String((reason as { readonly code: unknown }).code)
    : 'cancelled'
}

function abortedCompletion(signal?: AbortSignal): RunCompletion | undefined {
  const code = abortCode(signal)
  if (code === undefined) return undefined
  return code === 'run_timeout'
    ? { status: 'failed', error: { code, message: 'The automation exceeded its whole-job time limit.' } }
    : { status: 'cancelled', error: { code: 'cancelled', message: 'The automation was cancelled before it started.' } }
}

/** Last assistant text and closed-turn reason for the interval owned by this run. */
export function summarizeRun(events: readonly SessionEventLike[], firstSeq: number): {
  readonly text: string
  readonly reason?: Record<string, any>
} {
  let started = false
  let text = ''
  let reason: Record<string, any> | undefined
  for (const event of events) {
    if (event.seq < firstSeq) continue
    if (event.type === 'turn/start') {
      started = true
      continue
    }
    if (!started) continue
    if (event.type === 'assistant/message') {
      const blocks = (event.data.message?.content ?? []) as readonly TextBlock[]
      const joined = blocks.filter(block => block.type === 'text')
        .map(block => block.text ?? '')
        .join('')
      if (joined !== '') text = joined
    }
    if (event.type === 'turn/end') reason = event.data.reason as Record<string, any>
  }
  return { text, ...(reason === undefined ? {} : { reason }) }
}

function boundSummary(value: string): string | undefined {
  const normalized = value.trim()
  if (normalized === '') return undefined
  return normalized.length <= 2_000 ? normalized : `${normalized.slice(0, 1_999)}…`
}

function reasonError(reason: Record<string, any> | undefined): { readonly code: string; readonly message: string } {
  if (reason === undefined) return { code: 'no_turn_result', message: 'The automation produced no closed turn.' }
  if (reason.kind === 'error') {
    return {
      code: typeof reason.error?.code === 'string' ? reason.error.code : 'agent_error',
      message: typeof reason.error?.message === 'string'
        ? reason.error.message
        : 'The automation Agent failed.',
    }
  }
  return { code: `turn_${String(reason.kind)}`, message: `The automation ended with ${String(reason.kind)}.` }
}

export function classifyExecutorError(error: unknown): { readonly code: string; readonly message: string } {
  const message = error instanceof Error ? error.message : 'The automation executor failed.'
  if (/preset/i.test(message)) return { code: 'preset_unavailable', message }
  if (/(provider|model)/i.test(message)) return { code: 'model_unavailable', message }
  if (/(permission|denied|approval)/i.test(message)) return { code: 'permission_denied', message }
  if (/(crash|closed unexpectedly|terminated unexpectedly)/i.test(message)) return { code: 'agent_crashed', message }
  return { code: 'executor_error', message }
}

/**
 * Execute exactly one durable run in a fresh root Agent. The new Session owns
 * no source-chat history or grant; policy and model selection are installed
 * before publication.
 */
export async function executeAutomationRun(
  ctx: Context,
  definition: AutomationDefinition,
  run: AutomationRun,
  config: ExecutorConfig,
): Promise<RunCompletion> {
  const alreadyAborted = abortedCompletion(config.signal)
  if (alreadyAborted !== undefined) return alreadyAborted
  const target = run.targetSnapshot
  const fallbackSelection = ctx.agentDefaultModel.currentSelection()
  const selection: ModelSelection = target.modelPolicy.mode === 'pinned'
    ? {
        provider: target.modelPolicy.provider,
        model: target.modelPolicy.model,
        ...(target.modelPolicy.reasoningEffort === undefined
          ? {}
          : { reasoningEffort: target.modelPolicy.reasoningEffort as ModelSelection['reasoningEffort'] }),
      }
    : fallbackSelection
  const effectiveModel = {
    provider: selection.provider,
    model: selection.model,
    ...(selection.reasoningEffort === undefined ? {} : { reasoningEffort: String(selection.reasoningEffort) }),
  }
  const workspace = ctx.workspaceRegistry.get(WorkspaceId(target.workspaceId))
  if (workspace === undefined) {
    return { status: 'failed', effectiveModel, error: { code: 'workspace_not_found', message: 'The target workspace no longer exists.' } }
  }
  if (await workspace.status() !== 'ok' || workspace.path !== target.cwd) {
    return { status: 'failed', effectiveModel, error: { code: 'workspace_unavailable', message: 'The target workspace directory is unavailable or changed.' } }
  }

  const sessionId = SessionId(config.sessionId)
  let handle: Awaited<ReturnType<Context['agents']['create']>> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let removeCancellationListener = () => {}
  try {
    handle = await ctx.agents.withoutInitiator(() => ctx.agents.create({
      sessionId,
      ...(config.signal === undefined ? {} : { signal: config.signal }),
      meta: { cwd: target.cwd, agentPreset: target.agentPreset },
      agentOptions: { provider: selection.provider, model: selection.model },
      setup: async (agentCtx: Context) => {
        await ctx.agentPresets.mount(agentCtx, target.agentPreset)
        installModelSelection(agentCtx, { current: selection, assembled: undefined })
        const agent = agentCtx.agent
        if (agent === undefined) throw new Error('automation setup has no scoped Agent')
        setSandboxMode(agent.session, target.permissionPreset)
        setApprovalPolicy(agent.session, 'never')
        agentCtx.tools.guard((exec: ToolExecution) => unattendedToolGuardReason(exec.name, exec.arguments))
      },
    }))
    await handle.agent.whenIdle()
    // Pin the Result Session to the durable task name before the first prompt.
    // A user-source title prevents the normal first-prompt provider from
    // replacing it with a workspace or generated fallback later in the run.
    ctx.sessionTitle.rename(handle.agent.session, definition.name)
    await workspace.attachSession(sessionId)
    const firstSeq = handle.agent.session.seq
    await config.onPhase?.('executing', true)
    handle.agent.followup(createUserMessage({
      content: [{ type: 'text', text: run.promptSnapshot }],
      source: {
        kind: 'automation',
        automationId: definition.id,
        runId: run.id,
        scheduledFor: run.scheduledFor,
      },
    }))

    let timedOut = false
    let aborted = false
    const idle = handle.agent.whenIdle()
    const deadline = new Promise<void>((resolve) => {
      timeout = setTimeout(() => {
        timedOut = true
        handle?.agent.cancel({ kind: 'hook', reason: 'automation run timeout' })
        resolve()
      }, config.runTimeoutMs)
    })
    const cancellation = new Promise<void>((resolve) => {
      if (config.signal === undefined) return
      const cancel = () => {
        if (abortCode(config.signal) === 'run_timeout') timedOut = true
        else aborted = true
        handle?.agent.cancel({ kind: 'hook', reason: timedOut ? 'automation run timeout' : 'automation service disposed' })
        resolve()
      }
      if (config.signal.aborted) cancel()
      else {
        config.signal.addEventListener('abort', cancel, { once: true })
        removeCancellationListener = () => { config.signal?.removeEventListener('abort', cancel) }
      }
    })
    await Promise.race([idle, deadline, cancellation])
    await config.onPhase?.('settling', true)
    removeCancellationListener()
    if (timedOut || aborted) await handle.agent.whenIdle()
    if (timeout !== undefined) clearTimeout(timeout)
    await ctx.sessions.flush(handle.agent.session)
    const outcome = summarizeRun(handle.agent.session.events, firstSeq)
    const summary = boundSummary(outcome.text)
    if (aborted) {
      return {
        sessionId: String(sessionId),
        status: 'cancelled',
        effectiveModel,
        ...(summary === undefined ? {} : { summary }),
        error: { code: 'cancelled', message: 'The automation was cancelled because its owner stopped.' },
      }
    }
    if (timedOut) {
      return {
        sessionId: String(sessionId),
        status: 'failed',
        effectiveModel,
        ...(summary === undefined ? {} : { summary }),
        error: { code: 'run_timeout', message: 'The automation exceeded its run time limit.' },
      }
    }
    if (outcome.reason?.kind === 'completed') {
      return { sessionId: String(sessionId), status: 'succeeded', effectiveModel, ...(summary === undefined ? {} : { summary }) }
    }
    return {
      sessionId: String(sessionId),
      status: 'failed',
      effectiveModel,
      ...(summary === undefined ? {} : { summary }),
      error: reasonError(outcome.reason),
    }
  } catch (error: unknown) {
    const cancelled = abortedCompletion(config.signal)
    if (cancelled !== undefined) {
      return {
        ...cancelled,
        ...(handle === undefined ? {} : { sessionId: String(sessionId) }),
        effectiveModel,
      }
    }
    return {
      ...(handle === undefined ? {} : { sessionId: String(sessionId) }),
      status: 'failed',
      effectiveModel,
      error: classifyExecutorError(error),
    }
  } finally {
    removeCancellationListener()
    if (timeout !== undefined) clearTimeout(timeout)
    await handle?.dispose().catch(() => {})
  }
}

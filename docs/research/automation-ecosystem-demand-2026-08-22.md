# Coding Agent 自动化生态与用户诉求调研

> 证据冻结时间：2026-08-22。  
> 目标项目：`dsh-automation-center@b5bb06e778b5dd969785ea7b480ee06f83b7c8f3`，版本 `0.1.0-alpha.5`。  
> 本文只使用 GitHub 仓库、README、Release、源码文档和 Issues 等一手资料。Stars 与 `pushed_at` 来自 GitHub API 当日快照，会继续变化。

## 结论先行

`dsh-automation-center` 已经不缺一个基本 Scheduler：Fresh Session、定义修订快照、确定性 occurrence、防重叠、有限 misfire、Host 中断标记、结构化错误和跨 Workspace 管理都已经存在。下一步不应继续把主要精力放在增加 Cron 预设。

真实 Issue 最集中的缺口是：

1. **无人看守时仍可靠**：任务不能因为 UI 没打开而停住；创建、恢复、超时、后台子任务和 Host 重启必须有明确收据和可恢复状态。
2. **只把真正需要用户处理的结果送到眼前**：区分 `no_change`、`needs_input`、`changes_ready`、`failed`，并允许按 Automation 配置静默成功、失败通知和留存策略。
3. **模型、推理程度和权限必须是 Definition 的显式快照**：不能只继承创建会话或全局默认值。
4. **可写代码任务需要隔离和接纳闭环**：worktree、diff、测试证据、保留/接受/丢弃，比再做一套 Cron 表单更能形成差异。
5. **Trigger、Execution、Delivery 应拆开**：时间只是一个 Trigger；GitHub/文件/MCP/after-run 等事件和通知、Issue、PR 等 Delivery 应通过 adapter 接入同一 Run 模型。

一句话定位建议：

> **让 DSH 在无人看守时可靠地完成有边界的工作；用户回来后只看真正需要处理的结果，并能安全审查和接纳代码。**

## 研究口径

- “用户明确反馈”只指 Issue 作者在标题或正文中直接描述的问题/请求。
- “工程判断”是本文基于多个一手来源对 `dsh-automation-center` 的推断，不代表 Issue 作者同意这个具体方案。
- Stars 只能说明仓库整体关注度；例如 `openai/codex` 的 Stars 不能当作 Automation 功能的独立受欢迎程度。
- DSH 插件与通用 Coding Agent 平台体量差异很大，表格按“直接竞品”“相邻产品”“跨生态基础设施”分层，避免横向误读。

## 1. 热门与代表性仓库

### 1.1 当前热度和活跃度

`pushed_at` 是仓库最后推送时间（UTC），比会被 Star、Issue 等活动扰动的 `updated_at` 更适合表示代码活跃度。

| 分层 | 仓库 | Stars | Open Issues/PRs | 最近推送 | 定位与可迁移能力 |
|---|---|---:|---:|---|---|
| 广义自主 Agent | [openclaw/openclaw](https://github.com/openclaw/openclaw) | 387,119 | — | 2026-08-22 15:20 | Gateway、消息渠道与常驻 Automation；体量不能与 DSH 插件直接比较，但 Cron 的漏跑、删除残留、迁移和交付问题是很强的可靠性样本。 |
| 产品问题样本 | [openai/codex](https://github.com/openai/codex) | 112,471 | 13,461 | 2026-08-22 05:57 | Codex 本体；其 Desktop Automation Issues 是当前最丰富的定时/后台任务用户问题样本。仓库 Stars 不等于 Automation Stars。 |
| 多 Agent 编排 | [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban) | 27,883 | — | 2026-04-24 09:17 | 多 Coding Agent、任务板与 worktree；仓库已停止原产品迭代，仍可作为“隔离资源清理必须 fail closed”的事故样本。 |
| 跨生态异步 Agent | [langchain-ai/open-swe](https://github.com/langchain-ai/open-swe) | 10,586 | 26 | 2026-08-22 13:23 | Slack/Linear/GitHub 触发、确定性 thread、消息队列、独立 Sandbox、并行运行、自动 Draft PR。 |
| GitHub 事件 Agent | [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) | 8,696 | 702 | 2026-08-22 14:47 | Claude Code 的 GitHub 事件执行面；Actions 提供审计、权限、超时和运行记录。 |
| 长周期控制面 | [huangruiteng/loopx](https://github.com/huangruiteng/loopx) | 5,016 | 40 | 2026-08-22 15:26 | 跨 Codex/Claude Code/DSH 的目标、Gate、Todo、Evidence、Quota、Handoff 和恢复控制面；最新 Release [v0.5.1](https://github.com/huangruiteng/loopx/releases/tag/v0.5.1)。 |
| Agentic Workflows | [github/gh-aw](https://github.com/github/gh-aw) | 4,978 | 386 | 2026-08-22 15:29 | Markdown 编译为 GitHub Actions Agent 工作流；schedule/manual/event、safe outputs、`noop`、dedupe、并发和最小权限。最新 Release [v0.86.2](https://github.com/github/gh-aw/releases/tag/v0.86.2)。 |
| Claude 控制台 | [Lexus2016/claude-code-studio](https://github.com/Lexus2016/claude-code-studio) | 131 | 1 | 2026-08-22 15:14 | Web Workspace、任务板、SQLite 队列、Scheduler、多 Agent、Telegram/MCP；Issues 暴露配额状态与后台订阅问题。 |
| 多 Runtime Desktop | [drewnekota/cetus](https://github.com/drewnekota/cetus) | 125 | 4 | 2026-08-22 11:56 | Codex/Claude Code/DSH/Pi 统一 Desktop；Automation、每 Run worktree、Review Board、运行时/模型选择。 |
| DSH 直接竞品 | [titanwings/dsh-automation](https://github.com/titanwings/dsh-automation) | 71 | 4 | 2026-08-17 07:05 | 本次检索到的 DSH 定时任务项目中关注度最高的直接竞品；Fresh Session、安全权限、审计历史完整。最新 Release [v0.1.6](https://github.com/titanwings/dsh-automation/releases/tag/v0.1.6)。 |
| Claude 直接 Scheduler | [jshchnz/claude-code-scheduler](https://github.com/jshchnz/claude-code-scheduler) | 510 | 1 | 2026-01-19 18:25 | 自然语言、OS 原生 Scheduler、全自主模式、worktree、自动 push 和日志；关注度较高，但公开 Issue 暴露 PATH、命令可用性和清理残留问题。 |
| DSH 通知补充层 | [ltao0829/dsh-task-notify](https://github.com/ltao0829/dsh-task-notify) | 7 | 6 | 2026-08-20 11:08 | turn/job/review/failure 的浏览器、OS 和声音通知；适合作为 Delivery Adapter 协作对象。 |
| DSH 直接竞品 | [MichengAI/dsh-automation](https://github.com/MichengAI/dsh-automation) | 5 | 0 | 2026-08-22 15:15 | Settings 全局管理、Sidebar Scheduled、模型/技能/权限选择、月度和每 N 天计划、自然语言创建。 |
| DSH 定时引擎 | [LouisHaoL/dsh-timer-agent](https://github.com/LouisHaoL/dsh-timer-agent) | 3 | 0 | 2026-08-21 02:20 | Host 常驻 ticker；支持继续已有 Session、指定 workdir 或创建新 Session。 |
| DSH 任务生命周期 | [Mason-1011/dsh-task-center](https://github.com/Mason-1011/dsh-task-center) | 1 | 0 | 2026-08-22 04:38 | Task 是持久单位；五态 Kanban、跨 Session handoff、Wake、配额恢复、接受/拒绝和崩溃释放。 |
| DSH 定时竞品 | [cnyac/dsh-polling](https://github.com/cnyac/dsh-polling) | 1 | 1 | 2026-08-21 09:08 | 模型/模式选择、补跑最近一次、归档后新 Session、Settings 管理和任务会话。 |

### 1.2 不热门但有设计价值的专项样本

这些仓库 Stars 很少，不能用于证明市场热度，但能说明实现选择：

| 仓库 | Stars | 可借鉴点 |
|---|---:|---|
| [dortort/claude-code-scheduler](https://github.com/dortort/claude-code-scheduler) | 1 | OS launchd/crontab、worktree、上一轮输出记忆、JSONL history/log rotation、health/status。 |
| [G4brym/prodboard](https://github.com/G4brym/prodboard) | 6 | SQLite Board + cron daemon + tmux attach + worktree + 成本/Token。 |
| [robmorgan/agentd](https://github.com/robmorgan/agentd) | 4 | durable PTY、每任务 worktree/branch、diff、reattach、`info/notice/action` 注意力模型。 |
| [NickCirv/claude-cron](https://github.com/NickCirv/claude-cron) | 0 | 极小 daemon、hot reload、stdout/stderr；反过来证明“能定时启动 Agent”本身不是护城河。 |

## 2. 功能对比

“—”表示本次公开材料中没有观察到，不能解释为绝对不存在。

| 项目 | 触发 | 新鲜/连续上下文 | 模型/技能 | 隔离 | Run/恢复 | Review/Attention | Delivery |
|---|---|---|---|---|---|---|---|
| `dsh-automation-center` 当前 | once/interval/daily/weekly/manual | 默认 Fresh Session | 保存 provider/model 快照，但 UI/Agent tools 未显式开放；Preset 可选 | Workspace 直接读/写 | occurrence 去重、重叠跳过、misfire、Host interrupted、结构化历史 | unread/mark reviewed；无 diff/接纳状态 | Session；可全局 archive completed Session |
| `titanwings/dsh-automation` | once/interval/daily/weekly/manual | Fresh Session | 数据层有 provider/model，Issue 指出工具/UI 缺口；无 reasoning | Workspace 直接读/写 | revision、misfire、重叠、interrupted、history | 摘要/归档；无代码审查 | Session |
| `MichengAI/dsh-automation` | once/interval/hourly/daily/weekly/monthly/N-day/manual | Fresh Session | UI 可选模型和 Skills | Workspace 直接读/写 | queued→terminal、重叠、Host interrupted | Settings history | Session/Sidebar |
| `dsh-task-center` | wake/recurring/scheduled-send/quota reset | Fresh 或指定 Session 继续 | route 可配置 | — | append-only ledger、CAS、hold/reaper、quota resume | awaiting-review、human accept/reject、blocked categories | Board/Session |
| Cetus | at/every/cron/daily/manual | Fresh background conversation；普通 Session 可持续 | 每 Automation 运行时/模型 | 每会话 worktree | Background conversations | In progress/Needs review/Done Board | Desktop/Remote |
| LoopX | schedule/heartbeat/monitor/人工推进 | 跨 Run durable state/handoff | Provider-neutral | 由连接的 Harness 决定 | lease、quota、evidence、recovery、bounded turn | Gate、Attention、Evidence、人类确认 | Workspace/UI/连接器 |
| Open SWE | Slack/Linear/GitHub webhook/follow-up | 同一外部 thread 映射同一 agent thread | Profile/model；curated tools | 每 thread 独立持久 cloud sandbox | 消息队列、并行、Sandbox 重建 | Dashboard/PR review | Slack/Linear/GitHub Draft PR |
| Claude Code Action | GitHub events/manual；schedule 存在 Issue/版本差异 | 每 Actions Run | action 配置 | Actions runner | Actions history/timeout | PR/Issue comment | GitHub outputs |
| gh-aw | schedule/manual/GitHub events/slash command | 每 Workflow Run；可配 memory | 多 Agent engine | runner/container/sandbox | concurrency、dedupe、stop-after、Actions history | `noop`、safe outputs | comment/issue/PR 等受限输出 |

### 当前项目已经做对的部分

- 每次 occurrence 使用 Fresh Root Agent + Result Session，且 Session 标题使用 Automation 名称。
- Definition revision、完整 target snapshot 和持久 Run history 保证旧 Run 可解释。
- occurrence claim、防同任务重叠、有限 misfire、Host 崩溃后不盲目重放可写任务，可靠性基础强于简单 cron wrapper。
- 无人值守只允许 `read-only` / `workspace-write`，不继承来源会话授权，并限制递归 Automation 和后台进程逃逸。
- 原版 DSH rc.8 可直接安装；增强 Shell 存在时升级为全局入口，不做 DOM 注入。
- 已有跨 Workspace Center、完整 Prompt 编辑、立即运行、取消、结构化错误、未读和可选 Session 归档。

## 3. GitHub Issues 中的明确用户问题

### 3.1 DSH 直接竞品的真实反馈

| 用户明确提出的问题 | 状态/证据 | 可以吸收的产品要求 |
|---|---|---|
| Automation 需要显式选择 provider/model/reasoning，不能只继承创建会话；Agent tools 和 Web 都要能改 | OPEN：[titan #8](https://github.com/titanwings/dsh-automation/issues/8)、[titan #9](https://github.com/titanwings/dsh-automation/issues/9) | Definition 显式保存 provider/model/reasoning；Create/Edit UI、Agent tools、Run snapshot 一致，并在保存时校验组合可用。 |
| 没有 active Session 时点击 Sidebar Automation 得到空白 | OPEN：[titan #7](https://github.com/titanwings/dsh-automation/issues/7) | Stock DSH 除 conversation tab 外增加 Settings 级全局入口；任何时候都能管理任务，Session 只作为 Run result。 |
| 创建后无法完整查看/编辑 Prompt | CLOSED：[titan #4](https://github.com/titanwings/dsh-automation/issues/4)，在 [v0.1.6](https://github.com/titanwings/dsh-automation/releases/tag/v0.1.6) 修复 | 已由当前项目覆盖；必须继续用完整 Definition 构造编辑表单，不能从卡片摘要反推。 |
| 高频自动化产生的 Session 淹没人工会话，需要隐藏或 retention | CLOSED：[titan #2](https://github.com/titanwings/dsh-automation/issues/2)，v0.1.6 加入可选归档 | 当前只有全局 `archiveRunSessions`；应进化为每 Automation retention/visibility policy 和安全 dry-run。 |
| 页面鼠标滚轮失效 | CLOSED：[titan #1](https://github.com/titanwings/dsh-automation/issues/1) | 把窄窗、长列表、表单、嵌套滚动和主题回归加入稳定验收。 |
| DSH rc.7 keyed Slot API 变化导致插件加载失败 | OPEN：[dsh-polling #1](https://github.com/cnyac/dsh-polling/issues/1) | CI 除打包安装外，增加多 DSH 版本的 Client activation/slot contract smoke。 |
| CLI 插件无条件解析共享 argv，导致 `dsh web --host/--port` 启动崩溃 | OPEN：[dsh-routines #1](https://github.com/Jesse-njx/dsh-routines/issues/1)、[#2](https://github.com/Jesse-njx/dsh-routines/issues/2) | 不注册无范围的 Commander root parser；Profile 组合验收必须覆盖正常 `dsh web` 参数。当前项目暂未增加 CLI，未来要遵守此边界。 |

### 3.2 Codex Automation：运行可靠性与一致性

| 用户明确提出的问题 | 状态/证据 | 对 DSH 的直接含义 |
|---|---|---|
| 后台任务会停止，只有打开对应任务才立刻恢复 | OPEN：[Codex #36414](https://github.com/openai/codex/issues/36414)、同类 [#35950](https://github.com/openai/codex/issues/35950) | 执行所有权必须在 Host，不由 UI mount/resume 驱动；增加 heartbeat、stuck detection 和阶段状态。 |
| recurring task 运行后会在没有授权时自行变成 paused | OPEN，32 comments：[Codex #38350](https://github.com/openai/codex/issues/38350) | 运行 Prompt 无权修改自己的 Definition；Definition mutation 必须区分操作者并有确认/receipt。 |
| 创建 Automation 可能 hang 或返回空白，无法判断是否已提交，重试又可能重复创建 | OPEN：[Codex #39566](https://github.com/openai/codex/issues/39566) | 所有写操作使用 request id/idempotency key；返回 committed/failed/unknown 的可读收据，并可 read-after-write。 |
| 时区显示与实际 next run 不一致，`TZID` 也可能被忽略 | OPEN，21 comments：[Codex #26633](https://github.com/openai/codex/issues/26633)；同类 [#32304](https://github.com/openai/codex/issues/32304) | 保存前预览未来多次 occurrence；Host 计算和 UI 展示使用同一 recurrence 实现；增加 DST/跨时区回归。 |
| 瞬时模型容量/网络错误不应直接终止任务，应保留状态并退避 | OPEN：[Codex #22390](https://github.com/openai/codex/issues/22390) | 增加 `RunAttempt` 和 retry 分类；仅对 admission/无副作用边界自动重试，绝不盲重跑可能已写入的 Agent turn。 |
| whole job 的 timeout 不能只包 Agent step，setup/install 也会挂数小时并堵住后续计划 | OPEN：[gh-aw #53938](https://github.com/github/gh-aw/issues/53938) | Deadline 覆盖 claim/setup/session/tool/teardown/delivery，并分别保存阶段耗时和超时原因。 |
| 服务重启留下 `__creating__` sentinel 后会一直等待，无真实 owner | OPEN：[Open SWE #1116](https://github.com/langchain-ai/open-swe/issues/1116) | Lease 不能是裸 boolean/sentinel；记录 owner、heartbeat、startedAt、expiry，启动时清算 stale owner。 |
| Headless Action 在 Agent 把工作放到后台后会过早成功/杀死后台 subagent | OPEN：[Claude Code Action #1462](https://github.com/anthropics/claude-code-action/issues/1462)、[#1499](https://github.com/anthropics/claude-code-action/issues/1499)、[#1531](https://github.com/anthropics/claude-code-action/issues/1531) | Run 成功必须等待所有 plugin-owned 子工作进入终态；禁止让 Agent 通过逃逸后台进程伪造完成。当前项目已有禁止后台逃逸，应保留。 |
| OS Scheduler 找不到 `claude`，待执行任务又让插件命令整体不可用，一次性任务只完成部分清理 | OPEN：[claude-code-scheduler #2](https://github.com/jshchnz/claude-code-scheduler/issues/2) | 增加 Scheduler health/preflight；把注册、实际启动、退出和清理做成分段收据，管理命令不能被单个坏任务阻塞。 |
| recurring Cron 的 Next 会继续前进，但 Run、Last、日志和消息交付都没有发生 | CLOSED（问题真实出现过）：[OpenClaw #10401](https://github.com/openclaw/openclaw/issues/10401)、同类 [#11266](https://github.com/openclaw/openclaw/issues/11266) | `scheduled` 不能等同于 `started`；分开记录 due/admitted/started/finished/delivered，并为每段提供时间和错误。 |
| 删除命令显示成功，但任务仍在列表里并继续后台执行 | CLOSED：[OpenClaw #28715](https://github.com/openclaw/openclaw/issues/28715) | 删除先写 durable tombstone/disable，再终止 owner，最后验证没有活动 lease；若无法确认必须返回 `unknown`，不能显示成功。 |
| 状态迁移会静默丢弃/覆盖旧 Cron 数据，或让所有隔离 Run 卡在 lifecycle claim | OPEN/历史回归：[OpenClaw #108642](https://github.com/openclaw/openclaw/issues/108642)、[#60799](https://github.com/openclaw/openclaw/issues/60799) | 迁移需要备份、schema validation、事务切换、可回滚和迁移后计数/摘要对账；`doctor` 必须能识别半迁移状态。 |

### 3.3 Codex Automation：管理面、噪音与注意力

| 用户明确提出的问题 | 状态/证据 | 对 DSH 的直接含义 |
|---|---|---|
| 每次 Run 生成新 Thread，淹没普通会话列表并丢失 recurring intent | OPEN：[Codex #30515](https://github.com/openai/codex/issues/30515) | Automation Center 应按父 Definition 分组 Run；普通 Session list 默认可隐藏/归档高频结果。 |
| 需要 `always visible`、成功自动归档、仅失败/需处理时通知、quiet unless actionable | OPEN：[Codex #28922](https://github.com/openai/codex/issues/28922)；独立通知控制 [#27022](https://github.com/openai/codex/issues/27022) | 引入 `attention` 与 per-Automation delivery policy，而不是让 Prompt 输出特殊指令控制 UI。 |
| 每次执行需要稳定 Run ID/序号、scheduled/start time、live stage/progress 和按父任务分组的历史 | OPEN：[Codex #33544](https://github.com/openai/codex/issues/33544) | Run 成为一等 UI 对象；显示阶段、最新动作、用时、结果和等待原因。 |
| Completed Run/worktree 需要元数据驱动的 retention、dry-run 和排除 active/pinned/ambiguous 项 | OPEN：[Codex #29179](https://github.com/openai/codex/issues/29179) | Cleanup 必须以 Automation/Run 所有权判断，展示将清理项；不得按标题猜测或强删未知 worktree。 |
| 删除一个 worktree/workspace 时疑似连带清空同仓库 `.git/objects` | OPEN，作者明确表示因果仍未完全证实：[Vibe Kanban #3406](https://github.com/BloopAI/vibe-kanban/issues/3406) | Worktree/branch 清理必须校验资源归属和 Git common-dir，不递归删除未知路径；所有破坏性清理要可预览、二次确认并 fail closed。 |
| 归档 task/project 会让相关 Automation 消失或仍显示 ACTIVE 但不再交付，且无警告 | OPEN：[Codex #39965](https://github.com/openai/codex/issues/39965) | Workspace/Session 删除、归档前做依赖检查；失效目标进入 `blocked/missing_target`，不能继续显示 ACTIVE 正常。 |
| 更新后持久 Prompt 与 Scheduled UI 展示的 Prompt 不一致，无权威来源提示 | OPEN：[Codex #39899](https://github.com/openai/codex/issues/39899) | Definition store 是唯一权威源；mutation 返回 revision，Client 用 read-after-write/事件刷新，禁止持久层和 UI 双状态。 |
| 自动化结果在 Running/Ready 活动视图中不可见 | OPEN：[Codex #39412](https://github.com/openai/codex/issues/39412) | 统一 Session/Run lifecycle event，不为 Automation 做遗漏的旁路过滤；跨入口状态必须一致。 |
| 长任务需要持久 monitor：detect→diagnose→repair→verify，并可看 next wake/latest check/health/history | OPEN：[Codex #32993](https://github.com/openai/codex/issues/32993) | 后续应增加 Monitor 类型和健康状态，而不只是重复执行同一 Prompt。 |

### 3.4 模型、权限、配额与记忆边界

| 用户明确提出的问题 | 状态/证据 | 对 DSH 的直接含义 |
|---|---|---|
| Automation 中配置的 model/reasoning 被忽略，实际使用默认模型 | OPEN：[Codex #30439](https://github.com/openai/codex/issues/30439) | Run receipt 必须显示“请求模型”和“实际模型”；保存、创建 Session 和历史都用同一快照。 |
| Automation 的 sandbox 与 App 配置不同，只有进入 UI 后才修正，导致无人值守 Git 操作失败 | OPEN，21 comments：[Codex #15310](https://github.com/openai/codex/issues/15310) | 运行前展示 effective permission；不把 interactive UI 注入作为权限来源。当前项目的独立 permission snapshot 是正确方向。 |
| recurring Run 污染 global Memories，需要 Automation-local memory 与 global memory 分离 | OPEN：[Codex #33641](https://github.com/openai/codex/issues/33641) | 默认继续 Fresh Session/无跨 Run memory；将来 memory 必须显式、按 Automation 隔离且可关闭全局写入。 |
| 项目已有自己的 Scheduler 时，需要禁用/重定向 Desktop automation tool | OPEN：[Codex #38501](https://github.com/openai/codex/issues/38501) | 除检测旧 DSH Scheduler 冲突外，提供 provider priority/禁用声明；模型可见工具与 dispatch 同时移除。 |
| 配额耗尽后任务被错误标为 Done，希望 Paused、记录原因并在额度恢复时继续 | CLOSED（已作为产品问题提出）：[Claude Code Studio #27](https://github.com/Lexus2016/claude-code-studio/issues/27) | 不能把 quota stop 记作 succeeded；增加 `blocked_quota`/`retry_at`，自动恢复仍需明确策略和预算。 |

### 3.5 Trigger 与 Delivery

| 用户明确提出的问题 | 状态/证据 | 对 DSH 的直接含义 |
|---|---|---|
| 需要 GitHub `schedule` 触发 periodic docs/quality/dependency maintenance，并配置输出目标 | OPEN：[Claude Code Action #220](https://github.com/anthropics/claude-code-action/issues/220) | Trigger 与 Delivery 分离；内置“文档维护/质量巡检/依赖审查”模板，但模板不扩大权限。 |
| cron 和 manual 的 OIDC/写权限上下文不同，定时 Run 认证失败 | OPEN：[Claude Code Action #814](https://github.com/anthropics/claude-code-action/issues/814) | 保存前做无人值守 credential/capability preflight；Run 记录 trigger actor 和 credential source，不复用交互授权。 |
| `push` 等非 PR/Issue context 事件被拒绝，且需要明确支持范围 | OPEN：[Claude Code Action #1456](https://github.com/anthropics/claude-code-action/issues/1456) | 每个 Trigger Adapter 声明 required context/capabilities；缺失上下文 fail-fast 并给修复建议。 |
| 外部工具需要正式机器可读的 turn/approval/user-input 生命周期事件 | OPEN，7 comments：[Codex #16484](https://github.com/openai/codex/issues/16484) | 暴露稳定、脱敏的 `AutomationEvent` 契约，让通知/集成插件订阅，不抓 UI 或内部 DB。 |
| 空闲 Session 需要事件唤醒；事件中途到达要定义 queue/coalesce/drop，重启后 cursor 防丢防重 | OPEN，10 comments：[Codex #20312](https://github.com/openai/codex/issues/20312) | `TriggerAdapter → TriggerEvent → Queue`；file/GitHub/webhook/MCP 不进入 Scheduler 条件分支。 |
| 需要显式 same-thread heartbeat，而不总是创建 detached cron task | OPEN：[Codex #35601](https://github.com/openai/codex/issues/35601) | 保留 Fresh 默认；后续可增加 `continuity=fresh|same-thread`，后者必须限制上下文、权限和副作用预算。 |

## 4. X 上的公开用户诉求样本

> 采样日期：2026-08-22。X 是定性信号，不是市场统计；浏览量是抓取时页面展示值，且部分帖子带产品推广或转述成分。产品事实仍以官方文档和源码为准。

| 公开信号 | 帖子中的明确诉求/用法 | 对当前插件的产品含义 |
|---|---|---|
| 无人值守与云端持续运行 | [帖子转引 Claude Code 云任务](https://x.com/ai_escapingcorp/status/2035489545299390889)：选择一个或多个仓库、计划和 Prompt，电脑关闭后仍执行 | DSH 本地版先把 Host Supervisor 和“UI 未打开也执行”做成硬门禁；云 Runner 是后续独立形态，不能用本地 Scheduler 冒充。 |
| 并行隔离与大规模 fan-out | [Rohit，约 41.3 万次浏览](https://x.com/rohit4verse/status/2038492637079146551)：Scheduled loops、Hooks、Git worktree 并行和大量 Agent fan-out | 先做 per-Run worktree + Review Inbox；等 Queue/预算/接纳闭环稳定后再做多 Workspace fan-out。 |
| 可积累、可更新的上下文 | [ふぇね，约 6.65 万次浏览](https://x.com/0xfene/status/2042047157767926056) 和 [Zack Shapiro](https://x.com/zackbshapiro/status/2026733034871935349)：持续维护 context、日报、1:1、会议与跨上下文窗口的 Markdown 记忆 | 默认仍保持 Fresh Session；新增显式 Automation-local context/memory，区分当前事实与历史日志，并禁止写入全局记忆。 |
| 工具连接、结果回写和业务闭环 | [ふぇね](https://x.com/0xfene/status/2042047157767926056)：Calendar/Gmail/Slack/Notion/Linear/GitHub 联动，自动生成摘要并写回任务/资料 | Trigger 和 Delivery 分层；MCP 工具按 Automation 显式 allowlist，外部写入需要预览、幂等 key 和最小权限。 |
| 独立验证，不相信“测试通过” | [Imbue](https://x.com/imbue_ai/status/2031762951343100411)：Agent 遇阻后可能用硬编码占位，代码与测试看似通过却没完成真实需求 | `succeeded` 只表示执行完成；artifact manifest 应包含目标验收、独立 verifier、diff 与测试证据，验证失败进入 `changes_ready/blocked`。 |
| 自然语言创建自动化 | [jack friks，约 7.55 万次浏览](https://x.com/jackfriks/status/2027844525146657237)：希望从现有工作界面用自然语言和 MCP 建立计划 | 保留表单作为精确编辑器，同时让 Agent tools 返回“解析后的绝对时间、时区、权限、目标和下一次运行”确认卡，不静默猜测。 |
| 断线恢复和健康可见性 | [LUCIAN](https://x.com/lucianlamp/status/2036089954321985666)：Scheduled tasks、HEARTBEAT 与 MCP 断线自动恢复 | 增加 connector health、last heartbeat、next retry 和 blocked reason；恢复策略只能重连基础设施，不能盲重跑已产生副作用的 Agent turn。 |
| 远程/移动监督 | [OpenAI 的 Codex 远程工作说明](https://openai.com/index/work-with-codex-from-anywhere/)描述在手机上查看进度、回答问题、审批命令、切换模型和继续任务；X 的传播也把 remote dispatch 视为高价值组合 | Desktop notification 和 deep link 先行；再设计只暴露脱敏状态与窄命令集的远程控制面，不直接开放宿主 RPC。 |

X 样本与 GitHub Issues 的交集很稳定：**后台继续跑、只在真正需要时打扰、可远程介入、隔离并行、显式记忆、结果可验证**。其中最适合当前 DSH 插件先落地的是 Supervisor、Attention、worktree Review 和明确的 model/permission/context snapshot；远程云执行与大规模 fan-out 应后置。

## 5. 对 `dsh-automation-center` 的演进建议

### P0：下一版先补信任与可配置性

| 改进 | 当前差距 | 最小可交付 | 验收证据 |
|---|---|---|---|
| 显式 Model Policy | 数据层已有 provider/model，UI 和 Agent tools 未开放，缺 reasoning | Create/Edit/Tools 增加 provider、model、reasoning；保存时校验；Run 保存 requested/effective model | 换全局默认不影响已固定任务；模型不可用结构化失败；历史显示实际模型 |
| Stock DSH 全局管理 fallback | 原版 rc.8 需要先打开 Session 才能见 conversation tab | 增加 Settings → Automations 全局页面；conversation tab 只做快捷入口；增强 Shell 继续用 root page | 无 Workspace/无 Session 时仍可列表、新建、暂停；不注入 DOM |
| Job Supervisor | 只有总体 timeout 和 Host interrupted，缺阶段/心跳/stale lease | `claim/setup/executing/settling/delivery` 阶段；owner/heartbeat/expiry；stuck watchdog；whole-job deadline | UI 不打开也持续；各阶段 kill/restart 都收敛到可解释终态；无永远 running |
| Attention Inbox | 当前只有 unread 与终态 | 独立 `attention=none|needs_input|changes_ready|failed|blocked|no_change`；Center 首屏按 attention 排序 | no-change 不打扰；需处理结果有稳定徽标、过滤和已读 |
| 写操作收据 | RPC 失败时不能完整表达 unknown commit | requestId/idempotency key、revision、read-after-write；`committed|rejected|unknown` | 超时后重试不重复创建；UI 能恢复 authoritative Definition |

### P1：形成明显产品差异

| 改进 | 为什么现在值得做 | 最小范围 |
|---|---|---|
| Worktree Review | Cetus/agentd/LoopX 把后台代码工作落到可审查成果；当前直接改 Workspace | Git 仓库的 `workspace-write` 默认 per-Run worktree；采集 base SHA、diff stat、patch handle、测试结果；提供保留/接受/丢弃，首版不自动 push/PR |
| Per-Automation retention/notification | Titan/Codex Issues 反复出现会话污染和通知噪音 | `always|actionable|failure-only|silent`，归档天数/条数，cleanup dry-run，排除 active/pinned/ambiguous |
| RunAttempt 与保守 retry | 瞬时 admission/network 失败不应要求用户 babysit | 仅在 Agent 尚未产生副作用时指数退避；attempt history、nextRetryAt、budget；可写 turn 默认不自动重跑 |
| 成本/预算 | Action Issues 明确要求 per-run cost 和 cap：[Claude Action #59](https://github.com/anthropics/claude-code-action/issues/59)、[#136](https://github.com/anthropics/claude-code-action/issues/136)、[#1482](https://github.com/anthropics/claude-code-action/issues/1482) | 保存 token/cost（上游可得时）、per-Run/每日预算和 `budget_exhausted` 终态；不要用估算冒充账单 |
| 稳定 Lifecycle Event | `dsh-task-notify` 已验证通知需求，Codex #16484 要稳定外部事件 | 定义脱敏 `automation.run.started/progress/attention/finished`；通知插件通过 service/event 订阅，不读 DB/DOM |
| Target dependency/preflight | Workspace/Session/凭证/模型变化会让 ACTIVE 成为假状态 | 保存前/运行前检查 target、model、permission、credential capability；依赖归档时提示并转 blocked |

### P2：扩展自动化类型，而不是继续扩 Cron 表单

| 改进 | 设计边界 |
|---|---|
| Trigger Adapter | 先 `after-run`、file change、GitHub Issue/PR/comment，再 generic webhook/MCP；统一 dedupe key、cursor、queue/backpressure、required context |
| Delivery Adapter | Session、Desktop notification、file report、GitHub Issue/PR/comment；先生成 reviewable output，不默认外部写入 |
| Monitor Automation | 建模 check/diagnose/repair/verify、health、lastCheck/nextWake；每一轮仍有预算和停止条件 |
| 显式 Continuity | `fresh` 继续默认；`same-thread` 只用于 monitor/follow-up，并有 transcript compaction、memory、权限和最大连续轮数 |
| 多 Workspace / DAG | 等 Queue、Attempt、Attention、Review 状态稳定后再做 fan-out/dependency；不要把依赖关系塞进 Prompt |
| Runtime/model failover | 参考 [Cetus #3](https://github.com/drewnekota/cetus/issues/3) 的配额后切换 Runtime 诉求；必须显式选择并保留审计，不能静默换模型 |

## 6. 建议产品路线图

| 里程碑 | 用户承诺 | 关键能力 | Go/No-Go |
|---|---|---|---|
| `alpha.6` 配置与可靠性 | “任务按我选的模型和权限，在没人看 UI 时也不会莫名停住” | Model Policy、Settings fallback、phase/lease/watchdog、write receipt | 背景运行、Host crash、RPC timeout、model unavailable、无 Session 全部有实机收据 |
| `alpha.7` Attention | “回来只看真正需要我处理的项目” | attention states、per-task visibility/notification/retention、lifecycle event | 高频 no-op 不污染会话/通知；failed/blocked/changes-ready 不丢 |
| `beta.1` Reviewable Code Automation | “后台改代码不碰主工作区，结果可以安全接纳” | worktree、artifact manifest、diff/tests、accept/keep/discard | dirty main workspace 不受影响；冲突不自动 merge；cleanup fail closed |
| `beta.2` Triggers & Delivery | “时间、GitHub、文件事件都进入同一可靠运行模型” | Trigger/Delivery adapters、cursor/dedupe/backpressure、preflight | 重启不丢不重；无上下文事件 fail-fast；外部写入有审批与最小权限 |
| `1.0` Stable | “跨平台可长期依赖” | rc.8+ Desktop/Web 实机矩阵、升级迁移、SBOM/provenance、稳定事件 API | 所有稳定版验收项有 observed pass；blocked/not-run 不算通过 |

## 7. 可立即转成 GitHub Issues 的拆分

1. `feat(model-policy): expose provider/model/reasoning in UI and agent tools`
2. `feat(surface): add stock DSH Settings-level Automation Center`
3. `feat(supervisor): model run phases, lease heartbeat and whole-job deadline`
4. `feat(receipts): idempotent definition mutations with read-after-write revision`
5. `feat(attention): add actionable/no-change/blocked inbox states`
6. `feat(retention): per-automation visibility, notification and cleanup dry-run`
7. `feat(worktree): isolated write runs and review artifact manifest`
8. `feat(events): publish stable redacted automation lifecycle events`
9. `feat(attempts): conservative retry for pre-side-effect transient failures`
10. `feat(preflight): validate target/model/credential capabilities before activation`

## 8. 研究限制

- GitHub Issues 是自选择样本，评论数也不等于投票数；本文用它发现问题形态，不估算市场规模。
- 一些 2026 年新仓库成长很快；Stars 和功能应在排期前重新查询。
- `openai/codex` Issues 同时覆盖 CLI、Desktop、ChatGPT Work 等多个 Surface；引用时保留原 Issue 指定的环境，不把单个 Surface Bug 扩大为所有产品都存在。
- `LoopX`、`gh-aw` 和部分 Claude Code Studio Issues 有大量项目自身维护任务；本文只把明确由外部用户提出或能直接验证的产品问题放进“用户明确反馈”。
- X 的公开用户需求样本已经收录在本文第 4 节，不能与 GitHub Issue 计数合并成统计结论。

## 主要一手来源

- DSH 直接竞品：[titanwings/dsh-automation README](https://github.com/titanwings/dsh-automation)、[MichengAI/dsh-automation README](https://github.com/MichengAI/dsh-automation)、[dsh-task-center README](https://github.com/Mason-1011/dsh-task-center)、[dsh-polling README](https://github.com/cnyac/dsh-polling)、[dsh-timer-agent README](https://github.com/LouisHaoL/dsh-timer-agent)
- 跨生态：[Open SWE README](https://github.com/langchain-ai/open-swe)、[Claude Code Action usage](https://github.com/anthropics/claude-code-action/blob/main/docs/usage.md)、[gh-aw README](https://github.com/github/gh-aw)、[gh-aw 工作流模式](https://github.com/github/gh-aw/blob/main/.github/aw/github-agentic-workflows.md)、[LoopX README](https://github.com/huangruiteng/loopx)、[Cetus README](https://github.com/drewnekota/cetus)
- 官方产品基线：[Codex App Automations 与 Review Queue](https://openai.com/index/introducing-the-codex-app/)、[Codex 远程监督](https://openai.com/index/work-with-codex-from-anywhere/)、[Claude Code Routines](https://code.claude.com/docs/en/web-scheduled-tasks)、[Claude Code scheduled tasks](https://code.claude.com/docs/en/scheduled-tasks)、[gh-aw safe outputs](https://github.github.com/gh-aw/reference/safe-outputs/)
- 目标项目：[README](../../README.md)、[技术方案](../technical-design.zh-CN.md)、[验收标准](../acceptance-criteria.zh-CN.md)

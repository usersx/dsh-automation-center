# Coding Agent 自动化生态调研（2026-08）

> 证据冻结时间：2026-08-19（GitHub 仓库 HEAD）；OpenAI 与 Zed 官方文档于 2026-08-20 再次核对。  
> 目标项目快照：`dsh-automation-center@d30320fbbfa2845be2b21871c59fa052fed2e2df`。  
> 本文只使用目标仓库、上游项目源码/README 和产品官方文档。GitHub 链接均固定到所检查的 commit；产品文档没有 commit 标识，故同时记录核对日期。

> 实现更新（2026-08-20）：调研开始时目标仓库仍是 specification-only；此后同一轮开发已经交付可安装 Host/Web Bundle、DSH Shell Patch、全局页面、Fresh Session 调度引擎、旧数据只读迁移和冲突保护。下文对 `d30320f...` 的“当前状态”描述应按历史快照理解，差异化路线仍然有效。

## 结论先行

不建议把 `dsh-automation-center` 做成另一个“Cron 表单 + 后台启动 Agent”的 Scheduler。这个层面已经有实现完整、代码量更小的项目：`dsh-automation` 已覆盖 DSH Fresh Session、时区、持久运行历史、去重、重叠保护、misfire 和无人值守权限；Claude 生态还有直接使用 launchd/crontab 或常驻 daemon 的方案。

最有价值的差异化是把项目定位为 **DSH 原生的 Automation Review Inbox（自动化审查收件箱）**：

1. 每次可写运行默认使用独立 Git worktree，而不是直接改用户主工作区。
2. Run 除了执行终态，还产出结构化的 diff、测试结果、成本和“需要输入/可以审查/无变化”注意力状态。
3. 用户从全局 Automation Center 进入审查，明确选择“接受并合入 / 保留工作树 / 丢弃”，首版不自动 merge、push 或开 PR。
4. Session 仍是完整执行轨迹，但 Automation Center 才是 Definition、Run、Review 和 Attention 的管理面。

这条路线把 Codex 的全局 Scheduled 收件箱、`dortort/claude-code-scheduler` 的 worktree、`agentd`/Daintree 的审查与注意力模型，以及 `dsh-automation` 已经验证的 DSH 执行边界组合起来。样本中没有一个 DSH 插件同时提供这些能力。

## 范围与证据等级

本文把结论分成三类：

- **已观察事实**：在固定 commit 的 README、源码或官方产品文档中可以直接找到。
- **工程推断**：由多个已观察事实推导出的产品或架构建议，不宣称竞品已经这样实现。
- **未知**：样本没有公开足够证据，不能把“没有看到”写成“绝对不存在”。

本次不是全 GitHub 穷举。选择的样本覆盖了五种不同形态：DSH 原生插件、Claude 定时插件、本地任务/队列控制台、Agent 运行监督器、GitHub 事件自动化。Zed 与 Codex 使用官方文档作为产品基线；Codex Scheduled 的实现源码未公开，因此不对其内部一致性和恢复算法作推断。

## 一手来源快照

| 项目 | 所检查版本 | 角色 | 主要证据 |
|---|---|---|---|
| DSH Automation Center | `d30320fbbfa2845be2b21871c59fa052fed2e2df` | 本文目标，当前为 specification-only pre-alpha | [README](https://github.com/usersx/dsh-automation-center/blob/d30320fbbfa2845be2b21871c59fa052fed2e2df/README.md)、[技术方案](https://github.com/usersx/dsh-automation-center/blob/d30320fbbfa2845be2b21871c59fa052fed2e2df/docs/technical-design.zh-CN.md)、[验收标准](https://github.com/usersx/dsh-automation-center/blob/d30320fbbfa2845be2b21871c59fa052fed2e2df/docs/acceptance-criteria.zh-CN.md) |
| DeepSeek Harness | `99f6f02fecdb7dff40c3fbc9470f5907c29f74ca` | DSH rc.7 本地上游快照 | [生成的 Client Slot catalog](https://github.com/deepseek-ai/deepseek-harness/blob/99f6f02fecdb7dff40c3fbc9470f5907c29f74ca/packages/extensions/cordis-client-runner/src/client/slot-catalog.ts) |
| `titanwings/dsh-automation` | `f8f43b2873a3f9dd57d86d61eb401770b2bc9ca5` | 当前最直接的 DSH 定时竞品，v0.1.6 | [README](https://github.com/titanwings/dsh-automation/blob/f8f43b2873a3f9dd57d86d61eb401770b2bc9ca5/README.md)、[Service](https://github.com/titanwings/dsh-automation/blob/f8f43b2873a3f9dd57d86d61eb401770b2bc9ca5/src/service.ts)、[Executor](https://github.com/titanwings/dsh-automation/blob/f8f43b2873a3f9dd57d86d61eb401770b2bc9ca5/src/executor.ts) |
| `dortort/claude-code-scheduler` | `fc79730fb41c0aee81b262a31852b0d1765d6ab5` | Claude Code OS 原生调度插件，v0.3.1 | [README](https://github.com/dortort/claude-code-scheduler/blob/fc79730fb41c0aee81b262a31852b0d1765d6ab5/README.md)、[PRD](https://github.com/dortort/claude-code-scheduler/blob/fc79730fb41c0aee81b262a31852b0d1765d6ab5/docs/PRD.md)、[macOS scheduler](https://github.com/dortort/claude-code-scheduler/blob/fc79730fb41c0aee81b262a31852b0d1765d6ab5/src/schedulers/darwin.ts) |
| `NickCirv/claude-cron` | `827c3d37a5857668bcf6e6e023dc70d5d8bc09b2` | 最小常驻 daemon + cron wrapper | [README](https://github.com/NickCirv/claude-cron/blob/827c3d37a5857668bcf6e6e023dc70d5d8bc09b2/README.md)、[Scheduler](https://github.com/NickCirv/claude-cron/blob/827c3d37a5857668bcf6e6e023dc70d5d8bc09b2/src/scheduler.js)、[Runner](https://github.com/NickCirv/claude-cron/blob/827c3d37a5857668bcf6e6e023dc70d5d8bc09b2/src/runner.js) |
| `G4brym/prodboard` | `339e5916dd455409d8875f49260b2ef5b119aa4b` | 本地 issue board + Scheduler + Web UI | [README](https://github.com/G4brym/prodboard/blob/339e5916dd455409d8875f49260b2ef5b119aa4b/README.md)、[Scheduler](https://github.com/G4brym/prodboard/blob/339e5916dd455409d8875f49260b2ef5b119aa4b/src/scheduler.ts)、[Worktree](https://github.com/G4brym/prodboard/blob/339e5916dd455409d8875f49260b2ef5b119aa4b/src/worktree.ts) |
| `robmorgan/agentd` | `dbfb916a582544d696bcc2948b6ad9f6ef745d4e` | Durable Agent runtime / supervisor，不是时间 Scheduler | [README](https://github.com/robmorgan/agentd/blob/dbfb916a582544d696bcc2948b6ad9f6ef745d4e/README.md)、[应用状态机](https://github.com/robmorgan/agentd/blob/dbfb916a582544d696bcc2948b6ad9f6ef745d4e/crates/agentd/src/app.rs)、[Git 集成](https://github.com/robmorgan/agentd/blob/dbfb916a582544d696bcc2948b6ad9f6ef745d4e/crates/agentd/src/git.rs) |
| `daintreehq/daintree` | `b3f41691bd0af4ce7211bba63ab9d427d708883c`（`develop`） | 多 Agent Desktop 编排与 Review UI，不是时间 Scheduler | [README](https://github.com/daintreehq/daintree/blob/b3f41691bd0af4ce7211bba63ab9d427d708883c/README.md)、[架构文档](https://github.com/daintreehq/daintree/tree/b3f41691bd0af4ce7211bba63ab9d427d708883c/docs/architecture) |
| `dnvriend/claude-code-scheduler` | `8d2e8afb12f475eb21648b10784bd57d013eb922` | GUI + CLI + REST Scheduler | [README](https://github.com/dnvriend/claude-code-scheduler/blob/8d2e8afb12f475eb21648b10784bd57d013eb922/README.md) |
| `Lexus2016/claude-code-studio` | `4d1f30b25e9910cc1aae52c2cedf09d93b17841c` | SQLite 队列、DAG 与通知控制台 | [README](https://github.com/Lexus2016/claude-code-studio/blob/4d1f30b25e9910cc1aae52c2cedf09d93b17841c/README.md) |
| `anthropics/claude-code-action` | `65b50df0838d26293e18bb62f71492d3c11dc82d` | Anthropic 官方 GitHub 事件自动化 | [自定义自动化](https://github.com/anthropics/claude-code-action/blob/65b50df0838d26293e18bb62f71492d3c11dc82d/docs/custom-automations.md) |
| `github/gh-aw` | `9169e8222aa9194a65dc37ac5e2840b14eb249c6` | GitHub Agentic Workflows 编译器 | [README](https://github.com/github/gh-aw/blob/9169e8222aa9194a65dc37ac5e2840b14eb249c6/README.md)、[触发器](https://github.github.com/gh-aw/reference/triggers/)、[并发](https://github.github.com/gh-aw/reference/concurrency/) |
| Codex / ChatGPT Scheduled | 官方文档，2026-08-20 | 产品能力基线，非开源实现 | [Scheduled tasks](https://learn.chatgpt.com/docs/automations)、[Notifications](https://learn.chatgpt.com/docs/notifications) |
| Zed Agent | 官方文档，2026-08-20 | 交互式 Agent/Worktree/Review 基线 | [Agent Panel](https://zed.dev/docs/ai/agent-panel)、[Parallel Agents](https://zed.dev/docs/ai/parallel-agents)、[Tool Permissions](https://zed.dev/docs/ai/tool-permissions) |

## 已观察事实

### 1. `dsh-automation` 已经把“正确的本地 Scheduler”做得相当完整

在所检查的 v0.1.6 中，它不是一个简单的 `setInterval`：

- 支持 one-shot、fixed interval、daily、weekly 和显式 IANA 时区。
- 每次 occurrence 创建 Fresh Root Agent/Session，并快照 workspace、cwd、preset、provider、model、permission 与 prompt。
- Run 持久化 `queued/running/succeeded/failed/skipped/cancelled`、definition revision、occurrence key、Session ID、摘要和结构化错误。
- 同一 Automation 不重叠；默认 misfire grace 15 分钟，只补最新一条；默认 60 分钟超时。
- Host 重启后把遗留 `queued/running` 标成 `failed(host_interrupted)`，不会自动重放可能已经产生外部副作用的工作。
- 只允许 `read-only` / `workspace-write`，approval policy 为 `never`，并有无人值守工具白名单与递归自动化限制。
- 明确不支持 worktree、外部通知、事件触发、多 Workspace/DAG、跨 Run memory 和 OS 级 daemon。

它当前的主要产品限制不是调度正确性，而是 **管理面位于当前 Conversation、执行直接落在 Workspace、结果主要仍是 Session 和摘要**。因此复制它的 Schedule/History UI 只会得到一个更换入口的同质产品。

### 2. Claude 定时插件证明了“调度器底座”本身不是稀缺能力

`NickCirv/claude-cron` 只有一个常驻 Node daemon：任务存在 `~/.claude-cron/tasks.json`，每 60 秒热加载，用 `node-cron` 启动 `claude -p`，每次最多 30 分钟。源码没有看到同任务重叠锁、missed-run 恢复或重试；Runner 直接使用 `--dangerously-skip-permissions`。它说明“让 Agent 定时跑起来”可以很小，但不是安全的产品护城河。

`dortort/claude-code-scheduler` 更成熟：把生命周期交给 macOS launchd / Linux crontab，共享 Node executor，支持 direct/worktree、一次性任务、JSONL history/rotation、敏感文件检查和可选的上一轮输出记忆。它仍没有独立的全局审查收件箱、持久队列、崩溃恢复或通知；README/PRD 把 webhook/dashboard 留在后续。

### 3. Worktree 若没有审查生命周期，会变成一次性临时目录

`prodboard` 把 SQLite board、30 秒 cron tick、并发上限、tmux、成本/Token 记录、Claude/OpenCode driver 和 Web UI 放在一起，也为每次 daemon-triggered run 创建 worktree。但其 `finally` 会清理 worktree；清理逻辑在安全删除失败时会 force-delete 分支。它优化的是“完成后台作业”，没有把“用户审查并决定如何接纳代码”建模成持久状态。

`agentd` 则从另一侧证明了审查模型的价值：每个任务有独立 worktree/branch/PTY，支持 retained history、diff、merge preview、冲突预检、merge/discard，并以 `info/notice/action` 表示注意力。它没有时间 Scheduler，却更接近 Coding Automation 真正的交付尾端。

Daintree 同样聚焦多 worktree、多 Agent、Review Hub、Notification Center 和事件订阅。其官方 README 把问题定义成 supervision/review bottleneck，而不是 prompt 启动问题。

### 4. 产品级控制台需要把 Trigger、Queue、Execution、Delivery 分开

`claude-code-studio` 已观察到 SQLite 持久任务、并行/串行/DAG、最多五个 worker、watchdog 孤儿恢复、dispatch 退避重试和 Telegram/MCP 通知；`dnvriend/claude-code-scheduler` 有 manual/interval/calendar/file-watch 与 `Job -> Task -> Run`。这两个项目说明：一旦进入控制台形态，仅用一张 Definition 表和一个 clock 很快会混淆“触发被接收”“等待执行”“Agent 正在跑”“结果已交付”。

GitHub 侧的对照更清楚：Anthropic 官方 `claude-code-action` 把 PR/Issue/Comment/Review/`repository_dispatch` 事件交给 Actions；GitHub 官方 `gh-aw` 支持 Actions 事件、定时、slash command、manual 与 `repository_dispatch`，并显式提供并发队列和 safe outputs。它们把执行可靠性外包给 GitHub Actions，但事件面和输出边界值得本地产品借鉴。

### 5. Codex 与 Zed 展示的是两个互补的产品基线

OpenAI 官方 Scheduled 文档明确描述：

- 全局 Scheduled 页面和 unread inbox；standalone run 每次新 chat，同一 chat 内的 schedule 可复用现有上下文。
- 本地项目可选 direct checkout 或独立 worktree；同一任务可运行在多个项目。
- 支持 RRULE、model/reasoning、skills/plugins；无人值守运行使用默认 sandbox，并建议最小权限。
- Desktop 有完成、权限和问题通知；Activity 还区分 running、needs input、ready、blocked。

Zed 官方 Agent 文档描述了多项目 Threads Sidebar、并行 threads、worktree picker、逐 hunk Review Changes、checkpoint、工具权限和桌面通知。本文核对的 Agent/Parallel Agent 文档没有描述按时间或事件创建持久 Automation 的原语；因此 Zed 在这里是“交互式监督与审查”基线，而不是 Scheduler 竞品。这个表述不等于断言 Zed 生态绝对没有第三方调度扩展。

## 能力矩阵

“—”表示本次检查的公开材料没有观察到，不代表绝对不存在。

| 项目 | 时间调度 | 非时间事件 | 持久 Run/History | Queue/恢复 | Worktree | Review/Attention | 通知 | DSH 原生 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `dsh-automation` | 是 | — | 是 | 去重、重叠、misfire、interrupted | — | 失败/未读摘要 | — | 是 |
| `dortort/claude-code-scheduler` | 是 | — | JSONL | — | 是 | — | — | 否 |
| `claude-cron` | 是 | — | JSON/日志 | — | — | — | — | 否 |
| `prodboard` | 是 | — | SQLite | 并发上限、crash 标记 | 是 | Board/运行视图 | — | 否 |
| `claude-code-studio` | 是 | 人工入队 | SQLite | workers、DAG、watchdog | — | Kanban/任务面 | Telegram/MCP | 否 |
| `dnvriend` scheduler | 是 | file-watch | Run/log | workers | — | GUI | — | 否 |
| `agentd` | — | 人工 | SQLite/PTY history | daemon recovery 边界 | 是 | diff/merge/attention | — | 否 |
| Daintree | — | UI/事件订阅 | 应用状态 | 多 Agent 监督 | 是 | Review Hub/Notification Center | Desktop | 否 |
| `claude-code-action` | —（所查官方自动化文档未列） | GitHub events | Actions history | Actions | runner checkout | 评论/Actions | progress comment 可选 | 否 |
| `gh-aw` | 是 | GitHub events/slash/manual | Actions history | Actions queue/concurrency | runner checkout | safe outputs/comments | 评论等 | 否 |
| Codex Scheduled（官方产品） | 是 | chat 内 polling/monitor | 是 | 内部实现未知 | 是 | Scheduled/Activity | Desktop/push/email/SMS | 否 |
| Zed Agent（官方产品） | — | 交互式 | Thread history | 多 Thread | 是 | 逐 hunk review/notification | Desktop | 否 |

## 对当前 `dsh-automation-center` 的差距判断

### 已有的正确基础

目标仓库已经做对了几件关键事：

- 明确是全局一级页面，入口位于“新会话”之下、“工作区”之上，而不是 Session tab。
- Session 被定义为 Run result/audit trail，而不是 Definition 管理面。
- 用一个深 `AutomationEngine` 收敛 UI、CLI、Scheduler、RPC 和 Agent Tools，调用方不能直接写 Storage Domain。
- 定义了 deterministic occurrence claim、Fresh Session、不继承临时授权、无人值守只读/工作区可写、无自动 side-effect retry。
- 明确拒绝 DOM injection 和整棵 Sidebar replacement。

本地 DSH rc.7 快照 `99f6f02f...` 的生成 Slot catalog 中没有 `sidebar.primary.action` 与 `shell.page`；目标仓库也仍将它们列为上游前置条件。因此当前 pre-alpha、不发布伪可用 bundle 的决定是合理的。

### 真实缺口

当前规范仍主要描述“更好的全局 Scheduler UI”，以下能力没有形成完整领域模型或验收闭环：

1. **执行隔离**：没有 direct/worktree 策略、worktree 生命周期、孤儿恢复、保留/丢弃/合入状态。
2. **结果接纳**：Review Queue 尚未定义 review item、diff/artifact、测试证据、merge/discard 操作与冲突状态。
3. **注意力语义**：`failed` 和“待查看”不足以表达 `needs_input`、`changes_ready`、`no_change`、`blocked`。
4. **触发与排队分层**：缺少 event/manual/schedule 统一 TriggerEvent、队列 backpressure、global/per-workspace concurrency 和 skipped/backlogged 决策。
5. **交付渠道**：没有 Desktop notification 或外部 delivery adapter；用户必须主动打开页面才能知道结果。
6. **运行预算**：表单虽有 preset/permission/timeout，但没有明确 model/reasoning/token/cost budget 快照与预算终止原因。
7. **连续任务**：只有 Fresh Session；没有同一 chat 内 polling、needs-input 后续跑或显式跨 Run memory policy。
8. **多项目**：当前 Definition 指向一个 Workspace，尚未覆盖同一 Automation fan-out 到多个 Workspace 的语义。
9. **Schedule 边界**：现有标准继承了 occurrence key/不重叠/中断标记，但仍应写清 DST、misfire/backlog、clock rollback 与手动 Run 的优先级。

## 首选差异化 MVP：Automation Review Inbox

### 用户承诺

> 让 DSH 在后台安全地完成一项可写代码任务；回来时看到的不是一段摘要，而是一份可审查、可接纳、可丢弃的工作成果。

### MVP 范围

保留当前全局 Center、Fresh Session 和安全调度设计，只增加一条完整纵切：

1. Git 仓库的 `workspace-write` Run 默认创建独立 worktree；`read-only` 可直接在 Workspace 运行。
2. 每个 Run 保存 isolation snapshot：base commit、branch、worktree path/id、cleanup state。
3. 执行结束后采集 artifact manifest：changed files、diff stat、patch/diff handle、测试命令与结果、Session ID、token/cost（上游可得时）。
4. 把执行终态与注意力终态分开：
   - execution：`queued/running/succeeded/failed/cancelled/interrupted`
   - attention：`none/needs_input/changes_ready/no_change/blocked`
   - review：`not_applicable/pending/accepted/kept/discarded/conflicted`
5. Automation Center 首屏以 Attention Inbox 排序，而不是只按最近运行排序。
6. 对 `changes_ready` 提供三个显式动作：
   - **接受**：做 merge preflight，成功后合入基线分支；冲突进入 `conflicted`，不自动解决。
   - **保留**：固定 worktree，用户稍后手工处理。
   - **丢弃**：二次确认后清理 worktree/branch。
7. 首版只发 Desktop 本地通知；不自动 push、开 PR 或对外发送消息。

### 首版明确不做

- 不做 GitHub/Slack/webhook 事件触发。
- 不做 DAG、多 Agent 流程和多 Workspace fan-out。
- 不做自动 retry、自动 merge、自动 push、自动开 PR。
- 不做跨 Run memory 或同一聊天的持续循环。
- 不复制任意 raw cron/shell runner。

这个切法能以一个可验收场景证明差异化，同时避免立刻承担通用工作流引擎的复杂度。

### 建议验收用例

1. 主工作区有未提交改动时，可写 Automation 仍在独立 worktree 完成，不触碰主工作区。
2. Agent 产生代码改动后，Run 显示 `changes_ready`，能打开 Result Session 和结构化 diff/test evidence。
3. “接受”前执行 merge preflight；基线发生冲突时保留 worktree 并标记 `conflicted`，不污染主分支。
4. “丢弃”只删除该 Run 已验证归属的 worktree/branch；未合入提交不得被静默 force-delete。
5. Host 在 worktree 创建、Agent 运行、artifact 采集、用户审查四个阶段分别崩溃后，重启都能恢复为可解释状态。
6. `needs_input`、`changes_ready`、`failed` 产生未读徽标和 Desktop 通知；`no_change` 默认静默但保留历史。
7. 同一 occurrence 重复扫描只产生一个 Run；同一 Automation 运行中按声明策略记录 `skipped(overlap)`。

## 建议架构调整

保留现有 `AutomationEngine` 作为唯一应用入口，但在内部显式拆开以下阶段：

```text
Trigger Adapter
  -> durable TriggerEvent / occurrence claim
  -> Run Admission + Queue
  -> Workspace Lease / Isolation
  -> DSH Agent Execution
  -> Artifact Collector
  -> Attention Router
  -> Review / Delivery
```

### 领域对象建议

- `AutomationDefinition`：prompt、schedule/trigger、workspace target、preset、权限、预算、isolation policy。
- `AutomationRun`：definition revision 与完整 snapshot；只承载一次执行的事实。
- `RunAttempt`：如果未来增加基础设施级 retry，用 attempt 区分；MVP 保持每 Run 一个 attempt。
- `RunArtifactManifest`：diff、tests、files、links、成本等结构化索引；大对象不要塞进 Run 行。
- `AttentionItem`：为什么需要用户、严重级别、未读/已读、可执行动作。
- `ReviewDisposition`：pending/accepted/kept/discarded/conflicted 及操作者、时间和结果。
- `WorkspaceLease`：direct/worktree、base revision、owner run、cleanup state，避免路径字符串成为权限凭据。

### 必须坚持的约束

- Trigger 被接收不等于 Run 已执行；Queue 满时必须有可审计结果，不能静默丢失。
- `succeeded` 只说明 Agent execution 成功，不说明代码已被用户接受或成功合入。
- Worktree cleanup 必须 fail closed；不能复制 `prodboard` 在安全删除失败后 force-delete 未合入分支的行为。
- 外部通知只传最小摘要和本地 deep link，不传 prompt、环境变量、凭证或完整 diff。
- Event trigger 将来应是 adapter，不应进入 Scheduler 或 Agent executor 的条件分支。
- 同一 chat 延续和跨 Run memory 将来必须是显式 mode；默认仍保持 Fresh Session。

## 后续优先级

### P0：先形成产品差异

- 上游补齐 `sidebar.primary.action`、`shell.page` 和 shell navigation。
- 完成现有 Schedule/Fresh Session/occurrence/recovery 纵切。
- 加入 worktree isolation、artifact manifest、attention/review 状态与安全接纳动作。
- 把上述状态写进 acceptance criteria，而不只是 Roadmap 中的“Review Queue”字样。

### P1：让用户不用守着 Center

- Desktop notification：`failed`、`needs_input`、`changes_ready`。
- run budget：model、reasoning、timeout、token/cost guardrail。
- worktree orphan scan、pin/retention、磁盘配额和清理预览。

### P2：扩展 Trigger，而不是扩展 Cron 表单

- `after-run`、file change、GitHub PR/Issue/comment、generic webhook/MCP event adapter。
- 每个 adapter 输出同一个 `TriggerEvent`，复用 Queue/Execution/Review。
- 增加 per-trigger debounce、dedupe key、rate limit 与 delivery policy。

### P3：连续和团队工作流

- 同一 chat 内 polling/monitor 模式。
- 显式 run-to-run memory 与摘要预算。
- 多 Workspace fan-out、DAG、人工 approval gates、远端 runner/单主租约。

## 推断与未知

### 工程推断

- **生态位推断**：DSH 的空位不在更灵活的 recurrence，而在 DSH 原生的 worktree + artifact + attention + review 闭环。依据是直接竞品已覆盖调度正确性，而独立监督器把审查列为核心痛点。
- **MVP 推断**：先做一种安全的可写任务，比先做 webhook/DAG/多 Workspace 更容易形成可验证价值，也更符合目标仓库“最小权限、Fresh Session、无盲重试”的现有边界。
- **架构推断**：把 execution 与 review/delivery 状态分开，可以避免以后事件触发、通知和人工接纳挤进 `AutomationRun.status`。

### 仍未知，实施前必须验证

- DSH 上游是否接受并以何种最终 API 提供 `sidebar.primary.action`、`shell.page` 和全局 navigation；本文只能确认 rc.7 快照尚无这两个 key。
- DSH 是否会提供稳定的 worktree lifecycle service；若没有，需要先确定插件能否安全拥有 Git 生命周期，而不是先做 UI 开关。
- DSH Session/Agent API 能否可靠提供 token/cost、结构化 tool result、needs-input 与终止原因。
- Desktop 的正式通知接口、deep link 路由和 profile 隔离边界。
- Codex Scheduled、Zed 和未抽样插件的内部 retry、misfire、queue、exactly-once 实现；公开文档不足以支持结论。
- `claude-code-studio`、`dnvriend` 等较新项目的生产成熟度、真实用户规模和长时间稳定性；本文只比较公开功能与架构，不以 star 或宣传语判断可靠性。

## 最终 Go / No-Go

**Go**：继续做 `dsh-automation-center`，但将首个可发布版本定义为“安全的 Automation Review Inbox”，复用 `dsh-automation` 已验证的调度/DSH 执行语义，并以 worktree、artifact、attention、review disposition 形成差异。

**No-Go**：如果首版仍只是把现有 `dsh-automation` 的创建表单和 run history 从 Conversation 移到全局页面，不值得单独维护一个新插件；那更适合给现有插件贡献全局 UI。

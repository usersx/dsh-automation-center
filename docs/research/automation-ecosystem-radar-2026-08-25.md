# 自动化生态与用户需求雷达日报（2026-08-25）

> 数据采集时间：2026-08-25 10:19—10:51（Asia/Shanghai，UTC+08:00）
> 精确增量窗口：2026-08-24T02:23:32.820Z（上次运行）至 2026-08-25T02:51:11Z。
> 证据标记：**Observed** = 本次从源码、Git、GitHub 官方页面/Atom/Issue 直接观察；**Tested** = 有可定位的自动化或实机验收记录；**Inference** = 基于外部证据映射到本项目的建议，不等于已经实现。
> 范围：当前仓库、AI Agent 自动化、调度/编排、插件、监控、通知、权限与生态集成。只做调研与建议；本次未修改业务代码、未运行测试、未提交 Issue、未发布内容、未对外联系。

## 1. 执行摘要

1. **当前项目自昨日没有新代码、文档或 Release，能力基线不变。** 今日 `git ls-remote` 再确认远端 `main` 仍为 [`b0bb2db`](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c)、`v0.1.0-alpha.6` tag 仍指向 `ffc0be5`；本地仍是 `chore/dsh-rc2-compat@0920888`、tree=`832a603`，工作区只有 8 月 23/24/25 日三份未跟踪雷达报告。远端 `b0bb2db` 对象不在本地，故“远端 main tree 与本地 tree 一致”仍是**昨日已验证、今日未复测**。稳定版仍是 NO-GO。
2. **今日最强新增需求证据是“Trigger 看似 active，租约已静默失效”。** Dify [#41162](https://github.com/langgenius/dify/issues/41162) 给出完整数据路径：Gmail Trigger 返回真实 `expires_at`，持久化却变成 `-1`，刷新任务每分钟仍成功、OAuth 也正常，但 7 天后 `users.watch` 租约到期，工作流不再触发，UI/日志都无错误。这把 P0 health 从“计划 occurrence 是否发生”进一步明确为：未来 Trigger Adapter 必须暴露 lease expiry、last accepted event 与 renewal receipt；当前没有 Trigger Adapter，不应先加表或连接器目录。
3. **今日第二条高信号证据是“超时器和被监督工作在同一执行线程时，二者可一起失效”。** Hermes [#94285](https://github.com/NousResearch/hermes-agent/issues/94285) 记录一个 P1 Cron 故障：terminal 同步阻塞 4,118 秒，越过 420 秒 tool deadline 和 600 秒 inactivity limit，因为两者都依赖已被阻塞的 asyncio loop。本项目已有 whole-job deadline、phase、lease/heartbeat；但源码中的 deadline 同样由 [`setTimeout`](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/executor.ts#L212-L238) 驱动，取消后还等待 `agent.whenIdle()`，阶段强杀和非协作阻塞仍 NOT RUN。优先补真实 fault-injection，再决定是否需要进程外 watchdog，不能把 timer 单测当成强监督已成立。
4. **实时事件、持久记录与 UI 终态必须一致，通知也不能依赖 App 聚焦。** LangGraph [#8704](https://github.com/langchain-ai/langgraph/issues/8704) 显示 event stream 漏字段但 `/state` 完整；Codex [#40515](https://github.com/openai/codex/issues/40515) 在多个 SSH 线程中观察到 rollout 已有 `final_answer/task_complete`，Desktop 却显示 `interrupted`；Codex [#40482](https://github.com/openai/codex/issues/40482) 又显示通知直到重新聚焦 App 才出现。三者共同支持 P1 可补偿 lifecycle、event↔snapshot↔index conformance、稳定 recipient 与逐目标 receipt。
5. **MCP/权限预检要覆盖 connect/reconnect 与最终生效身份，不只是 list/call。** Agent Framework [#7841](https://github.com/microsoft/agent-framework/issues/7841) 在真实 MCP server 复现 `connect()`/reconnect 不携带 `header_provider` auth，直接 401；n8n [#36963](https://github.com/n8n-io/n8n/issues/36963) 与 [#36896](https://github.com/n8n-io/n8n/issues/36896) 又分别暴露 custom role 的有效权限反而弱于 Member、custom AI gateway 缺 user identity/audit。MCP 分层 preflight 仍为 P1，不挤进 Top 5，但必须增加 handshake/reconnect、effective actor 与 audit context。

## 2. 当前仓库能力与证据边界

本节只写今日仍可成立的当前事实；完整源码索引见 [8 月 24 日报告](./automation-ecosystem-radar-2026-08-24.md)。

| 能力面 | 已实现（Observed） | 已验证（Tested） | 未实现或本次 NOT RUN |
|---|---|---|---|
| 自动化任务 | 持久 Definition/Run/Command Receipt；创建、编辑、暂停、恢复、删除、立即运行、取消、mark-read；Fresh Root Agent + Result Session | 昨日记录：82/82 自动化、rc.8 Web 与 macOS Desktop 核心 E2E | 本次未跑测试；无 Artifact/Review 接纳、Attempt/预算；Windows/Linux Desktop 未实机 |
| 插件体系 | DSH Host/Web Bundle、Cordis effect 生命周期、stock Settings、Agent Tools 与 Web 共用 `snapshot/dispatch`；最低 rc.8 与 rc.2 安装 CI 配置已在 main | 昨日 main CI/安装激活记录 | 无插件 risk/capability manifest、per-Run 插件/MCP/credential 准入 |
| 调度 | once/interval/daily/weekly/manual、IANA 时区、DST、deterministic occurrence、latest-only misfire、防重叠 | 自动化验收记录；本次未重跑 | 无 expected-vs-actual/dead-man；无事件 Trigger；无 Trigger lease/renewal contract |
| 执行/编排 | `claim → setup → executing → settling → delivery`、lease/heartbeat、whole-job deadline、保守中断恢复、target/model preflight | 普通超时/恢复路径有测试记录 | deadline 与 Agent 同进程 event loop，取消后仍等 `whenIdle`；非协作同步阻塞、五阶段强杀、进程级 watchdog NOT RUN；无 durable DAG/checkpoint/resume |
| 监控/通知 | Run history、phase、summary、结构化 error、unread、durable command receipt、read-after-write | 页面与测试记录见昨日验收 | 无 `expectedAt/overdueBy/lastProgressAt`、Attention/Outcome、稳定 lifecycle event、后台通知/outbox、逐目标 delivery receipt |
| 权限/生态 | read-only/workspace-write、approval=`never`、固定 unattended allowlist、禁止递归 Automation/交互工具/subagent/后台进程；Loopback RPC | 源码/测试记录，不是独立安全审计 | 无 per-role/per-Run effective capability snapshot；无 Trigger/Delivery Adapter；真实拒绝与旁路矩阵不完整 |

**今日仓库结论：** Observed 无新增实现；Tested 沿用昨日证据但本次没有新测试；下文所有能力进化均为 Inference，不写成已完成。

## 3. 高信号仓库热度与工程活动增量

今日累计 Star/Fork 值来自 GitHub 官方 HTML。只有 Hermes 有昨日与今日两次同源快照，可报告约 22 小时的 +724 Star/+207 Fork；其它仓库没有两次同源精确快照，不计算增速。匿名 REST 在批量采集时触发 rate limit 后，提交与 Release 改用 GitHub 官方 Atom feed；“最近 20 条”是 feed 上限，不代表窗口总量。

| 定位 | 项目 | 累计热度基线与本次活动 | 今日可验证变化 | 判断 |
|---|---|---|---|---|
| 直接竞品 | [NousResearch/Hermes Agent](https://github.com/NousResearch/hermes-agent) | 今日官方页 235,868 Star、47,593 Fork、29 Releases；相对昨日同源快照约 22 小时 +724 Star/+207 Fork；窗口 Issue 查询 251 条（自动生成内容会放大）；Atom 最近 20 commits 全在窗口、7 位作者 | 无新 Release，最新仍 [v0.20.5](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.19)；新增 [#94285](https://github.com/NousResearch/hermes-agent/issues/94285) 为 P1 Cron/tool timeout 故障 | 唯一可验证的同口径增长样本，热度与活动都高；优先借鉴监督/交付故障，不照搬体量 |
| 可集成/相邻平台 | [n8n](https://github.com/n8n-io/n8n) | 今日官方页 202,317 Star、约 60.4k Fork；窗口 Issue 查询 15 条；最近 20 commits / 15 位作者，全部在窗口 | 新 Release [`n8n@2.36.6`](https://github.com/n8n-io/n8n/releases/tag/n8n%402.36.6)，内容是窄 UI 修复，不关闭昨日永久 running [#36886](https://github.com/n8n-io/n8n/issues/36886) | 活跃度高；永久 running 仍未有公开修复证据，P0 health 不降级 |
| 可集成/相邻平台 | [Dify](https://github.com/langgenius/dify) | 今日官方页 153,405 Star、24,239 Fork；窗口 Issue 查询 26 条；Atom 最近 20 commits 全部在窗口、14 位显示作者（含 2 bot），故实际提交数只能写“至少 20” | 无新 Release；新增 lease 失效 [#41162](https://github.com/langgenius/dify/issues/41162) 与低置信 schedule drift [#41214](https://github.com/langgenius/dify/issues/41214) | Trigger 插件生态大，但“已注册/active”不是健康；Adapter contract 与 schedule invariant 优先于目录规模 |
| 可借鉴项目 | [LangGraph](https://github.com/langchain-ai/langgraph) | 今日官方页 40,379 Star、6,806 Fork；窗口内 4 个新 Issue、1 commit | 无新 Release；[#8704](https://github.com/langchain-ai/langgraph/issues/8704) 提供 event stream 与持久快照字段不一致的最小复现；[#8705](https://github.com/langchain-ai/langgraph/issues/8705) 报告 in-memory 可过、真实 saver 序列化失败 | 强化 event↔snapshot conformance；durable resume 仍 P2，不因热度提前扩状态机 |
| 可借鉴项目 | [CrewAI](https://github.com/crewAIInc/crewAI) | 今日官方页 57,563 Star、8,232 Fork；窗口内 2 个新 Issue、6 commits / 3 位作者 | 无新 Release；提交主要是 conversational flow/state/router 演进；[#7098](https://github.com/crewAIInc/crewAI/issues/7098) 是 streaming timeout cleanup 的测试提案，不是已观察故障 | 工程活跃但没有改变本项目优先级的新证据 |
| 可借鉴项目 | [github/gh-aw](https://github.com/github/gh-aw) | 今日官方页 4,991 Star、504 Fork；窗口 Issue 查询 176 条；最近 20 commits 全在窗口，但只有 `copilot-swe-agent` 与 `github-actions` 两个机器身份 | 无新 Release；大量自动生成 Issue/PR/报告持续产生 | 活动量高但自动化占比极高；不能把 Issue/commit 数等同于人类需求或贡献者 |
| 直接相邻竞品/用户样本 | [openai/codex](https://github.com/openai/codex) | 今日官方页 117,200 Star、17,869 Fork；窗口 Issue 查询 149 条；最近 20 commits / 16 位作者，全部在窗口 | 新预发布 [`0.150.0-alpha.8`](https://github.com/openai/codex/releases/tag/rust-v0.150.0-alpha.8)；新增通知 [#40482](https://github.com/openai/codex/issues/40482)、SSH 终态错标 [#40515](https://github.com/openai/codex/issues/40515) 与远程调度 [#40500](https://github.com/openai/codex/issues/40500) | 高频发布与 Issue 活跃并存；主要作为 Automation UX、Surface 与远程生命周期反例库 |
| 可借鉴/MCP | [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) | 今日官方页 13,094 Star；窗口 Issue 查询 4 条 | [#7841](https://github.com/microsoft/agent-framework/issues/7841) 在真实 MCP server 复现 connect/reconnect 漏鉴权 header，1.0.1 与 1.15.0 的 kwargs-dependent provider 均受影响 | 强化 handshake/reconnect auth preflight；不代表本项目已存在同一漏洞 |

## 4. 今日新增需求与映射

### 4.1 Trigger 需要“续租成功”的事实，不是配置仍 active

**Observed：** Dify [#41162](https://github.com/langgenius/dify/issues/41162) 在 Dify 1.16.1 Self-hosted 复现：插件创建订阅时返回真实到期时间，但数据库保存 `-1`；后台 refresh 每分钟运行且 OAuth token 正常刷新，Google Pub/Sub 与 Dify binding 仍显示 active，然而 Gmail 7 天租约到期后不再有 POST、没有错误或 UI 告警，重建后还会再次发生。Issue 作者同时指出这类错误可能影响 Microsoft Graph 等 lease-based provider；影响范围属于作者推断，尚无第二个 provider 的实测。

**Inference：** 对当前项目，近期最小动作仍是从现有 schedule + Runs 派生 `expectedAt/overdueBy/lastProgressAt`。未来做 Trigger Adapter 时，接口必须额外返回 `leaseExpiresAt/renewedAt/lastAcceptedEventAt` 与 renewal receipt；不能用 ACTIVE/credential-valid 推断可用。当前没有 Trigger，不新增 DB 实体、不做 Gmail 专用逻辑。

**低置信相邻证据：** Dify [#41214](https://github.com/langgenius/dify/issues/41214) 的单一用户称 10 分钟 Trigger 每 3–5 天会变为 2 分钟，Docker 重启后暂时恢复；采集时页面有 6 条交互，但正文主要是截图与现象，尚无维护者确认。它只加强“保存值、effective schedule、下次 occurrence 需做 invariant/audit”的必要性，不单独升级优先级，也不能写成 Dify 已确认 scheduler drift。

### 4.2 超时必须独立于被监督执行路径

**Observed：** Hermes [#94285](https://github.com/NousResearch/hermes-agent/issues/94285) 的 Cron terminal call 同步阻塞 4,118 秒；420 秒 tool deadline 与 600 秒 inactivity monitor 都依赖同一 asyncio loop，因此只在阻塞调用返回后才触发。Issue 标为 P1/High，链接到 77 个 stall/hang 报告的故障族；这个“77”是 Hermes 自身追踪口径，不代表跨项目用户数。

**Observed（本项目源码）：** Service 以 [`setTimeout → abort`](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/service.ts#L880-L925) 触发 whole-job deadline；Executor 也以 [`setTimeout → agent.cancel`](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/executor.ts#L212-L238) 竞争 `whenIdle()`，在超时/取消后再次等待 `whenIdle()`。这证明协作式取消已实现，但没有证明 event loop 被同步阻塞或 Agent 不响应取消时仍能按时收敛。

**Inference：** 新增验收应模拟“不响应 AbortSignal、阻塞同一 Host event loop、子进程不退出”三种边界；若 DSH Host 不能从同进程可靠回收，才把 watchdog 提升到进程/Host 边界。先补 fault-injection 与 observed evidence，不先发明 Worker 实体。

### 4.3 事件流必须与权威快照一致，通知也要可对账

**Observed：** LangGraph [#8704](https://github.com/langchain-ai/langgraph/issues/8704) 的最小复现显示 `values` event stream 会丢每条 message 的 `additional_kwargs`，而 `/state` 持久快照保留完整字段，实时 UI 看不到附件元数据、刷新后才恢复；作者称 Python/JS 同形，但采集时仍无维护者确认。LangGraph [#8705](https://github.com/langchain-ai/langgraph/issues/8705) 另报告 numpy scalar 在 in-memory 测试通过、真实 Postgres/SQLite saver 序列化失败；它继续支持 durable resume 暂缓，并要求生产 saver conformance/fail-closed。

**Observed：** Codex [#40515](https://github.com/openai/codex/issues/40515) 在多个无关 SSH 远程线程中观察到 rollout JSONL 继续增长并包含 `final_answer`、`task_complete`，Desktop/list API 却标成 `interrupted` 且没有 `completedAt`；报告也披露本地/远程 app-server 是相邻但不同版本，故 protocol skew 是前置排查项而非已确认根因。Codex [#40482](https://github.com/openai/codex/issues/40482) 另在 Arch Linux/KDE/Wayland 上复现：任务结束时不发通知，重新聚焦 App 才立即显示。单一平台报告尚不能证明跨平台通知根因。

**Inference：** 当前 `unread` 仍有价值，但只解决“回来后看到”，不解决“离开时及时知道”。P1 lifecycle/notification 纵切应先证明 event、Run snapshot、持久 transcript 和 UI/index 在 identity、revision、sequence、终态和业务字段上等价，再由独立消费者按 recipient 交付并保存 `committed/rejected/unknown` receipt；App focus 不能成为发布事件的前置条件。

### 4.4 远程项目也期待原生 Schedule，但先观察

**Observed：** Codex [#40500](https://github.com/openai/codex/issues/40500) 的用户经 Desktop SSH/远端 CLI 工作，现用远程 cron 启动 `codex exec` 作为 Schedule workaround，希望原生 CLI/Desktop Schedule。

**Inference：** 这是 remote runner/always-on host 的明确使用场景，但目前仅一条新 Issue。当前项目先完成本地 health、attention、delivery 和权限边界；P2 只记录 future runner contract（host identity、capability snapshot、lease、disconnect/reconnect），不实现分布式 Scheduler。

### 4.5 MCP 鉴权、有效角色与审计身份必须覆盖完整生命周期

**Observed：** Agent Framework [#7841](https://github.com/microsoft/agent-framework/issues/7841) 在真实部署的 MCP server 上复现：`call_tool()` 会注入 `header_provider`，但初始 `connect()` 与后续 reconnect 不带 header，服务端直接返回 401；Issue 作者同时核对 1.0.1 与 1.15.0，并给出 connect lifecycle task/ContextVar 的代码边界。采集时仍 Open、无关联修复 PR。

**Observed：** n8n [#36963](https://github.com/n8n-io/n8n/issues/36963) 报告 Project Admin 使用显式 Custom Instance Role 时，有效权限反而少于普通 Member role；[#36896](https://github.com/n8n-io/n8n/issues/36896) 报告 AI Assistant 走 custom gateway 时没有 user identity/audit logs。两者是用户报告，不等于已确认 n8n 授权漏洞，但共同证明“配置了 role/gateway”不能替代 effective actor/capability/audit 验证。

**Inference：** future MCP/connector preflight 必须分别覆盖 discovery、connect、call、reconnect 的 auth；持久化的是脱敏 effective actor、credential source、capability snapshot 和 audit correlation，而不是 secret。连接失败进入 `blocked`，角色降权/身份不可审计进入 `degraded` 或禁止激活；具体状态语义需人工确认。

### 4.6 昨日主线状态未关闭

- n8n 永久 running [#36886](https://github.com/n8n-io/n8n/issues/36886)：今日仍 Open、`status:in-linear`、无关联 PR；不能因为 `2.36.6` 发布就写成已修复。
- Hermes WebSocket 终态丢失 [#92710](https://github.com/NousResearch/hermes-agent/issues/92710)：今日仍 Open/needs-repro；继续作为 snapshot catch-up 证据，不重复新增建议。
- Hermes recipient 错绑 [#92859](https://github.com/NousResearch/hermes-agent/issues/92859) 与 Codex Surface 等待 [#40253](https://github.com/openai/codex/issues/40253)：今日无可验证关闭/Release/用户复测，维持昨日 P1 lifecycle + delivery receipt。
- 昨日 MCP identity/auth/spec/capability 主线得到 Agent Framework #7841 的新强证据；分层 preflight 维持 P1，并扩到 connect/reconnect 与 effective actor/audit，但仍不挤进今日 Top 5。
- Dify 精确窗口 Discussions 查询返回 “There are no matching discussions”；LangGraph/CrewAI 没有发现会改变优先级的新 Discussion。这里不把“无匹配”泛化为整个 GitHub 生态没有讨论。

## 5. 汇总映射与优先级

| 类别 | 项目或诉求 | 热度/需求信号 | 来源链接 | 当前能力与差距 | 建议改进或进化方向 | 影响 | 优先级 | 成本 | 风险/前置条件 | 可信度 |
|---|---|---|---|---|---|---|---|---|---|---|
| 当前项目/发布 | alpha.6 与稳定版验收 | 远端 ref/Release 在窗口内无变化；昨日 82/82、rc.8 Web/macOS Desktop 有记录 | [main](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c) · [Release](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.6) · [acceptance](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/docs/acceptance-results-2026-08-23-alpha.6.md) | rc.2 Desktop/真实模型 Run、Windows/Linux、卸载中断、阶段强杀仍缺；本次 NOT RUN | 完成既有矩阵并记录 observed 结果，不扩状态模型 | 极高：决定稳定版 Go/No-Go | P0 | M | 需要三平台/真实模型环境；失败必须可回滚 alpha.6 | 高 |
| 直接竞品/监督 | 同源 timer 无法监督同步阻塞 | Hermes 高增长样本；#94285 为 P1，4,118s 越过 420/600s 两层限制 | [Hermes #94285](https://github.com/NousResearch/hermes-agent/issues/94285) | 已有 whole-job deadline/phase/lease；非协作阻塞与阶段强杀未验证 | 补不响应 abort、Host loop block、子进程不退的 fault-injection；失败后再评估进程外 watchdog | 极高：避免永远 running | P0 | M | 先明确允许杀 Agent/Host 的边界；测试须隔离，避免污染用户进程 | 高：现象；中高：映射 |
| 可集成/Trigger | lease 到期但配置仍 active | Dify #41162 有 SQL、日志、7 天复发和 provider 代码路径 | [Dify #41162](https://github.com/langgenius/dify/issues/41162) | 当前无事件 Trigger；schedule 也无 expected-vs-actual health | 先做派生 occurrence health；future Adapter 强制 lease expiry/renewal/last-event receipt，失败 `blocked/degraded` | 高：防止静默漏执行 | P0（health）/P1（Adapter contract） | M | 当前不要先造 Trigger 实体；需先确认 provider 是否有 lease 语义 | 高：Gmail；中：泛化其它 provider |
| 监控/健康 | 永久 running 与零 progress | n8n 跨 DB/runner/Queue Mode；今日仍 Open/in Linear | [n8n #36886](https://github.com/n8n-io/n8n/issues/36886) | 已有 phase/heartbeat，缺 expectedAt/overdueBy/lastProgressAt | 从现有 Definition/Run 派生 dead-man；区分未 admission、queued、executing 卡住，不建 Health 表 | 极高：核心可靠性 | P0 | M | schedule/misfire 容差需先定义，避免把合法延迟误报为 overdue | 高 |
| 通知/交付 | App 不聚焦时完成通知延迟 | Codex #40482 是具体可复现路径，但仅 Linux/KDE 单例 | [Codex #40482](https://github.com/openai/codex/issues/40482) | 只有 durable unread；无后台消费者、recipient 与 delivery receipt | snapshot 为真相；独立消费者发本地通知，逐目标 receipt，可用 snapshot/cursor 补偿 | 高：降低 babysitting | P1 | M | 依赖 OS 通知权限/平台适配；通知失败不得改写 Run 终态 | 中高 |
| 生命周期/字段一致性 | event、snapshot、index 终态/字段分叉 | LangGraph #8704 有最小复现；Codex #40515 多 SSH 线程中 rollout 完成但 UI interrupted | [LangGraph #8704](https://github.com/langchain-ai/langgraph/issues/8704) · [Codex #40515](https://github.com/openai/codex/issues/40515) | 计划发布 lifecycle event，但无 schema/conformance；snapshot 是现有真相 | 做 event↔snapshot↔transcript↔index conformance；设置 payload guard，重连按 revision catch-up | 高：防止完成结果不可见/错标 | P1 | M | 需稳定 identity/revision/sequence；远程 protocol skew 要纳入兼容矩阵 | 高：现象；中高：通用映射 |
| 生命周期/Surface | 后端完成但界面仍等待 | 昨日 Hermes/Codex 两个独立产品同向，今日仍 Open | [Hermes #92710](https://github.com/NousResearch/hermes-agent/issues/92710) · [Codex #40253](https://github.com/openai/codex/issues/40253) | `snapshot/dispatch` 与 read-after-write 已有；无稳定 event identity/cursor | 复用权威 snapshot，事件带 runId/revision/sequence；重连 catch-up，不另建真相源 | 高 | P1 | M | 需决定 durable replay 还是 snapshot+cursor；避免双真相源 | 高 |
| 注意力 | no-change/needs-input/changes-ready | 今日无新重复证据，但昨日多仓库基线仍未关闭 | [8 月 24 日汇总](./automation-ecosystem-radar-2026-08-24.md) | 只有 status+unread，完成项价值不可稳定分类 | 在现有 Run/结束契约增加结构化 Attention/Outcome，不从 summary 猜 | 高：减少噪音并形成 Review Inbox | P0 | M | 需先定生产者、默认通知策略和向后兼容默认值 | 高 |
| 权限/MCP/审计 | connect/reconnect 鉴权、有效角色、actor audit | Agent Framework 真实 MCP 401；n8n 两条 role/identity 报告 | [MAF #7841](https://github.com/microsoft/agent-framework/issues/7841) · [n8n #36963](https://github.com/n8n-io/n8n/issues/36963) · [n8n #36896](https://github.com/n8n-io/n8n/issues/36896) | 固定 unattended allowlist；无 lifecycle auth test、effective actor/capability/audit snapshot | discovery/connect/call/reconnect 分层 preflight；保存脱敏 actor、credential source、effective tools 与 audit correlation | 极高：权限错误会阻塞或越权且难追责 | P1 | M | 不持久 secret；需 DSH 暴露有效身份/能力，配置错误 fail closed | 高：#7841；中高：n8n 报告 |
| 远程执行 | SSH 项目原生 Schedule | Codex #40500 单一明确请求，有 cron+CLI workaround | [Codex #40500](https://github.com/openai/codex/issues/40500) | 当前本地 Host/Workspace；无 remote runner | 只记录 runner contract，等本地可靠性闭环与重复需求后再立项 | 中：扩展 always-on 场景 | P2/观察 | XL | 需要 host identity、lease、版本兼容、断线恢复与远程权限模型 | 中 |
| 发布活跃 | 高频预发布不等于需求闭环 | n8n 2.36.6、Codex alpha.8 在窗口内发布；对应核心 Issues 未关闭 | [n8n 2.36.6](https://github.com/n8n-io/n8n/releases/tag/n8n%402.36.6) · [Codex alpha.8](https://github.com/openai/codex/releases/tag/rust-v0.150.0-alpha.8) | 当前项目稳定版也尚未达到 observed acceptance | Release、closing PR、用户复测分开记账；不按版本号推断修复 | 间接：防止错误决策 | — | — | 需维护证据状态机而非版本猜测 | 高 |
| 暂不投入 | DAG、多 Agent、分布式 Scheduler、大连接器目录、in-run HITL | 今日没有改变昨日风险/价值排序的新增重复证据 | [Hermes](https://github.com/NousResearch/hermes-agent) · [Dify](https://github.com/langgenius/dify) · [gh-aw](https://github.com/github/gh-aw) | 当前单 Root Agent、本地 Host 已覆盖近期核心场景 | 继续 P2；先闭合 health/attention/delivery/permission | 当前低、未来可能高 | P2/暂缓 | L–XL | 需先出现明确规模/场景与运维预算；避免状态机过早膨胀 | 高 |

## 6. 今日最值得推进的 Top 5

1. **P0：完成稳定版剩余 observed acceptance。** 补 rc.2 Desktop + 真实模型完整 Run、Windows/Linux Desktop、运行中卸载、真实 permission denial/timeout；结果必须写成 PASS/FAIL/NOT RUN，不能用 CI 或计划代替实机。
2. **P0：把 occurrence dead-man health 落到现有 snapshot/UI。** 从 schedule、Definition 和最新 Run 派生 `expectedAt/overdueBy/lastProgressAt`，区分 Host 未醒、admission 未发生、排队与 executing 卡住；不建新表。
3. **P0：增加非协作阻塞 fault-injection。** 在现有 Supervisor 验收中加入“不响应 AbortSignal”“Host event loop 阻塞”“子进程不退出”；若 whole-job deadline 不能按时收敛，再评估进程/Host 边界 watchdog。
4. **P0：把 unread 升级为结构化 Attention/Outcome。** `no_change/needs_input/changes_ready/failed/blocked` 由结束契约产生；成功 no-op 默认静默，不能从 summary 文本猜。
5. **P1：做可补偿 lifecycle + 本地通知纵切。** 复用 Run snapshot/Receipt，事件带 identity/revision/sequence，并补 event↔snapshot 字段一致性与 payload guard；App 不聚焦也可交付，重连可 catch-up，保存 recipient 与逐目标 receipt，允许 `partial_success`。

相较昨日：Top 5 的 MCP preflight 被“非协作阻塞验收”替代；前者仍是 P1，不是取消。Trigger lease contract 先作为未来 Adapter 的准入条件，当前不单独造实体。

## 7. 证据不足、访问限制与人工确认

1. **只有 Hermes 有可比的短窗增长。** 8 月 24/25 两次都是 GitHub 官方 HTML 同源快照，间隔约 22 小时，因此 +724 Star/+207 Fork 可验证；它仍不是 GitHub 官方“日增长”指标。其它仓库没有两次同源精确快照，不报告增速；匿名 REST rate limit 后也未用第三方估算补值。
2. **工程活动与 Issue 计数有口径限制。** Atom 只返回最近 20 条；“20/作者数”是下限/样本，不是窗口总提交数。精确窗口 Issue 查询分别为 Hermes 251、Codex 149、gh-aw 176、Dify 26、n8n 15、Agent Framework 4；Hermes/gh-aw 含大量自动生成内容，不能等同于独立人类需求数，亦不横向当热度排名。
3. **Issue 现象不等于维护者确认根因。** Dify #41162、Hermes #94285、Agent Framework #7841 与 Codex #40515 的证据链较完整，但采集时均 Open、无关联修复 PR/Release；对其它 provider、DSH Host 的泛化是 Inference，需本项目 fault-injection、conformance 与 Adapter contract 验证。
4. **Discussions 增量不足。** Dify 的官方精确窗口查询明确返回无匹配；本窗口没有确认到能改变优先级的高信号新 Discussion；未把自动生成的 gh-aw 日报 Discussion 数当用户需求频次。
5. **X 增量受访问与时间窗口限制。** 本次搜索能看到若干旧公开原帖，但没有确认落在精确增量窗口内的新原帖；因此未引用旧帖互动量或用搜索摘要凑增量。结论是“本窗口无可纳入的 X 新证据”，不是“X 上无人讨论”。部分候选直开仍可能为空/403，标记为**受访问限制**。
6. **远端 ref 已重验，tree 一致性未重验。** 今日 `git ls-remote` 确认 remote main/tag 未变，本地 HEAD/tree 也未变；但远端 `b0bb2db` 对象不在本地，故两者 tree=`832a603` 仍来自昨日验证。本次没有 fetch，也没有运行测试。
7. **需要人工确认四项语义。** 一是非协作阻塞发生时允许 Host 杀到什么边界；二是 lifecycle 消费者采用 durable replay 还是 snapshot+cursor catch-up；三是 future Trigger lease 失效应显示 `blocked`、`degraded` 还是独立 health badge；四是 auth/role 可连接但 effective actor 不可审计时应降级还是禁止激活。

## 8. 今日证据索引

- 当前项目：[main `b0bb2db`](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c) · [alpha.6](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.6) · [验收记录](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/docs/acceptance-results-2026-08-23-alpha.6.md)。
- 超时/监督：[Hermes #94285](https://github.com/NousResearch/hermes-agent/issues/94285) · [n8n #36886](https://github.com/n8n-io/n8n/issues/36886)。
- Trigger lease：[Dify #41162](https://github.com/langgenius/dify/issues/41162) · [Gmail Trigger provider](https://github.com/langgenius/dify-official-plugins/blob/main/triggers/gmail_trigger/provider/gmail_trigger.py)。
- 调度漂移（低置信）：[Dify #41214](https://github.com/langgenius/dify/issues/41214)。
- 事件/快照与 durable saver：[LangGraph #8704](https://github.com/langchain-ai/langgraph/issues/8704) · [LangGraph #8705](https://github.com/langchain-ai/langgraph/issues/8705)。
- 生命周期错标/通知/远程调度：[Codex #40515](https://github.com/openai/codex/issues/40515) · [Codex #40482](https://github.com/openai/codex/issues/40482) · [Codex #40500](https://github.com/openai/codex/issues/40500)。
- MCP/权限/审计：[Agent Framework #7841](https://github.com/microsoft/agent-framework/issues/7841) · [n8n #36963](https://github.com/n8n-io/n8n/issues/36963) · [n8n #36896](https://github.com/n8n-io/n8n/issues/36896)。
- 生命周期/交付（昨日主线状态追踪）：[Hermes #92710](https://github.com/NousResearch/hermes-agent/issues/92710) · [Hermes #92859](https://github.com/NousResearch/hermes-agent/issues/92859) · [Codex #40253](https://github.com/openai/codex/issues/40253)。
- 窗口内 Release：[n8n 2.36.6](https://github.com/n8n-io/n8n/releases/tag/n8n%402.36.6) · [Codex 0.150.0-alpha.8](https://github.com/openai/codex/releases/tag/rust-v0.150.0-alpha.8)。

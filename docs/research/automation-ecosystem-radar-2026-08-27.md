# 自动化生态与用户需求雷达日报（2026-08-27）

> 数据采集时间：2026-08-27 10:18—10:32（Asia/Shanghai，UTC+08:00）。
> 精确外部增量窗口：2026-08-26T02:15:14.272Z（上次运行）至 2026-08-27T02:32:30Z。
> 范围：当前项目、AI Agent 自动化、任务调度与工作流编排、插件/MCP、监控、通知和权限。只做调研与建议；未修改业务代码、未运行测试、未提交 Issue、未发布内容、未对外联系。
> 证据标记：**Observed** = 本轮直接读取本地 Git/源码/验收记录或 GitHub 官方仓库、Release、Issue；**Maintainer-reproduced** = 上游 Issue 有维护者 `reproduced` 标签；**Reported** = 报告者给出复现或数据但未获维护者确认；**Inference** = 面向当前项目的映射，不是已实现事实。

## 1. 执行摘要

1. **当前项目与发布基线没有变化。** GitHub 官方 API 于 10:18 CST 显示远端 `main` 仍为 [`b0bb2db`](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c)，tree=`832a603`，与本地 `chore/dsh-rc2-compat@0920888` 的 tree 一致；最新 Release 仍为 [`v0.1.0-alpha.6`](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.6)，main CI 仍为成功。82/82、rc.8 Web/macOS Desktop E2E、rc.2 install/activation 只沿用既有验收，本轮 **NOT RUN**；稳定版继续 NO-GO。
2. **今日最高强度的真实需求信号是“任务已提交，但没有 Runner 接单”。** n8n 官方搜索在窗口内计到 28 个新 Issue；本轮直接解析到的 24 个标题里，至少 17 个明确属于 Cloud Code task-runner timeout，同一症状从 [#37069](https://github.com/n8n-io/n8n/issues/37069) 延续到 [#37161](https://github.com/n8n-io/n8n/issues/37161)、[#37180](https://github.com/n8n-io/n8n/issues/37180) 等。#37069 用空白 workflow 和单行代码仍稳定等待 66 秒后失败，已被标为 duplicate、in-Linear、team-assigned。这个短窗重复量比单个复杂复现更强地支持 P0 admission/runner availability/queue-wait 健康与告警。
3. **恢复和持久化必须形成可重放的终态协议。** OpenAI Agents SDK [#4685](https://github.com/openai/openai-agents-python/issues/4685) 与 [#4690](https://github.com/openai/openai-agents-python/issues/4690) 分别用 16 行故障矩阵证明：approval/handoff 或 terminal tool output 之后若 Session append 失败，RunState、Session、replay 和 final output 会分叉；Hermes [#95957](https://github.com/NousResearch/hermes-agent/issues/95957) 又显示恢复函数成功返回同一 session id 时，startup sweep 仍会删除 route，导致消息静默失联。当前项目应优先补 `persist-before-notify`、read-after-write、restart/recovery 负向矩阵，而不是新增一套状态实体。
4. **权限/能力的“声明值”与“有效身份”继续分裂。** Dify [#41316](https://github.com/langgenius/dify/issues/41316) 在 1.17.0 上 100% 复现 workspace token 被当作 Owner 执行，导致 list 与 direct GET 权限不一致；这与昨日 Dify effect 漏标、MCP discovery/call 分裂形成连续证据。建议在现有 preflight/Receipt 上保存脱敏 effective actor、permission、resolved tool/MCP/skill/version，不建立新的凭据或权限配置流。
5. **HITL/长任务的需求真实，但不应抢占当前稳定性主线。** LangGraph [#8725](https://github.com/langchain-ai/langgraph/issues/8725) 证明 MCP 暴露的 assistant tool 默认临时 Run，没有 checkpoint/thread handle，无法 pause/resume 或事后追踪；Agent Framework [#7872](https://github.com/microsoft/agent-framework/issues/7872) 被维护者标为 reproduced，要求对悬空 tool/approval 定义 result/reject/cancel 等 closure。当前项目没有 in-run approval 主线，先借鉴 explicit `needs_input/blocked/cancelled` 与 dangling-work cleanup，durable HITL/MCP Run 维持 P2。

## 2. 当前项目能力与证据边界

| 能力面 | 已具备（Observed） | 已验证（沿用既有记录） | 仍缺或本轮 NOT RUN |
|---|---|---|---|
| 自动化任务 | 持久 Definition/Run/Command Receipt；创建、编辑、暂停、恢复、删除、立即运行、取消、mark-read；Fresh Root Agent + Result Session | 82/82、rc.8 Web/macOS Desktop 核心 E2E | 本轮未跑测试；无结构化 Outcome/Attention；Windows/Linux Desktop 未实机 |
| 插件体系 | DSH Host/Web Bundle、Cordis effect lifecycle、Agent Tools/Web 共用 snapshot/dispatch；rc.8/rc.2 安装配置 | main CI、既有安装/激活记录 | 无 per-Run Skill/MCP/version/effective capability snapshot；无插件 risk/effect manifest |
| 调度 | once/interval/daily/weekly/manual、IANA 时区、DST、deterministic occurrence、latest-only misfire、防重叠 | 既有自动化与实机验收记录 | 无 expected-vs-actual/dead-man、runner queue wait、scheduled/manual parity canary、事件 Trigger |
| 执行/恢复 | `claim → setup → executing → settling → delivery`、lease/heartbeat、whole-job deadline、保守恢复、target/model preflight | 协作式超时/恢复路径有测试记录 | 非协作阻塞、五阶段强杀、持久化失败矩阵、restart route/recipient 恢复 NOT RUN |
| 监控/通知 | Run history、phase、summary、结构化 error、unread、durable Receipt/read-after-write | 页面与测试记录见既有验收 | 无 `expectedAt/overdueBy/queueWait/lastProgressAt`、Outcome/Attention、lifecycle event、逐目标 delivery receipt |
| 权限/生态 | read-only/workspace-write、approval=`never`、固定 unattended allowlist、递归/交互/后台进程限制；Loopback RPC | 源码/测试记录，不是独立安全审计 | 无 effective actor/effect/capability snapshot；MCP discovery/connect/call/reconnect 负向矩阵缺失 |

**状态边界：** 本地 tracked diff 为空，08-23 至 08-26 日报均为 untracked；本轮只新增本日报。DeepSeek Harness 最新仍为 [`dsh-v0.1.1-rc.2`](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.1-rc.2) 对应的既有宿主兼容基线；没有把 Release、测试记录或源码 Inference 写成当前生产接受。昨日指出的 legacy `delete → reopen` 风险仍是源码 **Inference / NOT RUN**，本轮未升级为已发生事实。

## 3. 热度与活动增量

累计 Star/Fork 从 GitHub 官方仓库 HTML 内嵌计数读取，采样于 10:23 CST。短窗增长只在昨日有同源快照的项目上计算；约 24 小时区间不是“日增速”。Issue 数来自 GitHub 官方搜索 `is:issue created:>=2026-08-26T02:15:14Z`；Hermes 自动 sweeper/重复报告很多，不能把数量当独立用户数。提交 Atom feed 只显示最近约 20 条，因此“≥20”是下限。生态全量 REST 批采受共享出口限流，当前项目与核心 Issue 已单独用官方 API 回查；本轮不伪造精确贡献者数。

| 定位 | 项目 | 当前热度及区间变化 | 窗口活动 | 新增高信号 | 判断 |
|---|---|---:|---|---|---|
| 直接竞品 | [Hermes Agent](https://github.com/NousResearch/hermes-agent) | 236,921 Star / 47,920 Fork；较昨日 `+470/+173` | 208 新 Issue；提交 feed 窗口内至少 20 条；无新 Release | [#95957](https://github.com/NousResearch/hermes-agent/issues/95957) 恢复成功仍被 startup sweep 删除 route；[#96016](https://github.com/NousResearch/hermes-agent/issues/96016) 再报 stdio MCP liveness 极性反转 | 活跃度和增长最高，但 Issue 机器化严重；只采用有复现、对照或现场数据的样本 |
| 可集成平台 | [n8n](https://github.com/n8n-io/n8n) | 202,534 / 60,410；`+108/+25` | 28 新 Issue；提交 feed ≥20；最新 stable 2.37.1 在窗口前发布 | 至少 17/28 标题明确 task-runner timeout；[#37069](https://github.com/n8n-io/n8n/issues/37069) 已 duplicate/in-Linear/team-assigned | 今日最强重复诉求；Release 存在不等于 incident 已修复 |
| 可集成平台 | [Dify](https://github.com/langgenius/dify) | 153,602 / 24,272；`+89/+13` | 19 新 Issue；提交 feed ≥20；1.17.0 在窗口前发布 | [#41316](https://github.com/langgenius/dify/issues/41316) effective actor/RBAC 不一致；[#41313](https://github.com/langgenius/dify/issues/41313) 要求插件升级删除模型时给引用预警 | 插件/version 能力强，但配置有效性与权限一致性仍是缺口 |
| Agent Workflow | [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) | 28,985 / 4,605 | 12 新 Issue；提交 feed 约 2 条 | [#4685](https://github.com/openai/openai-agents-python/issues/4685)、[#4690](https://github.com/openai/openai-agents-python/issues/4690) 均有 16-row persistence fault matrix | 对当前 Receipt/read-after-write 的 P0 验收价值高；不是要求移植 SDK 状态机 |
| Agent Workflow | [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) | 13,136 / 2,230；`+25/+4` | 3 新 Issue；提交 feed 约 9 条 | [#7872](https://github.com/microsoft/agent-framework/issues/7872)、[#7890](https://github.com/microsoft/agent-framework/issues/7890) 均标 `reproduced`；后者 5,000/5,000 abandoned approval 未清理 | 支持显式 closure 和 bounded cleanup；in-run approval 仍 P2 |
| Agent Workflow | [LangGraph](https://github.com/langchain-ai/langgraph) / [CrewAI](https://github.com/crewAIInc/crewAI) | 40,507 / 6,831，`+56/+6`；57,656 / 8,260，`+44/+13` | LangGraph 1、CrewAI 2 新 Issue；无新 Release | LangGraph [#8725](https://github.com/langchain-ai/langgraph/issues/8725) 的 MCP temporary Run 无 handle/checkpoint；CrewAI 无改序的新证据 | durable MCP/HITL 有需求，但与当前产品主线距离较远 |
| 调度基建 | [Temporal](https://github.com/temporalio/temporal) / [Airflow](https://github.com/apache/airflow) / [Prefect](https://github.com/PrefectHQ/prefect) | 22,550 / 1,839；46,614 / 17,684；23,693 / 2,483 | 2 / 6 / 2 新 Issue；Airflow 窗口有组件 Release | Airflow [#72123](https://github.com/apache/airflow/issues/72123) 报告 deferrable delete 未执行但 task success | 继续作为状态、清理和 outcome 参考；不建议移植分布式 Scheduler |
| 自动化/插件生态 | [Activepieces](https://github.com/activepieces/activepieces) / [Windmill](https://github.com/windmill-labs/windmill) / [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | 24,051 / 4,103，`+15` Star；17,688 / 1,085，`+10`；16,135 / 1,423 | 6 / 4 / 1 新 Issue；Activepieces 有 0.88.4 系列发布 | [Activepieces #15069](https://github.com/activepieces/activepieces/issues/15069) trigger watermark 永久漏事件；[#15067](https://github.com/activepieces/activepieces/issues/15067) 要求 soft-delete tombstone；[Windmill #10860](https://github.com/windmill-labs/windmill/issues/10860) 大结果被替换但 job success；[#10861](https://github.com/windmill-labs/windmill/issues/10861) 再报 effective schedule 漂移 | 强化 idempotency/tombstone/outcome/health；不支持自建大连接器目录 |
| MCP 生态 | [MCP Servers](https://github.com/modelcontextprotocol/servers) / [Registry](https://github.com/modelcontextprotocol/registry) | 89,893 / 11,513；7,193 / 966，Registry `+2` Star | 各 1 个新 Issue；Registry 无新 Release | Registry [#1575](https://github.com/modelcontextprotocol/registry/issues/1575) 要求下架 remote 已 NXDOMAIN 的三个已发版本 | 市场目录需要持续 liveness/撤回/版本准入；当前只做 effective preflight |

## 4. 新增需求映射

### 4.1 P0：把“等不到 Runner”做成独立健康与告警

**证据：** n8n [#37069](https://github.com/n8n-io/n8n/issues/37069) 的 `Manual Trigger → Code` 空白 workflow、单行 JS 仍在 66 秒后报 “not matched to a runner”；同窗至少 17 个标题明确重复这一症状，覆盖多个 Cloud 实例。Issue 已进入 Linear/团队分派，但没有窗口内修复 Release 证据。

**差距与最小动作（Inference）：** 当前项目已有 occurrence、Run、phase、lease/heartbeat，却没有 admission/queue/runner availability 的拆分。复用现有 Definition、occurrence、Run 和 phase 派生 `expectedAt/admittedAt/claimedAt/queueWait/lastProgressAt/overdueBy`；新增 scheduled/manual parity 与 “无 claim/无 progress” canary。不要新增 Health 表，先让 UI/通知从现有事实派生。用户价值是让“任务没跑”在用户发现前变成可定位、可告警的阶段事实。影响极高，成本 M，P0；前置是明确 misfire、overlap、长任务的正常语义，避免把合法排队误报为故障。

### 4.2 P0：持久化失败后必须 fail closed，并能判断“已提交但回执丢失”

**证据：** Agents SDK [#4685](https://github.com/openai/openai-agents-python/issues/4685) 的 16 行矩阵显示 atomic fail-before-commit 时 Session 永久缺 tool/handoff output，而 RunState/replay 有完整 pair；[#4690](https://github.com/openai/openai-agents-python/issues/4690) 的 16 行矩阵显示 terminal append 失败后 0/16 保留 terminal checkpoint，重试 16/16 再进模型并产生不同 final。Windmill [#10860](https://github.com/windmill-labs/windmill/issues/10860) 和 Airflow [#72123](https://github.com/apache/airflow/issues/72123) 又从 outcome 侧报告“结果/清理没发生但任务成功”。

**差距与最小动作（Inference）：** 复用现有 durable Receipt/read-after-write，补 `fail-before-commit / commit-then-ack-lost / partial-or-ambiguous-tail` 矩阵；只有确认 terminal snapshot 与 Result Session 均持久化后才能通知 `ok`，歧义应 `unknown/blocked` 并停止新副作用。把 `executed/persisted/visible/delivered` 做成可对账事实，不新建分布式事务。用户价值是消除假成功，并让重试不会重复外部副作用。影响极高，成本 M，P0；前置是产品确认哪些持久化与交付步骤属于 Run 成功的硬条件。

### 4.3 P0/P1：恢复、删除和 route/tombstone 要验证跨重启不变量

**证据：** Hermes [#95957](https://github.com/NousResearch/hermes-agent/issues/95957) 报告恢复函数成功返回同一 session id 后，调用方仍将 route prune，现场为 52 次 prune、0 次 repoint、10 个 Telegram topic 受影响，表现为消息静默失联。Activepieces [#15067](https://github.com/activepieces/activepieces/issues/15067) 要求 soft-delete flow 保留 Run 归属和 analytics reconciliation。

**差距与最小动作（Inference）：** 先补 `recover same id / recover new id / no recovery / reset boundary` 四分支测试；现有 route/recipient/Session identity 必须显式记录 keep/repoint/prune reason。昨日 legacy `delete → reopen` 风险继续先做隔离复现；若成立，优先让 committed delete Receipt 成为 re-import tombstone。用户价值是避免重启后静默失联或已删除任务复活。影响极高，测试成本 S-M，P0；运行机制调整 P1。风险是永久 tombstone 会影响未来重新导入语义，需先定义显式恢复入口和保留周期。

### 4.4 P1：保存 effective actor/capability，而不是相信声明配置

**证据：** Dify [#41316](https://github.com/langgenius/dify/issues/41316) 在两个不同创建者的 token 上返回字节级一致的 Owner 视图，list 看不到 Member `only_me` 数据，direct GET 却能 200；报告给出 9 个 dataset 对照并指向 owner impersonation 路径。MCP Registry [#1575](https://github.com/modelcontextprotocol/registry/issues/1575) 则说明已登记并已发版不代表 remote 仍可达。

**差距与最小动作（Inference）：** 在已有 target/model preflight 与 Receipt 中追加脱敏 effective snapshot：actor/role、permission preset、resolved tool/MCP/skill/version、endpoint identity、effect、credential source；分开验证 discovery/connect/call/reconnect/liveness，声明与实测不符时 `blocked`。不保存 secret，不增加一套权限实体。用户价值是把越权、失效插件和“能发现但不能调用”提前变成可审计阻塞。影响高，成本 M，P1；前置是定义脱敏字段和最短保留期，避免审计数据反过来泄露身份或凭据来源。

### 4.5 P1/P2：悬空 tool/approval 需要 closure；durable MCP/HITL 暂缓

**证据：** MAF [#7872](https://github.com/microsoft/agent-framework/issues/7872) 的 reproduced 场景要求旧 Run 的 pending tool/approval 在接受新消息前必须 result/reject/cancel 或重新展示；[#7890](https://github.com/microsoft/agent-framework/issues/7890) 在真实实现上 5,000 次 policy violation 留下 5,000 个 pending entry。LangGraph [#8725](https://github.com/langchain-ai/langgraph/issues/8725) 说明 MCP temporary Run 没有 thread/checkpoint，既不能 interrupt/resume，也无事后 handle。

**差距与最小动作（Inference）：** 当前项目先把 `needs_input/blocked/cancelled/expired` 做成结构化 Outcome/Attention，并为 abandoned state 增加 TTL/上限/Run cleanup；这属于 P1、成本 M。返回 `runId/threadId` 的 durable MCP Run 和 in-run approval 是 P2、成本 L-XL，前置是稳定版验收、明确身份与保留策略。

## 5. 汇总表

| 类别 | 项目或诉求 | 热度/需求信号 | 来源链接 | 当前能力与差距 | 建议改进或进化方向 | 优先级 | 成本 | 可信度 |
|---|---|---|---|---|---|---|---|---|
| 当前发布 | alpha.6 稳定版验收 | ref/tree/Release 无变化；既有 82/82 与 rc.8/macOS 记录，本轮 NOT RUN | [main](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c) · [alpha.6](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.6) | rc.2 真实模型、Windows/Linux、卸载/强杀矩阵不足 | 完成既有验收矩阵，严格 PASS/FAIL/NOT RUN | P0 | M | 高 |
| 调度健康 | Runner 无接单 | n8n 28 新 Issue，至少 17 个标题同类；#37069 最小复现且 in-Linear | [#37069](https://github.com/n8n-io/n8n/issues/37069) · [#37161](https://github.com/n8n-io/n8n/issues/37161) | 有 schedule/occurrence/lease；无 admission/queueWait/dead-man | 派生 expected/admitted/claimed/progress；scheduled/manual parity | P0 | M | 高 |
| 持久化/终态 | Session append 失败后状态分叉 | 两个 16-row deterministic matrix；Windmill/Airflow 独立假成功报告 | [Agents #4685](https://github.com/openai/openai-agents-python/issues/4685) · [#4690](https://github.com/openai/openai-agents-python/issues/4690) · [Windmill #10860](https://github.com/windmill-labs/windmill/issues/10860) | 有 Receipt/read-after-write；缺 ack-lost/ambiguous-tail 矩阵 | persist-before-notify；歧义 fail closed；四段 outcome | P0 | M | 高/中高 |
| 恢复/删除 | 恢复成功却 prune route；删除需 tombstone | Hermes 52 prune/0 repoint/10 topics；Activepieces 新诉求 | [Hermes #95957](https://github.com/NousResearch/hermes-agent/issues/95957) · [Activepieces #15067](https://github.com/activepieces/activepieces/issues/15067) | 有保守恢复/delete Receipt；跨重启不变量不足 | recovery 四分支；优先复用 delete Receipt 作 tombstone | P0/P1 | S-M | 中高 |
| 权限/插件 | effective actor/能力与声明不一致 | Dify 9 dataset、2 token 100% 复现；Registry remote NXDOMAIN | [Dify #41316](https://github.com/langgenius/dify/issues/41316) · [Registry #1575](https://github.com/modelcontextprotocol/registry/issues/1575) | 固定 allowlist/preflight；无 effective snapshot/全阶段 liveness | 复用 Receipt 记录脱敏 actor/effect/version；负向矩阵 | P1 | M | 中高 |
| Outcome/Attention | 悬空 tool/approval 无 closure | MAF 两个 reproduced；5,000/5,000 pending 未清理 | [MAF #7872](https://github.com/microsoft/agent-framework/issues/7872) · [#7890](https://github.com/microsoft/agent-framework/issues/7890) | 有 cancel/unread；无 structured needs_input/expired | 显式 terminal + TTL/上限/Run cleanup | P1 | M | 高 |
| MCP/HITL | MCP temporary Run 无 checkpoint/handle | LangGraph 单一但完整源码路径与双版本复现 | [LangGraph #8725](https://github.com/langchain-ai/langgraph/issues/8725) | 当前无 durable MCP Run/in-run HITL | 只借鉴 handle/retention contract；实现暂缓 | P2 | L-XL | 中高 |
| Trigger | watermark 缺陷永久漏事件 | Activepieces 新 Issue，延续昨日重复/漏事件证据 | [#15069](https://github.com/activepieces/activepieces/issues/15069) | 当前无事件 Trigger Adapter | future adapter 保留 event id/watermark/idempotency，接现有 admission | P1 设计/P2 实现 | M-L | 中 |
| 暂缓能力 | DAG、多 Agent、分布式 Scheduler、大连接器市场 | 高热仓库有供应但当前需求闭环不足 | [Temporal](https://github.com/temporalio/temporal) · [MCP Servers](https://github.com/modelcontextprotocol/servers) | 当前深度足以支撑本地定时自动化 | 继续观察，不追体量 | P2 | XL | 中 |

## 6. 今日最值得推进的 Top 5

1. **P0：完成稳定版剩余 observed acceptance。** rc.2 Desktop + 真实模型完整 Run、Windows/Linux、运行中卸载、permission denial/timeout、逐阶段强杀必须记录 PASS/FAIL/NOT RUN。
2. **P0：加入 admission/runner 健康。** 复用现有 Definition/occurrence/Run/phase 派生 `expectedAt/admittedAt/claimedAt/queueWait/lastProgressAt/overdueBy`，补 scheduled/manual parity 和 no-claim canary。
3. **P0：补持久化回执故障矩阵。** 覆盖 fail-before-commit、commit-then-ack-lost、partial/ambiguous tail；terminal snapshot 与 Result Session 未确认前不得通知 `ok`。
4. **P0/P1：验证跨重启恢复与删除不变量。** 加 recover-same/repoint/prune/reset 四分支；先动态复现 legacy delete→reopen，成立时优先复用 committed delete Receipt 作 tombstone。
5. **P1：effective actor/capability + Outcome/Attention。** 复用 preflight/Receipt 保存脱敏 actor/effect/version/endpoint；结构化 `no_change/needs_input/changes_ready/failed/blocked/cancelled/expired` 并清理 abandoned state。

相较昨日，n8n task-runner timeout 的短窗重复密度是今日唯一足以强化 P0 排序的外部新变化；Agents SDK 的持久化 fault matrix 和 Hermes recovery/prune 是新增的验证设计证据。DAG、多 Agent、分布式 Scheduler、大连接器目录、云 sandbox、durable MCP Run 与 in-run HITL 继续 P2/暂缓。

## 7. 证据不足、访问受限与人工确认

1. **X 受访问限制。** 用 `n8n/Dify/Hermes + runner/schedule/automation`、`AI agent + cron/scheduler`、`MCP + workflow` 做精确窗口检索，没有返回可核验的 X 原帖，只返回 X 帮助页或窗口外内容；未采用搜索摘要、互动量或旧帖补结论。这不等于 X 上没有讨论。
2. **GitHub Discussions 增量证据不足。** 精确窗口内没有取得可直接打开并核验、且会改变排序的新 Discussion；部分仓库未启用 Discussions，跨仓库搜索也不能证明“没有讨论”。本轮不拿 Issue 搜索结果代替 Discussion 结论。
3. **GitHub 批量 API 受限。** 当前项目、Release、main CI 和本文核心 Issue 已通过 GitHub 官方 API 回查；但生态全量批采在共享出口遇到限流，因此热度/窗口统计使用 GitHub 官方 HTML、Issue 搜索页和 Atom feed补齐。精确 commit author/contributor 数本轮不可验证。
4. **Issue 数不是用户数。** Hermes 的 208 个 Issue 含大量 sweeper/duplicate/自动生成项；n8n 的 28 个 Issue 也有重复关闭。本文把重复密度当 incident/需求强度信号，不当独立用户计数。
5. **上游报告边界。** MAF #7872/#7890 有 `reproduced` 标签；n8n、Dify、Agents SDK、Hermes、Activepieces、Windmill、Airflow 的数据主要由报告者提供。除页面状态/标签外，本轮没有运行上游复现或确认修复已发布。
6. **Star 增长边界。** 仅对昨日与今日同源 HTML 快照计算区间差值；约 24 小时窗口不是稳定日速，也不代表部署量、满意度或商业成功。
7. **需要人工确认。** 一是 queued/no-runner 多久算 overdue；二是 execution 完成但 Session/delivery 失败时 Run status 与通知语义；三是 delete Receipt 是否是永久 tombstone；四是 `needs_input` 的 TTL、过期后的默认 closure 与是否创建 follow-up Run。

## 8. 一手证据索引

- 当前项目：[main `b0bb2db`](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c) · [alpha.6](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.6) · [main CI](https://github.com/usersx/dsh-automation-center/actions/runs/32622993112)。
- Runner/调度：[n8n #37069](https://github.com/n8n-io/n8n/issues/37069) · [#37161](https://github.com/n8n-io/n8n/issues/37161) · [#37180](https://github.com/n8n-io/n8n/issues/37180) · [Windmill #10861](https://github.com/windmill-labs/windmill/issues/10861) · [Activepieces #15069](https://github.com/activepieces/activepieces/issues/15069)。
- 持久化/恢复：[Agents SDK #4685](https://github.com/openai/openai-agents-python/issues/4685) · [#4690](https://github.com/openai/openai-agents-python/issues/4690) · [Hermes #95957](https://github.com/NousResearch/hermes-agent/issues/95957) · [Windmill #10860](https://github.com/windmill-labs/windmill/issues/10860) · [Airflow #72123](https://github.com/apache/airflow/issues/72123)。
- 权限/closure/MCP：[Dify #41316](https://github.com/langgenius/dify/issues/41316) · [MAF #7872](https://github.com/microsoft/agent-framework/issues/7872) · [#7890](https://github.com/microsoft/agent-framework/issues/7890) · [LangGraph #8725](https://github.com/langchain-ai/langgraph/issues/8725) · [MCP Registry #1575](https://github.com/modelcontextprotocol/registry/issues/1575)。

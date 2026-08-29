# 自动化生态与用户需求雷达日报（2026-08-24）

> 数据采集时间：2026-08-24 12:48—13:00（Asia/Shanghai，UTC+08:00）  
> 增量窗口：以前次基线报告完成时间 2026-08-23 12:06 为起点；重复结论只保留必要上下文。  
> 当前项目：远端 `main@b0bb2db`；本地工作分支 `chore/dsh-rc2-compat@0920888` 与远端 main 的 Git tree 均为 `832a603`，源码内容一致。公开版本与 npm `latest` 均为 `0.1.0-alpha.6`。  
> 范围：当前仓库、AI Agent 自动化、调度/编排、插件与 MCP 生态。只做调研与建议；未修改业务代码、未提交 Issue、未发布内容、未对外联系。

## 1. 执行摘要

1. **昨日的首要发布风险已显著收敛，但稳定版仍是 NO-GO。** alpha.6 已公开发布；rc.8 Web 与 macOS Desktop 2.0.1 核心端到端、82/82 自动化测试和三平台 CI 有记录，最新 main 还把 stock 安装矩阵扩到 DSH `0.1.1-rc.2`。但 rc.2 Desktop/真实模型完整 Run、Windows/Linux Desktop、运行中卸载和 Supervisor 分阶段强杀仍未执行，不能升级为稳定版通过。[main commit](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c) · [验收记录](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/docs/acceptance-results-2026-08-23-alpha.6.md) · [Release](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.6)
2. **新增一个昨日基线漏掉的直接竞品：NousResearch/Hermes Agent。** 采集时 GitHub 官方页面内嵌数据为 235,144 Star、47,386 Fork、5k+ Issue、5k+ PR、29 Releases；最近 20 条官方 commit feed 覆盖 7 位作者，最新提交是 2026-08-24 12:12 CST。官方 Cron 文档覆盖 Fresh Session、Skill、交付、per-task toolsets 和 no-agent precheck，它不是“累计 Star 高但停滞”的项目。[Repo](https://github.com/NousResearch/hermes-agent) · [Commits](https://github.com/NousResearch/hermes-agent/commits/main.atom) · [Cron docs](https://hermes-agent.nousresearch.com/docs/developer-guide/cron-internals/)
3. **今天最强的新故障证据是“进程/队列活着，但真实 Run 没有推进”。** n8n [#36886](https://github.com/n8n-io/n8n/issues/36886) 的作者在 SQLite/Postgres、internal/external runner、single/Queue Mode 下都复现 workflow 永久 `running` 且 `runData` 为空；这比单纯 heartbeat 更直接支持 P0 `expectedAt/overdueBy/lastProgressAt` 和 phase fault-injection。
4. **执行完成、持久化、界面可见和最终交付必须分开记账。** Hermes [#92710](https://github.com/NousResearch/hermes-agent/issues/92710) 与 Codex [#40253](https://github.com/openai/codex/issues/40253) 出现后端已完成、持久状态存在，但断线/Surface 切换后的前端仍等待；Hermes [#92859](https://github.com/NousResearch/hermes-agent/issues/92859) 与 gh-aw [#53263](https://github.com/github/gh-aw/issues/53263) 又显示最终交付可被错误路由或被一个局部失败掩盖。生命周期建议应收紧为**可从权威 Run 快照补偿的事件、稳定 recipient binding、逐目标 receipt 和 `partial_success`**。
5. **durable resume 与新连接器能力继续后置；X 今日不可用。** LangGraph、Microsoft Agent Framework、OpenAI Agents SDK 的新 Issue 再次显示 checkpoint/resume 在序列化边界容易错配或静默回退；当前项目继续采用 `needs_input → 显式 follow-up Run` 更稳。X 候选原帖直开为 0 行或 403，本次没有采用搜索摘要、正文或互动数据，也没有可纳入增量窗口的新 X 证据。

## 2. 当前仓库最新能力与证据边界

| 能力面 | 当前已实现/已观察 | 相比昨日的新变化 | 仍然缺失或未验证 |
|---|---|---|---|
| 自动化任务 | 持久 Definition/Run/Receipt；创建、编辑、暂停、恢复、删除、立即运行、取消、mark-read；每次 occurrence 建 Fresh Root Agent + Result Session | alpha.6 预发布已完成；rc.8 Web 与 macOS Desktop 核心 E2E 有观察记录 | 无 Artifact/Review 接纳状态、Attempt/预算；Windows/Linux Desktop 未实机 |
| 插件体系 | DSH Host/Web Bundle、Cordis effect 生命周期、stock Settings 全局页、Conversation 快捷入口、增强 Shell Surface、Agent Tools 与 Web 共用 `snapshot/dispatch` | 远端 main 的安装 CI 同时覆盖最低支持 rc.8 与当前 rc.2；本地分支内容与 main tree 一致 | 社区目录提交/草稿不能当已收录；无插件 risk/capability manifest 或 per-Run 插件准入 |
| 调度 | once、interval、daily、weekly、manual；IANA 时区；DST；deterministic occurrence、latest-only misfire、防重叠 | 无核心调度语义变化 | 无“计划应发生但完全没有 Run”的 expected-vs-actual health；无事件 Trigger |
| 执行/编排 | `claim → setup → executing → settling → delivery`、lease/heartbeat、whole-job deadline、保守中断恢复、目标/模型 preflight | rc.8 真实 Web/Desktop 链路补齐；rc.2 只完成安装/激活 smoke | 不是 durable DAG；无 checkpoint/resume、multi-Agent 编排；阶段强杀未实机 |
| 监控/审计 | Run history、phase、summary、effective model、结构化 error、blocked、durable command receipt、read-after-write | 82/82 与 main CI passing；窄 Settings 容器导致动作不可见的问题已修复并实机重跑 | 无 due/admitted/queued/started/finished/delivered 分段时刻、queue age、overdue/dead-man、delivery receipt |
| 通知/注意力 | 失败/中断/跳过的 durable unread；打开 Result Session 后 mark-read | 无新增 | 无 `no_change/needs_input/changes_ready`；无 OS/toast/webhook；无稳定生命周期事件与消费者补偿游标 |
| 权限/安全 | read-only/workspace-write 快照；approval=`never`；无人值守工具 allowlist；禁止递归 Automation、交互工具、subagent 和后台进程；Loopback RPC；注册 Workspace 限制 | 发布流程有 SBOM、SHA-256、GitHub/Sigstore build attestation；首次 npm 发布未观察到 npm provenance，文档已如实区分 | 无独立安全审计；无 per-role/per-Run tool/MCP/credential policy；真实系统拒绝与旁路写入矩阵未完成 |
| 生态集成 | DSH 原生安装、旧数据只读导入、双 Scheduler 冲突保护、Result Session 归档 | npm `latest=0.1.0-alpha.6`，registry 修改时间 2026-08-23 13:42 CST | 无 Trigger/Delivery Adapter；无脱敏 lifecycle API 供通知插件订阅 |

当前能力来源：[README@b0bb2db](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/README.md)、[domain](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/domain.ts)、[service](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/service.ts)、[executor](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/executor.ts)、[CI](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/.github/workflows/ci.yml)。

## 3. GitHub 热度与活跃度增量

完整跨生态规模基线见 [2026-08-23 日报](./automation-ecosystem-radar-2026-08-23.md)。本次不重复逐仓库展开，只报告新增样本与状态变化；Star 没有 GitHub 官方逐日历史，本次公共 API 又触发速率限制，因此不伪造 24 小时增长率。

| 定位 | 项目 | 热度/工程活动信号 | 2026-08-23 → 08-24 可验证增量 | 判断 |
|---|---|---|---|---|
| 直接竞品（新增基线） | [NousResearch/Hermes Agent](https://github.com/NousResearch/hermes-agent) | GitHub 官方页 235,144 Star、47,386 Fork、5k+ Issue/PR、29 Releases；最近 20 commits / 7 位作者，最新 2026-08-24 12:12 CST | 新纳入雷达；[#92710](https://github.com/NousResearch/hermes-agent/issues/92710)、[#92740](https://github.com/NousResearch/hermes-agent/issues/92740)、[#92734](https://github.com/NousResearch/hermes-agent/issues/92734)、[#92859](https://github.com/NousResearch/hermes-agent/issues/92859) 均为当日新问题 | 热度与工程活动都高；应长期跟踪 Cron/Delivery/Session/Plugin，而不是照搬其体量 |
| 产品问题样本 | [openai/codex](https://github.com/openai/codex) | 2026-08-23 基线 113,158 Star；Issue/Discussion 规模与日活跃仍很高 | [#40253](https://github.com/openai/codex/issues/40253) 暴露“任务完成、Surface 仍等待”；[#40272](https://github.com/openai/codex/discussions/40272) 反映用户希望用可信用量与自选预算决定是否启动任务；[#40229](https://github.com/openai/codex/issues/40229) 是 read-only 旁路写入的单一公开报告，尚未迁移为本项目事实 | 继续作为 Attention、预算、Surface reconciliation 与权限反例库 |
| Agentic Workflow | [github/gh-aw](https://github.com/github/gh-aw) | 2026-08-23 基线 4,978 Star；自动化 Issue、conformance 与安全输出活动密集 | [#53263](https://github.com/github/gh-aw/issues/53263) 继续记录一个 output 失败导致整批 hard-fail，即使多数动作成功；[#55014](https://github.com/github/gh-aw/issues/55014) 当日发现并关闭 error serialization conformance 误报 | 可借鉴逐输出 receipt、partial success 与自动 conformance；不是 DSH 直接竞品 |
| 通用 Workflow 基线 | [n8n](https://github.com/n8n-io/n8n) · [Dify](https://github.com/langgenius/dify) · [CrewAI](https://github.com/crewAIInc/crewAI) · [LangGraph](https://github.com/langchain-ai/langgraph) | 昨日基线分别约 201.8k / 153.2k / 57.5k / 40.3k Star，持续有 Release、commit 与 Issue 活动 | 无新 Release；但 n8n [#36886](https://github.com/n8n-io/n8n/issues/36886) 给出跨存储/runner/Queue Mode 的永久 running 强证据，LangGraph [#8693](https://github.com/langchain-ai/langgraph/issues/8693) 给出 resume shape 误判复现 | 继续跟踪；P0 health 加强，in-run resume 仍 P2/暂缓 |
| 耐久执行/调度基线 | [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) · [Temporal](https://github.com/temporalio/temporal) · [Airflow](https://github.com/apache/airflow) · [Prefect](https://github.com/PrefectHQ/prefect) | 昨日基线工程活动高；Release 口径受组件、nightly/provider/build tag 影响 | Agent Framework [#7831](https://github.com/microsoft/agent-framework/issues/7831) 暴露最新 checkpoint 不可解码时静默回退旧状态；Prefect [#22912](https://github.com/PrefectHQ/prefect/issues/22912) 报告 maintenance jobs 争用 size-1 pool。Airflow 仅新增 8/18 provider 批量 tag，不是 core 新版 | 主要作为故障模式与 durable semantics 参考，不按同一商业产品排名 |
| 可集成平台基线 | [Activepieces](https://github.com/activepieces/activepieces) · [Windmill](https://github.com/windmill-labs/windmill) · [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) · [MCP Registry](https://github.com/modelcontextprotocol/registry) | 大量 integrations/MCP 与持续发布；连接器目录、凭据与运行态是主要信号 | 今日无可验证的优先级变化；目录规模仍不能替代 connector health、最小权限和 delivery receipt | P2 再接入；优先复用官方 server/adapter，不自建大目录 |

## 4. 今日新增的反复诉求

### 4.1 真实 Run progress 比进程、队列或 worker 存活更重要

- n8n [#36886](https://github.com/n8n-io/n8n/issues/36886)：作者在 n8n 2.28.6/2.36.5 上交叉 SQLite/Postgres、internal/external runner、single/Queue Mode，均观察到 workflow 永久 `running` 且 `runData` 为空；Queue worker 已领取任务，配置超时仍未把它终止。Issue 采集时 Open、4 comments、已进入维护者 Linear，但根因尚未被维护者确认。
- Hermes [#92734](https://github.com/NousResearch/hermes-agent/issues/92734)：用户在启用 compression 后仍遇到长 Session 静默 freeze，希望到硬上限时明确 truncate/error/notify，而不是无限等待。

共同需求：健康必须覆盖 `expected → admitted → queued → started → progressing → finished` 的真实数据路径；worker/HTTP/queue heartbeat 只能回答“组件活着”，不能回答“这个 Run 正在推进”。当前项目已有 phase、lease、heartbeat 和 whole-job timeout，最小动作是派生 `expectedAt/overdueBy/lastProgressAt` 并补阶段 fault-injection，不新增 Health 实体。

### 4.2 终态必须能在断线、重启和 Surface 切换后恢复

- Hermes [#92710](https://github.com/NousResearch/hermes-agent/issues/92710)：作者给出 WebSocket 断开、重连和后端 `turn finished` 的时序，持久结果未丢，但前端缺少断线窗口事件回放，直到重启后全量恢复才显示完整答案。
- Codex [#40253](https://github.com/openai/codex/issues/40253)：任务已在主窗口完成并持久存在，快捷窗口却停在 `Waiting for worktree setup…`；这不是 worktree 本身失败，而是新 Surface 没有正确接上权威 task 状态。

共同需求：事件应有稳定 run/turn identity；消费者断线后必须从权威快照或游标补偿；“UI 仍在等待”不能覆盖后端已经完成的事实。当前项目已有 `snapshot/dispatch` 与 read-after-write，是良好基础；后续 lifecycle event 不应另建一套真相源。

### 4.3 完成、交付与用户可见需要分开记账

- Hermes [#92859](https://github.com/NousResearch/hermes-agent/issues/92859)：Issue 报告 7 个子任务完成并产生 PR，但父会话的路由归属被子会话覆盖，最终结果无法交付给原用户。
- gh-aw [#53263](https://github.com/github/gh-aw/issues/53263)：多个 safe outputs 已成功时，一个不可重试的输出仍让整个 job hard-fail；Issue 持续补充不同触发下的同形问题。

共同需求：`finished` 不等于 `delivered`；recipient 必须在 Run admission 时绑定；多目标交付需要逐项 `committed/rejected/unknown`，整体允许 `partial_success`；通知失败不得抹掉已完成的执行事实。当前项目已有 command receipt 词汇和 `delivery` phase，可复用，不必新增平行 Job 实体。

### 4.4 durable resume 不能按 value shape 或“最近可读项”猜

- LangGraph [#8693](https://github.com/langchain-ai/langgraph/issues/8693)：最小复现显示普通 dictionary resume 可能被 shape heuristic 当成 interrupt map；payload 形状不能替代明确 request identity。
- Microsoft Agent Framework [#7831](https://github.com/microsoft/agent-framework/issues/7831)：Issue 描述 `save` 接受随后无法 decode 的状态，而 `get_latest` 捕获异常后选择旧 checkpoint，形成“写入成功、恢复却退回旧状态”的不对称。
- OpenAI Agents SDK [#4611](https://github.com/openai/openai-agents-python/issues/4611)：作者报告序列化 approval interruption 与 output guardrail 组合无法恢复；Issue 已关闭，但本次没有确认 closing PR、Release 或用户复测，不能写成已修复。

共同需求：未来 resume 必须带 `request_id`、state revision、schema version、最新 revision read-after-write 和 fail-closed；当前无人值守 Run 先终结为 `needs_input`，用户确认后创建显式 follow-up Run，避免现在扩大状态机。

### 4.5 高频无人值守运行需要留存、预算和硬护栏

- Hermes [#92740](https://github.com/NousResearch/hermes-agent/issues/92740)：24-profile、Cron/Kanban/Subagent fleet 的作者报告 20 个 Session store、10,210 sessions、5,931 个 `ended_at IS NULL`；数量未独立审计，但现有 prune/archive 看不到 stale-open entries 的机制与需求可核对。
- Codex [#40272](https://github.com/openai/codex/discussions/40272)：低互动但方向具体——用户需要把可信容量、新鲜度与自选任务预算分开，决定现在启动、缩小范围、换模型还是等待重置。

共同需求：保留策略要按 owner/active/pinned/ambiguous 区分；预算应记录来源与新鲜度，不能把估算冒充账单；硬限制触发应形成结构化终态。

### 4.6 MCP“能列出”不等于 endpoint、identity、协议与能力可用

同一增量窗口内，Dify [#41109](https://github.com/langgenius/dify/issues/41109)、Microsoft Agent Framework [#7824](https://github.com/microsoft/agent-framework/issues/7824) / [#7825](https://github.com/microsoft/agent-framework/issues/7825)、n8n [#36889](https://github.com/n8n-io/n8n/issues/36889) 分别报告 provider list ID 与管理 API UUID 不一致、未协商 MCP Tasks Extension、声明并行但实际串行、Cloud instance-level MCP URL 404。它们不是一个根因，却共同说明注册/列表成功不能当 E2E。

当前项目未来接 MCP/Delivery Adapter 时，应把 preflight 拆成 endpoint、identity、auth、protocol/capability、tool schema/effective tools，并把失败写成 `blocked`；MCP Tasks Extension 本身没有当前明确场景，仍为 P2。

## 5. 汇总映射与优先级

| 类别 | 项目或诉求 | 热度/需求信号 | 来源链接 | 当前能力与差距 | 建议改进或进化方向 | 影响 | 优先级 | 成本 | 可信度 |
|---|---|---|---|---|---|---|---|---|---|
| 发布/兼容 | alpha.6 交付与 rc.2 | npm/GitHub 预发布已完成；main CI 扩到 rc.8 + rc.2；rc.8 Web/Desktop 有 E2E | [Release](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.6) · [acceptance](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/docs/acceptance-results-2026-08-23-alpha.6.md) · [CI](https://github.com/usersx/dsh-automation-center/actions/workflows/ci.yml) | 昨日 P0 已部分关闭；rc.2 Desktop/真实 Run、Windows/Linux、阶段强杀仍缺 | 沿用现有验收矩阵补 observed evidence；加入 read-only 旁路写入和卸载中断，不新增能力实体 | 极高 | P0 | M | 高 |
| 监控/健康 | 应运行却没有 Run，或永久 running 不推进 | n8n 跨 DB/runner/Queue Mode 复现；Hermes 与昨日 Prefect/Temporal/OpenClaw 样本同向 | [n8n #36886](https://github.com/n8n-io/n8n/issues/36886) · [Hermes #92734](https://github.com/NousResearch/hermes-agent/issues/92734) · [昨日证据索引](./automation-ecosystem-radar-2026-08-23.md) | 已有 recurrence、nextRun、phase、lease/heartbeat；完全没 admission 时无事实行，也无 `lastProgressAt` | 从 Definition schedule + 最新 Run 派生 `expectedAt/overdueBy/lastProgressAt`；snapshot/UI 先做 dead-man，并补 phase 强杀，不建 Health 表 | 极高 | P0 | M | 高 |
| 注意力 | no-op、需输入、改动待审、失败/阻塞 | Hermes 支持 script precheck，Codex/Titan 基线反复要求 quiet unless actionable | [Hermes cron docs](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/cron.md) · [Codex #28922](https://github.com/openai/codex/issues/28922) | 只有 status + unread；完成项仍无法稳定区分结果价值 | 在现有 Run 增加结构化 `outcome/attention=none|no_change|needs_input|changes_ready|failed|blocked`；来源必须是结束契约，不读自然语言猜 | 高 | P0 | M | 高 |
| 生命周期/Surface | 后端完成但 UI/消费者仍等待 | Hermes 与 Codex 在同一天出现跨 Surface/重连终态丢失 | [Hermes #92710](https://github.com/NousResearch/hermes-agent/issues/92710) · [Codex #40253](https://github.com/openai/codex/issues/40253) | 当前 Web 依赖权威 snapshot，命令有 read-after-write；尚无对外 event/cursor | 复用 snapshot 作为真相；发布带 `runId/revision/sequence` 的脱敏事件；消费者重连以 cursor 或 snapshot catch-up | 高 | P1 | M | 高 |
| 交付/通知 | 完成≠交付；多目标部分成功 | Hermes 完成后路由丢失；gh-aw 多输出 partial success 被整体 hard-fail | [Hermes #92859](https://github.com/NousResearch/hermes-agent/issues/92859) · [gh-aw #53263](https://github.com/github/gh-aw/issues/53263) | `delivery` phase 只保存/归档 Result Session；无 recipient/attempt/receipt | admission 时快照 recipient；复用现有 Receipt 词汇记录逐目标 delivery outcome；先接本地通知插件，失败不改写 Run 执行结果 | 高 | P1 | M | 高 |
| durable resume/HITL | request 映射、checkpoint 可读性和序列化边界 | LangGraph/Agent Framework/OpenAI SDK 同日出现三个不同但同向的问题 | [LangGraph #8693](https://github.com/langchain-ai/langgraph/issues/8693) · [Agent Framework #7831](https://github.com/microsoft/agent-framework/issues/7831) · [Agents SDK #4611](https://github.com/openai/openai-agents-python/issues/4611) | 当前明确不在 Run 中等待人工，避免了这类状态机；无 resume protocol | 继续 `needs_input → follow-up Run`；未来必须有 request ID/revision/schema、最新状态 read-after-write、解码失败 fail closed | 中 | P2/暂缓 | L | 高：对风险；SDK Issue 关闭不等于已修复 |
| 权限/安全 | read-only 与工具边界 | Codex 出现 read-only 旁路写入的单一高风险报告；Hermes 有 per-job toolsets | [Codex #40229](https://github.com/openai/codex/issues/40229) · [Hermes scheduler](https://github.com/NousResearch/hermes-agent/blob/main/cron/scheduler.py) | 固定 unattended allowlist + DSH permission preset；无独立安全审计、effective tools snapshot | 先补 DSH 环境中 managed edit/shell/MCP/子进程的负向矩阵；再从 manifest/profile 解析更窄 allowlist 并持久化 effective snapshot；配置错误 fail closed | 极高 | P1 | M | 中高：外部 Issue 不是本项目漏洞证明 |
| 留存 | stale/open Result Sessions、归档与清理 | Hermes 24-profile fleet 与 Codex/Titan 基线重复 | [Hermes #92740](https://github.com/NousResearch/hermes-agent/issues/92740) · [Codex #29179](https://github.com/openai/codex/issues/29179) | 全局 `archiveRunSessions` + `historyLimit`，无 per-task policy/dry-run/pin | 在 Definition 现有配置中加 per-task visibility/retention；先 preview receipt；active/pinned/ambiguous fail closed | 中高 | P1 | M | 高 |
| 成本/预算 | 启动前容量判断与硬上限 | Codex 新 Discussion 互动低但场景明确；Hermes 有模型 fail-closed 与 context hard-cap 诉求 | [Codex #40272](https://github.com/openai/codex/discussions/40272) · [Hermes #92734](https://github.com/NousResearch/hermes-agent/issues/92734) | 已有 model policy、effective model、whole-job timeout；无 token/cost/context budget | 先记录上游可得 usage、来源/新鲜度与 `budget_exhausted/quota_blocked`；不以估算冒充账单，不先做自动换付费模型 | 中高 | P1 | M | 中 |
| 代码交付 | per-Run worktree + review artifact | 昨日 Cetus/agentd/Codex/Vibe 样本；今日 Codex Surface bug提醒不要把 UI 文案当真实 worktree 状态 | [昨日 Landscape](./github-automation-landscape-2026-08.md) · [Codex #40253](https://github.com/openai/codex/issues/40253) | workspace-write 直接改目标目录；无 base SHA/diff/tests/disposition | 只对 Git Workspace opt-in worktree；Run 内保存 base SHA、artifact manifest、accept/keep/discard；清理验证 owner/common-dir，首版不 push/PR | 高 | P1 | L | 高 |
| 插件/模型策略 | per-job skill/tool/model | Hermes 已提供 per-job skill、model、toolsets；当前项目只有 preset/model/固定 allowlist | [Hermes cron docs](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/cron.md) | 可固定/继承模型，但不能缩窄 MCP/tool/credential；inherit 可能随全局默认漂移 | 保留明确 `inherit|pinned`，为 inherit 增加 effective model/budget 告警；工具只允许比全局 allowlist 更窄，不开放任意脚本 | 中高 | P1 | M | 高 |
| MCP/连接器预检 | 注册/列表成功但 endpoint、ID、spec 或并发能力不可用 | Dify、Agent Framework、n8n 同日四个相邻契约问题 | [Dify #41109](https://github.com/langgenius/dify/issues/41109) · [MAF #7824](https://github.com/microsoft/agent-framework/issues/7824) · [#7825](https://github.com/microsoft/agent-framework/issues/7825) · [n8n #36889](https://github.com/n8n-io/n8n/issues/36889) | 当前没有 MCP Trigger/Delivery adapter；固定 tool allowlist 也无 effective capability snapshot | future adapter preflight 分开验证 endpoint/identity/auth/protocol/capability/tool schema，并保存快照；失败 `blocked`；Tasks Extension P2 | 高 | P1 | M | 中高 |
| Trigger/连接器 | GitHub/file/webhook/MCP/远程消息 | n8n/Dify/Activepieces/Hermes 证明场景与目录规模 | [Hermes repo](https://github.com/NousResearch/hermes-agent) · [n8n](https://github.com/n8n-io/n8n) · [MCP Registry](https://github.com/modelcontextprotocol/registry) | 只有时间/manual Trigger，Session 是唯一 Delivery | 等 health/event/receipt 稳定后做 `TriggerAdapter → existing admission`；优先官方 MCP/server，不自建连接器市场 | 中 | P2 | L | 高 |
| no-agent script | 低成本 precheck / 零 LLM 定时脚本 | Hermes [#5203](https://github.com/NousResearch/hermes-agent/issues/5203) 后已进入官方 Cron 能力 | [Issue](https://github.com/NousResearch/hermes-agent/issues/5203) · [docs](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/cron.md) | 每个 Run 都建 Agent；可通过 Prompt 得到 no_change，但仍有成本 | 暂不加入任意脚本执行器；先完成 Attention/预算。如果未来做，只允许版本化、受权限控制的 preflight hook，不接受自由 Shell 字符串 | 中 | P2/暂缓 | M | 高 |
| DAG/分布式 | 多 Agent、scale-to-zero、远程 Runner | Hermes/Agent Framework/LangGraph 热度高，Hermes 也公开 managed Cron contract | [Hermes Chronos contract](https://github.com/NousResearch/hermes-agent/blob/main/docs/chronos-managed-cron-contract.md) · [Agent Framework](https://github.com/microsoft/agent-framework) | 当前单根 Agent、本地 Host；DSH workflow foreground-only | 暂不投入通用 DAG/分布式 Scheduler；有明确规模前先完成 health、budget、resume 和 delivery contract | 当前低、未来高 | P2/暂缓 | XL | 高 |
| X 增量 | 公开讨论 | 候选原帖直开为 0 行或 403；没有本窗口新增可核验内容 | [候选 1](https://x.com/zackbshapiro/status/2026733034871935349) · [候选 2](https://x.com/BentoBoiNFT/status/2028961745721589944) | 无可用新增证据；搜索摘要不能计频 | 不增加功能；只在原帖全文、时间、作者上下文可验证时纳入 | 无新增 | — | — | 高：对访问限制；不代表 X 全量无讨论 |

## 6. 今日最值得推进的 Top 5

1. **P0：完成稳定版剩余 observed acceptance。** 在已经 passing 的 rc.8/rc.2 安装矩阵上，补 rc.2 Desktop + 真实模型完整 Run、Windows/Linux Desktop、运行中卸载、五个 Supervisor phase 强杀、真实 permission denial/timeout；把 read-only 的 managed-edit/MCP/子进程旁路加入负向矩阵。
2. **P0：增加 expected-vs-actual occurrence health。** 从现有 schedule、Definition 和 Runs 派生 `expectedAt / overdueBy / lastProgressAt`，区分 Host 没醒、admission 没发生、排队和 executing 卡住；首版只改 snapshot/UI，不建新表。
3. **P0：把 unread 升级为结构化 Attention/Outcome。** `no_change / needs_input / changes_ready / failed / blocked` 由结束契约产生；成功 no-op 默认静默，真正待处理项进入 Center Inbox。
4. **P1：做一条可补偿的 lifecycle + delivery 纵切。** 复用现有 Run/Receipt 和 Cordis event：事件带 run identity/revision/sequence，消费者可用 snapshot catch-up；本地通知保存 recipient 与逐目标 receipt，允许 `partial_success`，通知失败不污染执行结果。
5. **P1：定义 MCP/connector 分层 preflight。** 在未来 adapter 进入 admission 前，分别验证 endpoint、identity、auth、protocol/capability、tool schema/effective tools，并保存快照；列表成功不能当 E2E，失败进入 `blocked`。MCP Tasks Extension 与大连接器目录继续 P2。

## 7. 证据不足、访问限制与人工确认

1. **Star 24 小时增长不可验证。** GitHub 不提供公开官方日序列，本次公共 REST API 触发匿名速率限制；除已有同口径基线外，不报告增长率。Hermes 的 235,144/47,386 是采集时官方 HTML 内嵌累计值，没有昨日同口径快照，不能写成单日增长。
2. **Release 数仍不可直接横比。** Prefect nightly、Airflow provider、Temporal build tag、Trigger.dev package 组都会放大发布频率；本次不按 Release 数打分。
3. **Issue 是公开故障报告，不等于已验证根因。** Hermes #92859、Codex #40229/#40253 等采用其可观察现象和作者提供的时序；没有把作者的所有根因推断移植为本项目事实。
4. **X 原帖受访问限制。** 候选直开为 0 行或 403；搜索索引摘要与互动量没有采用。这只能说明“本次没有可纳入的公开证据”，不能证明 X 上无人讨论。
5. **仓库本地 ref 与远端 main 名称不同。** 本地 `chore/dsh-rc2-compat@0920888` 与远端 `main@b0bb2db` 的 tree hash 一致，故源码内容是当前 main；本地 `origin/main` 仍停在更早提交，报告没有把 stale ref 当最新。
6. **alpha.6 的发布与稳定性边界。** npm `latest` 和 GitHub Release 已确认；首次 npm 发布没有观察到 npm registry provenance，只有 GitHub/Sigstore build attestation。稳定版仍需完成验收记录中的未执行项和独立安全审计。
7. **需要产品负责人确认三项语义。** 一是 `no_change/needs_input/changes_ready` 的生产者与默认通知策略；二是 lifecycle event 是否要求 durable replay，还是允许通过 snapshot catch-up；三是 worktree accept/discard 的 destructive UX、保留期限与 merge 权限。

## 8. 今日新增证据索引

- 当前项目：[main `b0bb2db`](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c)、[alpha.6 Release](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.6)、[验收结果](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/docs/acceptance-results-2026-08-23-alpha.6.md)、[CI](https://github.com/usersx/dsh-automation-center/actions/workflows/ci.yml)。
- Hermes Agent：[Repo](https://github.com/NousResearch/hermes-agent)、[Cron docs](https://github.com/NousResearch/hermes-agent/blob/main/website/docs/user-guide/features/cron.md)、[#92710](https://github.com/NousResearch/hermes-agent/issues/92710)、[#92740](https://github.com/NousResearch/hermes-agent/issues/92740)、[#92734](https://github.com/NousResearch/hermes-agent/issues/92734)、[#92859](https://github.com/NousResearch/hermes-agent/issues/92859)。
- 运行健康：[n8n #36886](https://github.com/n8n-io/n8n/issues/36886)、[Prefect #22912](https://github.com/PrefectHQ/prefect/issues/22912)。
- durable resume：[LangGraph #8693](https://github.com/langchain-ai/langgraph/issues/8693)、[Agent Framework #7831](https://github.com/microsoft/agent-framework/issues/7831)、[OpenAI Agents SDK #4611](https://github.com/openai/openai-agents-python/issues/4611)。
- MCP identity/capability：[Dify #41109](https://github.com/langgenius/dify/issues/41109)、[Agent Framework #7824](https://github.com/microsoft/agent-framework/issues/7824)、[#7825](https://github.com/microsoft/agent-framework/issues/7825)、[n8n #36889](https://github.com/n8n-io/n8n/issues/36889)。
- Codex：[worktree/Surface #40253](https://github.com/openai/codex/issues/40253)、[预算规划 Discussion #40272](https://github.com/openai/codex/discussions/40272)、[read-only 报告 #40229](https://github.com/openai/codex/issues/40229)。
- gh-aw：[partial success #53263](https://github.com/github/gh-aw/issues/53263)、[safe-output conformance #55014](https://github.com/github/gh-aw/issues/55014)。

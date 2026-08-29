# 自动化生态与用户需求雷达日报（2026-08-26）

> 数据采集时间：2026-08-26 09:58—10:37（Asia/Shanghai，UTC+08:00）。
> 精确外部增量窗口：2026-08-25T02:15:20.690Z（上次运行）至 2026-08-26T02:27:00Z。
> 范围：当前仓库、AI Agent 自动化、调度/编排、插件、监控、通知、权限与生态集成。只做调研与建议；本次未修改业务代码、未运行测试、未提交 Issue、未发布内容、未对外联系。
> 证据标记：**Observed** = 本次从本地源码/Git 或 GitHub 官方 API、Release、Issue、Discussion、仓库页面直接读取；**Tested** = 有可定位的既有测试或实机验收记录；**Maintainer-reproduced** = 上游标签明确标为 reproduced；**Reported** = 用户给出复现/数据但尚无维护者确认；**Inference** = 基于证据的映射建议，不是已实现事实。

## 1. 执行摘要

1. **当前项目自昨日没有新代码、文档或 Release，能力基线不变。** 今日只读核验远端 `main` 仍为 [`b0bb2db`](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c)、兼容分支与本地 HEAD 均为 `0920888`、`v0.1.0-alpha.6` tag 仍为 `ffc0be5`；本地 tracked diff 为空。82/82、rc.8 Web 与 macOS Desktop E2E 是既有验收记录，本次测试 **NOT RUN**；稳定版仍 NO-GO。
2. **本地源码出现一条高概率 P0 删除回归路径。** `AutomationService.open()` 每次启动都会重新扫描只读 legacy v1 域；删除只移除新域 Definition，而现有 `definitions/runs/receipts` 中没有迁移完成标记，导入逻辑又会补回缺失 ID。因此“删除旧版导入任务 → 重启 → 任务重新出现/恢复调度”在代码路径上成立，但本次未做重启复现。Hermes [#94823](https://github.com/NousResearch/hermes-agent/issues/94823) 同窗报告删除 Bot profile 后被旧 roster/cron 骨架静默重建。最小动作是先补 delete→reopen 回归，并优先复用现有 committed delete Receipt 作 tombstone。
3. **调度入口与执行入口不等价，已成为今日最强外部 P0 增量。** n8n [#37065](https://github.com/n8n-io/n8n/issues/37065) 在同一 Runner 上观察到 41 次 Schedule→JavaScript 执行 0 成功，而相同 Code 节点的 webhook/manual 控制组均在 0.5 秒内完成；Windmill [#10844](https://github.com/windmill-labs/windmill/issues/10844) 又显示有效 cadence 静默变慢、UI 仍显示原 cron。当前项目应复用 Definition、occurrence、Run、phase 派生 `expectedAt/overdueBy/lastProgressAt`，并补 manual/scheduled parity，不新增 Health 实体。
4. **“执行过”与“持久化、可见、交付成功”再次被独立项目同时击穿。** Hermes [#94736](https://github.com/NousResearch/hermes-agent/issues/94736) 报告 11/11 个 cron/subagent Session 因持久化写失败中止、Slack 摘要却仍为 `last_status: ok`；n8n [#37040](https://github.com/n8n-io/n8n/issues/37040) 报告 UI 已完成但数据库长期 `running`；Codex [#40552](https://github.com/openai/codex/issues/40552) 则是 `final_answer` 已持久化但缺 `task_complete`。P0/P1 应把 `executed → persisted → visible → delivered` 做成可对账事实，持久化失败不得归为成功。
5. **Dify 1.17.0 是今日最大的已发布竞品变化，但不改变“先可靠、后扩生态”的排序。** 官方 [v1.17.0 Release](https://github.com/langgenius/dify/releases/tag/1.17.0) 声明加入 versioned Skills、E2B sandbox、Home Snapshot、Loop 内 HITL、统一 tracing；可借鉴的是 P1 effective capability snapshot 与生命周期一致性。Skill 市场、云 sandbox、in-run HITL、通用 DAG 和大规模 tracing 仍缺本项目需求闭环，维持 P2。

## 2. 当前仓库能力与证据边界

| 能力面 | 已实现（Observed） | 已验证（Tested） | 缺口或本次 NOT RUN |
|---|---|---|---|
| 自动化任务 | 持久 Definition/Run/Command Receipt；创建、编辑、暂停、恢复、删除、立即运行、取消、mark-read；Fresh Root Agent + Result Session | 既有验收记录为 82/82、rc.8 Web 与 macOS Desktop 核心 E2E | 本次未跑测试；无结构化 Outcome/Artifact/Review；Windows/Linux Desktop 未实机 |
| 插件体系 | DSH Host/Web Bundle、Cordis effect 生命周期、stock Settings、Agent Tools/Web 共用 `snapshot/dispatch`；CI 配置覆盖 rc.8/rc.2 安装 | 既有 main CI、安装和激活记录 | 无 per-Run Skill/MCP/version/effective capability snapshot；无插件 risk/effect manifest |
| 调度 | once/interval/daily/weekly/manual、IANA 时区、DST、deterministic occurrence、latest-only misfire、防重叠 | 既有自动化与实机验收记录 | 无 expected-vs-actual/dead-man；无 scheduled/manual parity canary；无事件 Trigger |
| 执行/编排 | `claim → setup → executing → settling → delivery`、运行级 lease/heartbeat、whole-job deadline、保守恢复、target/model preflight | 协作式超时/恢复路径有测试记录 | 非协作同步阻塞、五阶段强杀、进程外 watchdog NOT RUN；无 durable DAG/checkpoint/resume |
| 监控/通知 | Run history、phase、summary、结构化 error、unread、durable command receipt、read-after-write | 页面与测试记录见既有验收 | 无 `expectedAt/overdueBy/lastProgressAt`、Attention/Outcome、lifecycle event、逐目标 delivery receipt |
| 权限/生态 | read-only/workspace-write、approval=`never`、固定 unattended allowlist、禁止递归 Automation/交互工具/后台进程；Loopback RPC | 源码/测试记录，不是独立安全审计 | 无 effective actor/effect/capability snapshot；MCP discovery/connect/call/reconnect 负向矩阵缺失 |

**今日仓库状态：** local `chore/dsh-rc2-compat@0920888`、tree=`832a603`；远端 `main@b0bb2db`、兼容分支 `0920888`、alpha.6 tag `ffc0be5`。远端 ref、本地 tree、版本和验收文档均未变化；本次未 fetch、未运行测试。

### 2.1 新发现：legacy 导入删除可能在重启后失效

**Observed：** [`AutomationService.open()`](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/service.ts#L159-L176) 每次打开服务都调用 `importLegacyData()`；[导入循环](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/service.ts#L736-L790) 在新域找不到同 ID Definition/Run 时重新写入，而旧域按设计不修改。删除命令只删除当前 Definition 并保留历史；[当前 Domain](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/domain.ts#L153-L174) 只有 `definitions/runs/receipts`，没有独立 migration marker 或 tombstone。

**Inference / NOT RUN：** 若某任务来自 legacy v1，用户在新中心删除后重启 Host，缺失 Definition 会再次满足导入条件，任务可能重现并重新进入调度。本次没有构造双次 `open()` 的动态复现，因此不能写成已发生生产故障；现有测试名虽写 “import once”，只覆盖一次 service open，没有覆盖 delete→dispose→reopen。

**最小建议：** 先增加 `import legacy → committed delete → reopen → remains deleted` 回归；优先扫描现有 durable Receipt，遇到同 `entityId` 的 committed delete 时跳过 legacy re-import。只有 Receipt 生命周期无法承担 tombstone 时，才增加最小 migration marker；不要新建完整迁移实体或同步流。影响高、成本 S、优先级 P0。

## 3. 热度与工程活动增量

累计 Star/Fork 来自 GitHub 官方仓库 API，最终快照采集于 2026-08-26 10:26 CST。窗口 Issue 数来自 GitHub Search 的 `is:issue created:>=2026-08-25T02:15:20Z`，包含 duplicate、support、bot/sweeper 产物，不能直接当作独立用户数。提交统计来自官方 commits API；作者数包含 bot。Release 只列窗口内 GitHub Release，组件/nightly/hotfix 流不可横比。

| 定位 | 项目 | 当前累计热度 | 窗口工程活动 | 窗口 Release / 需求信号 | 判断 |
|---|---|---:|---|---|---|
| 直接竞品 | [Hermes Agent](https://github.com/NousResearch/hermes-agent) | 236,451 Star / 47,747 Fork；相对昨日记录的 235,868 / 47,593，`+583/+154`；基线没有精确秒级采样时间，不能拟合日速 | 131 commits / 39 个 API 作者身份；216 个新 Issue，但自动 sweeper/duplicate 很多 | 无新 Release；[#94736](https://github.com/NousResearch/hermes-agent/issues/94736) 的 cron 持久化失败却交付 `ok`、[#94540](https://github.com/NousResearch/hermes-agent/issues/94540) 的更新后 gateway 未重启、[#94637](https://github.com/NousResearch/hermes-agent/issues/94637) 的 MCP discovery/call 分裂 | 唯一沿用昨日明确双快照的增长样本；热度与工程活动仍极高，但 Issue 量严重受自动化放大 |
| 可集成/相邻平台 | [n8n](https://github.com/n8n-io/n8n) | 202,426 Star / 60,385 Fork | 44 commits / 27 个显示作者；11 个新 Issue | stable [2.36.7](https://github.com/n8n-io/n8n/releases/tag/n8n%402.36.7)，另有 2.37.0/2.37.1 prerelease；[#37065](https://github.com/n8n-io/n8n/issues/37065) 已进 Linear/团队分派，2.36.7 未包含该后发问题 | 稳定发布与关键 scheduled-runner 故障同窗出现；不能用 Release 存在推断问题已修复 |
| 可集成/相邻平台 | [Dify](https://github.com/langgenius/dify) | 153,513 Star / 24,259 Fork | 35 commits / 15 个显示作者；8 个新 Issue | stable [1.17.0](https://github.com/langgenius/dify/releases/tag/1.17.0)；新增 Skills/Sandbox/Snapshot/HITL/Tracing；[#41223](https://github.com/langgenius/dify/issues/41223) 同窗关闭 completed，[#41264](https://github.com/langgenius/dify/issues/41264) 仍 Open | 最大竞品能力增量；Release 是供应方声明，未做部署或用户接受验证 |
| 直接相邻竞品/UX 样本 | [OpenAI Codex](https://github.com/openai/codex) | 118,185 Star / 18,009 Fork | 82 commits / 38 个显示作者；149 个新 Issue | 0.150.0 alpha.9/.10/.11 三个 prerelease；Windows stable MCP 注入回归 [#40715](https://github.com/openai/codex/issues/40715) 有 24 comments；昨日远程终态 [#40515](https://github.com/openai/codex/issues/40515) 新增第二位用户复现 | 发布频率和用户反馈都高；主要用于 Host/插件兼容、Surface/终态、审批 provenance 反例 |
| 可借鉴/Agent Workflow | [Microsoft Agent Framework](https://github.com/microsoft/agent-framework) | 13,111 Star / 2,226 Fork | 8 commits / 6 个显示作者；8 个新 Issue | 无新 Release；[#7859](https://github.com/microsoft/agent-framework/issues/7859) `reproduced`，[#7862](https://github.com/microsoft/agent-framework/issues/7862) 暴露 durable approval public API 缺口 | 状态机风险证据强；in-run approval 仍不应提前进入当前项目主线 |
| 可借鉴/Agent Workflow | [LangGraph](https://github.com/langchain-ai/langgraph) | 40,451 Star / 6,825 Fork | commits API 在精确窗口返回 0；5 个新 Issue | 无新 Release；[#8715](https://github.com/langchain-ai/langgraph/issues/8715) / [#8716](https://github.com/langchain-ai/langgraph/issues/8716) 均有最小复现但未获维护者确认 | 强化 error propagation/conformance；不改变 durable resume P2 |
| 可借鉴/Agent Framework | [CrewAI](https://github.com/crewAIInc/crewAI) | 57,612 Star / 8,247 Fork | 7 commits / 4 个显示作者；0 个新 Issue | 无新 Release | 工程仍活跃，但窗口内没有改变优先级的新用户证据 |
| 可借鉴/Agentic CI | [github/gh-aw](https://github.com/github/gh-aw) | 5,000 Star / 505 Fork | 84 commits / 5 个显示作者；187 个新 Issue，多为 workflow 自动生成 | prerelease [v0.87.5](https://github.com/github/gh-aw/releases/tag/v0.87.5)；[#55783](https://github.com/github/gh-aw/issues/55783) 明确输出 `report_incomplete`，原因是诊断误耗尽唯一副作用额度 | 活动量很高但高度机器化；可借鉴结构化 incompletion、预算收据，不能拿 Issue 数代表用户需求 |
| 可借鉴/调度 | [Prefect](https://github.com/PrefectHQ/prefect) / [Airflow](https://github.com/apache/airflow) | 23,686 / 46,608 Star | Prefect 2 commits、1 新 Issue；Airflow 3 新 Issue（未统计窗口 commit） | Prefect [3.8.4](https://github.com/PrefectHQ/prefect/releases/tag/3.8.4) 修复 runner 覆盖已处理 outcome、worker health 与 lateness 展示；Airflow [#72061](https://github.com/apache/airflow/issues/72061) 为 high-priority core bug | 继续作为 outcome/health/清理原子性参考，不按 Release 数排名 |
| 可集成/插件生态 | [Activepieces](https://github.com/activepieces/activepieces) / [Windmill](https://github.com/windmill-labs/windmill) / [MCP Registry](https://github.com/modelcontextprotocol/registry) | 24,036 / 17,678 / 7,191 Star | Activepieces 11 commits/6 作者、8 Issue；Windmill 7 Issue且窗口有 push；Registry 0 Issue、无窗口 push | Activepieces 同窗 5 个多版本/RC/hotfix tag，最新 hotfix notes 写明 “No changes”；Windmill 无 Release；[#15057](https://github.com/activepieces/activepieces/issues/15057)、[#10844](https://github.com/windmill-labs/windmill/issues/10844) 是 Trigger/调度强样本 | 目录/发版数量不能替代 Trigger E2E、幂等、健康与权限；当前仍不建议自建大连接器市场 |

## 4. 今日新增需求与当前基线映射

### 4.1 P0：调度健康必须比较“计划发生”和“实际进入执行”

**Observed/Reported：**

- n8n [#37065](https://github.com/n8n-io/n8n/issues/37065) 的干净 Compose 复现只改变 Trigger 类型：41 个 scheduled JavaScript 执行 0 成功，38 个在 2.34.4 于 300 秒超时，其余在 2.35.7 保持 `running` 后被 prune；相同节点的 webhook/manual 控制组成功。Runner 已注册，失败路径没有创建 task，也没有 dispatch 日志。Issue 已进入 Linear 并分派团队，但采集时仍 Open，无修复 Release。
- Windmill [#10844](https://github.com/windmill-labs/windmill/issues/10844) 报告 interval=20 秒、执行=50 秒时，实际启动间隔变为 60 秒，配置页仍显示原表达式且无告警。作者明确要求至少展示 configured/effective cadence 的偏差。
- Activepieces [#15057](https://github.com/activepieces/activepieces/issues/15057) 在 0.1.21、0.1.22 和 main 报告 Attio Trigger 丢弃 `attribute_id`，一个 stage change 因公式重算产生二次 event，两个都通过 filter，导致重复 Flow 和重复邮件；同一 payload 中只读取 `events[0]` 又会漏事件。

**与昨日项目基线的差距（Inference）：** 当前已有 deterministic occurrence、latest-only misfire、Run/phase/lease/heartbeat，但没有 `expectedAt/overdueBy/lastProgressAt`；只有 time/manual trigger，尚无外部 Trigger Adapter。已有 occurrence 与 Run 足够表达第一版健康，无需 Health 表。

**建议动作：**

1. 从 Definition schedule + occurrence + 最新 Run 派生 `expectedAt/overdueBy/lastProgressAt`，区分 `not_admitted/admitted/not_dispatched/running/no_progress/terminal`。
2. 增加同一任务 manual 与 scheduled admission/dispatch parity 验收；至少验证 schedule 到 claim、runner dispatch、phase progress、terminal receipt。
3. future Trigger Adapter 必须保留 provider event identity、批次内每个 event、idempotency key、last accepted event 与过滤依据；先复用现有 admission/Run，不新建每个 provider 的状态流。

**优先级/成本/风险：** P0 / M。风险是 misfire、长任务和 overlap 策略需要产品语义确认；不要把“实际间隔变长”一律判成错误，应展示 configured/effective 与原因。

### 4.2 P0/P1：持久化或交付失败不得被折叠成成功

**Observed/Reported：**

- Hermes [#94736](https://github.com/NousResearch/hermes-agent/issues/94736) 给出 2026-08-23—25 的 11 个连续 subagent Session，11/11 都以 `session_persistence_failed` 中止，并在日志中找到 96 次相同 warning；一个具体 Run 留下未提交草稿与未 push 分支，但交付给 Slack 的摘要仍是 `last_status: ok`。Issue 为 P1、Open；数字来自单一报告，维护者尚未确认根因。
- n8n [#37040](https://github.com/n8n-io/n8n/issues/37040) 在关闭“保存成功执行数据”后，UI 正常完成但 `execution_entity.finished=false/status=running/stoppedAt` 为空，说明 payload retention 与最小终态收据被耦合。
- LangGraph [#8715](https://github.com/langchain-ai/langgraph/issues/8715) 的 `on_error="raise"` 是否生效取决于 task 完成时序；错误可只留在 stderr，而调用者得到成功。[#8716](https://github.com/langchain-ai/langgraph/issues/8716) 的 `tee()` 只让一个 consumer 看到 source error，其他分支干净结束。
- gh-aw [#55783](https://github.com/github/gh-aw/issues/55783) 的分析已经完成，但诊断调用误耗尽唯一 `update_pull_request` 额度，最终 body 只留在临时文件；系统正确发布了结构化 `report_incomplete`，没有伪装成真实 outcome。
- 昨日 Codex 远程终态 [#40515](https://github.com/openai/codex/issues/40515) 在本窗口新增第二位用户简短确认；Issue 仍 Open，尚无修复证据。

**与昨日项目基线的差距（Inference）：** 当前 durable command receipt/read-after-write 已有，但 Run 仍主要依赖 status + unread；没有结构化 `outcome/attention`、对外 lifecycle、逐目标 delivery receipt。这里不要求新执行状态机，要求把已有阶段结果拆成可核对事实。

**建议动作：**

- P0：持久化 Run terminal snapshot 失败时 fail closed，最终 summary/notification 不得发 `ok`；加入 “Agent 做完但持久化失败”“不保存大 payload 仍保存最小终态” 测试。
- P1：复用 Receipt 词汇记录 `executed/persisted/visible/delivered` 以及 `committed/rejected/unknown`；`report_incomplete`、`partial`、`blocked` 不覆盖执行结果。
- P1：event、snapshot、Result Session、UI/index 以 `runId/revision/sequence` 做 conformance；多 consumer 必须得到相同 error/terminal。

**优先级/成本/风险：** P0（终态真实性）+ P1（外部 lifecycle/delivery）/ M。前置是确认哪些写入属于 Run 成功的硬条件，哪些 delivery 失败只影响交付 outcome。

### 4.3 P1：声明配置不等于实际生效，权限与插件要做 effective preflight

**Observed/Reported：**

- Dify [#41223](https://github.com/langgenius/dify/issues/41223) 显示 `import studio-app` 可创建/覆盖远端 App，`use account/host` 会改本地 context，但 CLI JSON help 都因缺少声明而回落为 `effect=read`；Agent Skill 据此不会要求确认。Issue 在窗口内关闭 completed，但本次未验证修复进入哪个 Release。
- Windmill [#10840](https://github.com/windmill-labs/windmill/issues/10840) 以设置/不设置的控制组验证 5 个字段可持久化并读回，却不触发 error handler、并发限制、cache 或删除；同环境中的 timeout/retry 等字段正常，说明不能按“保存成功”推断能力有效。
- Hermes [#94637](https://github.com/NousResearch/hermes-agent/issues/94637) 报告 stdio MCP connect/discovery 与 `hermes mcp test` 均通过，但 tool call 因 liveness 判断极性反转全部在 30ms 内失败；HTTP MCP 不受影响。Issue 标 P1/duplicate，根因仍属于报告者分析。
- Dify [#41264](https://github.com/langgenius/dify/issues/41264) 报告读取单个 Agent 配置的 GET endpoint 缺少 sibling endpoints 都有的 RBAC decorator；采集时 Open，不能把它当作本项目存在同类漏洞。
- Codex Discussion [#40740](https://github.com/openai/codex/discussions/40740) 询问 `Declined` exec 到底来自人工拒绝、policy amendment 还是 guardian assessment，因为 rollout 没持久化这条 provenance；0 comments，场景明确但需求强度低。

**建议动作（Inference）：** 在现有 target/model preflight 与 Command Receipt 上增加脱敏 effective snapshot：actor/role、permission preset、resolved tool/MCP/skill、effect、credential source、host/plugin version；preflight 分开验证 discovery、connect、call、reconnect 及拒绝 provenance。声明为 `read` 但实际可写、保存成功但 canary 无效都进入 `blocked`，不自动放宽权限。

**优先级/成本/风险：** P1 / M。先做负向矩阵与快照；完整插件市场、任意脚本和跨云凭据编排仍 P2/暂缓。

### 4.4 P1/P2：失败状态与清理必须隔离，不能污染后续 Run

**Observed/Maintainer-reproduced：** Agent Framework [#7859](https://github.com/microsoft/agent-framework/issues/7859) 标为 `reproduced`：失败或取消路径没有调用现有 `State.discard()`，导致 Run A 的 pending write 在复用同一 Workflow 的 Run B 成功边界被 commit。Airflow [#72061](https://github.com/apache/airflow/issues/72061) 报告 MySQL 的两阶段 Trigger cleanup 在引用重新建立前删除 Trigger，并通过 cascade 删除 `task_instance`；作者给出 200-task reproducer、MySQL 首 Run 丢 3 行、Postgres 4 Runs 丢 0、带 delete-time recheck 的测试 21,000+ defer events 丢 0。Issue 标 `priority:high/area:core`，但采集时仍 Open。

**建议动作（Inference）：** 保持每 Run Fresh Root Agent 与 Result Session 隔离；失败/取消/重试前清空未提交 side effect，archive/retention 必须在删除时重新核对 active/pinned/reference，而不是只信先前候选列表。DAG/checkpoint/in-run approval 仍 P2；若未来引入，必须先定义 run identity、revision、commit/discard 和 decode fail-closed。

**优先级/成本/风险：** 现有清理/归档负向测试 P1 / S-M；通用 durable workflow P2 / L-XL。

### 4.5 竞品能力变化：只吸收接口约束，不追体量

**Observed（供应方 Release 声明）：** Dify [1.17.0](https://github.com/langgenius/dify/releases/tag/1.17.0) 新增 workspace 级 Skill draft/publish/version、E2B sandbox、发布时 Home Snapshot、Loop/Iteration 内 HITL、统一 trace；并列出防止 `workflow_started` 丢失、保存失败/取消/中断 snapshot 等修复。Prefect [3.8.4](https://github.com/PrefectHQ/prefect/releases/tag/3.8.4) 列出防止 runner 覆盖已经处理的 flow outcome、修正 worker polling health 和 lateness 显示。

**建议动作（Inference）：**

- P1：若 Definition 未来允许选择 Skill/MCP/tool，只允许比全局 policy 更窄，并保存 version/effective snapshot；先做 manifest/receipt，不做市场。
- P1：继续完成现有 phase、health、outcome、lifecycle 的 observed acceptance；统一 trace 可从当前 Run/phase/Receipt 派生，不先引入 tracing backend。
- P2：E2B/远程 sandbox、Home Snapshot、Loop 内 HITL、Skill Marketplace 暂缓；当前稳定版验收和本地可靠性证据优先。

## 5. 汇总映射与优先级

| 类别 | 项目或诉求 | 热度/需求信号 | 来源链接 | 当前能力与差距 | 建议改进或进化方向 | 影响 | 优先级 | 成本 | 风险/前置条件 | 可信度 |
|---|---|---|---|---|---|---|---|---|---|---|
| 当前项目/发布 | alpha.6 与稳定版验收 | 远端 ref、版本和源码窗口内无变化；既有 82/82 与 rc.8/macOS E2E | [main](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c) · [acceptance](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/docs/acceptance-results-2026-08-23-alpha.6.md) | rc.2 Desktop/真实模型、Windows/Linux、卸载中断、阶段强杀仍缺；本次 NOT RUN | 完成原验收矩阵，严格记录 PASS/FAIL/NOT RUN | 极高：决定稳定版 Go/No-Go | P0 | M | 需三平台与真实模型环境 | 高 |
| 当前项目/迁移 | 删除 legacy 导入任务后可能被重启补回 | 本地源码每次 open 都导入缺失 ID；外部 Hermes 同窗报告删除 profile 被旧状态重建 | [service open/import](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/service.ts#L159-L176) · [import loop](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/service.ts#L736-L790) · [Hermes #94823](https://github.com/NousResearch/hermes-agent/issues/94823) | 有 durable delete Receipt，但导入未消费它作 tombstone；无 reopen 回归 | 先补 delete→reopen 测试；优先复用 committed delete Receipt 阻止重导入 | 极高：已删除任务可能重新调度 | P0 | S | 静态路径推断，动态复现 NOT RUN | 高（代码路径）/中（运行后果） |
| 调度/健康 | Scheduled 未 dispatch；effective cadence 静默漂移 | n8n 41 次 schedule 0 成功而 manual/webhook 正常；Windmill 明确时间序列 | [n8n #37065](https://github.com/n8n-io/n8n/issues/37065) · [Windmill #10844](https://github.com/windmill-labs/windmill/issues/10844) | 有 occurrence/nextRun/phase/运行 lease；无 expected-vs-actual/last progress | 从现有事实派生 health；补 manual/scheduled parity；展示 configured/effective | 极高：防静默漏执行 | P0 | M | overlap/misfire 语义需确认 | 高/中 |
| Outcome/持久化 | Session persistence 失败但 delivery 为 `ok` | Hermes 11/11、96 warnings；n8n UI 完成但 DB 永久 running | [Hermes #94736](https://github.com/NousResearch/hermes-agent/issues/94736) · [n8n #37040](https://github.com/n8n-io/n8n/issues/37040) | 有 Run/phase/command Receipt；无结构化 outcome 与逐目标 delivery receipt | 持久化失败 fail closed；拆 `executed/persisted/visible/delivered` | 极高：防假成功 | P0/P1 | M | 先定义 Run 成功硬条件与交付边界 | 中高 |
| 生命周期/一致性 | final/event/error 与任务终态分叉 | Codex final_answer 无 task_complete；LangGraph 错误被吞或只到一个 consumer | [Codex #40552](https://github.com/openai/codex/issues/40552) · [LangGraph #8715](https://github.com/langchain-ai/langgraph/issues/8715) · [#8716](https://github.com/langchain-ai/langgraph/issues/8716) | snapshot 是现有真相；无 lifecycle schema/conformance/多消费者 | 以 runId/revision/sequence 做 event↔snapshot↔Session conformance；终态可补偿 | 高：防完成不可见或错标 | P1 | M | 上游问题多未获维护者确认 | 中高 |
| Incompletion/预算 | 最后副作用额度耗尽但分析已完成 | gh-aw 正确输出结构化 `report_incomplete` | [gh-aw #55783](https://github.com/github/gh-aw/issues/55783) | 有 whole-job timeout；无 token/tool/side-effect budget outcome | 复用 Receipt 保存 effect attempt；partial/incomplete 不伪装 complete | 中高：减少误通知 | P1 | M | 不把本地临时文件当交付 | 高 |
| 状态隔离/清理 | 失败 pending write 泄漏；清理竞态删活跃任务 | MAF 已 `reproduced`；Airflow 报告 109 Runs/55 DAGs | [MAF #7859](https://github.com/microsoft/agent-framework/issues/7859) · [Airflow #72061](https://github.com/apache/airflow/issues/72061) | Fresh Root 降低污染风险；归档/清理负向矩阵不足 | 保持 Run 隔离；失败/取消 discard；删除时重查 active/reference | 高：防跨 Run 污染与误删 | P1 测试/P2 状态机 | S-M/XL | 不直接移植 MySQL 专属机制 | 高 |
| 权限/effect/MCP | 声明 read 实际写；discovery 通过而 call 全失败 | Dify effect 漏标；Hermes stdio/HTTP 对照 | [Dify #41223](https://github.com/langgenius/dify/issues/41223) · [Hermes #94637](https://github.com/NousResearch/hermes-agent/issues/94637) | 固定 unattended allowlist；无 effective actor/effect/tool snapshot 和全阶段 preflight | 复用 preflight/Receipt 保存脱敏 effective snapshot；测 discovery/connect/call/reconnect | 极高：越权或静默不可用 | P1 | M | 不持久化 secret；需 Host 暴露有效能力 | 中高 |
| Trigger/幂等 | 丢 event identity 导致重复，批次只读首 event 导致漏跑 | Activepieces 跨两版与 main 复现 | [Activepieces #15057](https://github.com/activepieces/activepieces/issues/15057) | 当前无外部 Trigger Adapter | future adapter 保存 event identity、遍历 batch、idempotency；接现有 admission | 高但非当前主线 | P1 设计/P2 实现 | M-L | 尚无明确首个 provider | 中高 |
| Skill/插件生态 | Dify versioned Skills、sandbox、snapshot、HITL、tracing | stable 1.17.0 Release；累计 153,513 Star | [Dify 1.17.0](https://github.com/langgenius/dify/releases/tag/1.17.0) | 有插件 Host/固定 allowlist；无 per-Run capability/version snapshot | 先做更窄 policy 与 effective snapshot；市场/云 sandbox/HITL 暂缓 | 中：可靠后才扩生态 | P1/P2 | M/XL | Release 未做用户接受验证 | 高（已发布）/低（需求强度） |
| X 增量 | 真实公开讨论 | 精确窗口无可核验新原帖 | [X 搜索入口](https://x.com/search) | 今日无可纳入新证据 | 不调整优先级 | 无 | — | — | 受访问限制/索引不完整 | 高（对边界） |

## 6. 今日最值得推进的 Top 5

1. **P0：先验证并封住 legacy 删除重现。** 补 `import → delete → dispose/open → remains deleted` 回归；若复现，优先让现有 committed delete Receipt 成为 re-import tombstone，不新增迁移实体。
2. **P0：完成稳定版剩余 observed acceptance。** 补 rc.2 Desktop + 真实模型完整 Run、Windows/Linux Desktop、运行中卸载、真实 permission denial/timeout 和逐阶段强杀；必须写 PASS/FAIL/NOT RUN。
3. **P0：schedule/manual parity + expected-vs-actual health。** 用现有 Definition/occurrence/Run 派生 `expectedAt/overdueBy/lastProgressAt`，补 schedule 未 admission/未 dispatch 的 canary。
4. **P0：终态真实性与持久化 fail-closed。** Agent 执行完成但 Run/Result Session 写入失败时不得发布 `ok`；关闭大 payload 保存也必须留下最小 terminal receipt，并保留昨日“非协作阻塞” fault-injection。
5. **P1：结构化 Outcome/Attention + 可补偿 lifecycle/delivery。** 复用 Receipt，表达 `no_change/needs_input/changes_ready/failed/blocked/partial`；event/snapshot/Session 按 runId/revision/sequence 对账，逐目标交付可 catch-up。

相较昨日：legacy delete→reopen 风险是唯一新进入 Top 5 的本地代码项；MCP/effective capability 与失败状态隔离仍为 P1，未取消。DAG、多 Agent、分布式 Scheduler、大连接器目录、云 sandbox 和 in-run HITL 继续 P2/暂缓。

## 7. X、证据不足与人工确认

1. **当前仓库验证边界。** 今日用 `git ls-remote` 复核远端 main/compat/tag 并读取本地源码、文档和验收记录；没有 fetch、没有运行测试或实机 E2E。82/82、rc.8 Web/macOS Desktop PASS 属既有记录，不是本次新验证。
2. **legacy 删除风险仍是推断。** “每次 open 导入缺失 ID”与“delete 后无 Definition/tombstone”是 Observed；重启后实际重现及重新调度是 Inference，动态复现 NOT RUN。实施前需先用隔离 Storage Domain 跑双次 open 回归。
3. **X 受访问限制。** 本次用关键词组合检索 `AI agent/agentic + cron/automation/scheduler`、`n8n/Dify/Hermes + schedule/automation`；搜索引擎只返回 2026 年 2—3 月等窗口外旧原帖。X 的 exact-window live search URL 直开返回 cache miss，无法查看结果列表。故今日没有可纳入的 X 增量，也没有使用搜索摘要、互动量或窗口外帖子补结论；这不等于 X 上没有讨论。
4. **Star 增速边界。** 只计算自动化记忆明确给出的 Hermes 昨日 exact snapshot 到今日 GitHub 官方计数的观察差；基线没有精确秒级采样时间，因此只能报告区间差值，不能拟合“日增速”。其它项目无同口径双快照，不报告增速。Star/Fork 是关注度，不代表部署量或满意度。
5. **Issue 活跃度边界。** Hermes/gh-aw 的 Issue 明显包含大量自动 sweeper、workflow report、duplicate；数量只说明仓库活动规模，不能当独立用户数。Windmill 同一时段的多条高质量报告可能来自同一研究/测试批次，不能计成多用户共识。
6. **上游报告不是已确认根因。** 除 Agent Framework #7859 的 `reproduced` 标签外，Hermes、n8n、Windmill、Activepieces、LangGraph、Airflow 的数字与根因主要来自作者报告；本稿只采用其复现、控制组和可观察结果。Airflow Issue 虽有 high/core 标签，采集时仍 Open。
7. **Release 不是用户接受。** Dify 1.17.0、Prefect 3.8.4、n8n 2.36.7 的能力/修复来自官方 Release notes；本次没有安装、升级、运行 E2E 或核对生产接受。Dify #41223 虽关闭 completed，本次未确认修复落入哪个 Release。
8. **需要人工确认的语义。** 一是 legacy delete Receipt 是否被产品定义为永久 tombstone；二是长任务超过 interval 时采用 latest-only、skip、delay 还是 queue；三是执行完成但 delivery 失败是否影响 Run status。health 应展示 configured/effective 与原因，不能把所有漂移自动判为失败。

## 8. 一手证据索引

- 当前项目： [main `b0bb2db`](https://github.com/usersx/dsh-automation-center/commit/b0bb2db4179cac1336a4c622147353141df5db5c) · [alpha.6](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.6) · [验收记录](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/docs/acceptance-results-2026-08-23-alpha.6.md) · [service open/import](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/service.ts#L159-L176) · [legacy import loop](https://github.com/usersx/dsh-automation-center/blob/b0bb2db4179cac1336a4c622147353141df5db5c/src/service.ts#L736-L790)。
- 直接竞品： [Hermes repo](https://github.com/NousResearch/hermes-agent) · [#94736 persistence/false ok](https://github.com/NousResearch/hermes-agent/issues/94736) · [#94823 deleted profile reappears](https://github.com/NousResearch/hermes-agent/issues/94823) · [#94540 gateway respawn](https://github.com/NousResearch/hermes-agent/issues/94540) · [#94637 MCP discovery/call](https://github.com/NousResearch/hermes-agent/issues/94637)。
- 调度/Trigger： [n8n #37065](https://github.com/n8n-io/n8n/issues/37065) · [n8n #37040](https://github.com/n8n-io/n8n/issues/37040) · [Windmill #10844](https://github.com/windmill-labs/windmill/issues/10844) · [Activepieces #15057](https://github.com/activepieces/activepieces/issues/15057)。
- 状态/终态： [Codex #40552](https://github.com/openai/codex/issues/40552) · [MAF #7859](https://github.com/microsoft/agent-framework/issues/7859) · [MAF #7862](https://github.com/microsoft/agent-framework/issues/7862) · [LangGraph #8715](https://github.com/langchain-ai/langgraph/issues/8715) · [#8716](https://github.com/langchain-ai/langgraph/issues/8716) · [Airflow #72061](https://github.com/apache/airflow/issues/72061) · [gh-aw #55783](https://github.com/github/gh-aw/issues/55783)。
- 权限/生态： [Dify #41223](https://github.com/langgenius/dify/issues/41223) · [#41264](https://github.com/langgenius/dify/issues/41264) · [Codex Discussion #40740](https://github.com/openai/codex/discussions/40740) · [Dify 1.17.0](https://github.com/langgenius/dify/releases/tag/1.17.0) · [Prefect 3.8.4](https://github.com/PrefectHQ/prefect/releases/tag/3.8.4)。
- 昨日主线状态： [n8n #36886](https://github.com/n8n-io/n8n/issues/36886) · [Dify #41162](https://github.com/langgenius/dify/issues/41162) · [Hermes #94285](https://github.com/NousResearch/hermes-agent/issues/94285) · [LangGraph #8704](https://github.com/langchain-ai/langgraph/issues/8704) · [Codex #40515](https://github.com/openai/codex/issues/40515) · [MAF #7841](https://github.com/microsoft/agent-framework/issues/7841)。除 Codex #40515 新增一位简短复现外，采集时均仍 Open，未观察到窗口内修复/Release/用户复测。

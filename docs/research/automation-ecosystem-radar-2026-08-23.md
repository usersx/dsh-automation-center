# 自动化生态与用户需求雷达日报（2026-08-23）

> 数据采集时间：2026-08-23 11:56（Asia/Shanghai，UTC+08:00）  
> 首次自动化运行：建立基线；后续以本文和 Automation memory 为去重、增量比较起点。  
> 当前项目：`dsh-automation-center@4ea5cc3`（`0.1.0-alpha.6`）；本地宿主分支 `deepseek-harness@b02ee7e` 基于 rc.8，官方最新为 [`dsh-v0.1.1-rc.2`](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.1-rc.2)。  
> 研究范围：当前项目代码与验收证据、AI Agent 自动化、任务调度、工作流编排、插件与 MCP 生态。只做调研与建议，未修改代码、未提交 Issue、未发布内容、未对外联系。

## 执行摘要

1. **alpha.6 已把昨日 P0 的大半补齐，但仍不是“已上线稳定能力”。** 模型策略、无 Session 的 Settings 全局页、目标预检、`claim/setup/executing/settling/delivery` Supervisor、whole-job timeout 和幂等写收据已进入 main，并由 81/81 自动化测试和 main CI 覆盖；Web/Desktop 完整实机矩阵、阶段强杀和错误画面仍未执行，稳定版结论仍是 NO-GO。[验收记录](https://github.com/usersx/dsh-automation-center/blob/4ea5cc3dfa81967f3b2c25a113ab5ffc62eb00c2/docs/acceptance-results-2026-08-23-alpha.6.md) · [main CI](https://github.com/usersx/dsh-automation-center/actions/runs/32599392403)
2. **今天最直接的发布风险是宿主版本漂移。** 当前安装 CI 固定 stock rc.8，而 DeepSeek Harness 已在 2026-08-21 发布 `0.1.1-rc.2`；alpha.6 的公开 GitHub Release/Tag 也尚不存在，公开 Releases 最新停在 alpha.4。先补 rc.2 安装/激活/核心流程验收，再讨论新增功能。
3. **外部需求已从“能定时启动”收敛到“能证明它真的跑了、为什么没产出、何时需要我处理”。** 当前项目已有 phase、lease、heartbeat、持久 Run 和失败未读，但尚不能发现“预期发生却没有 Run”，也没有 `no_change / needs_input / changes_ready` 等结果语义或出站通知。应优先复用现有 Definition、Run、snapshot 和 Cordis event，不新增平行任务实体。
4. **下一条差异化纵切仍是可审查的代码自动化。** 当前 `workspace-write` 直接在目标 Workspace 执行；Codex、Cetus、Vibe Kanban 及公开实践持续证明 per-Run worktree、diff/test evidence、accept/keep/discard 有价值。但它成本高于 Attention/通知，建议 P1，且首版不自动 merge、push 或开 PR。
5. **暂不做通用 DAG、分布式 Scheduler 或“大而全”连接器目录。** Harness 已有前台、非耐久的 `ctx.workflowEngine`，生态也已有 MCP/官方 adapters；应先完成健康、通知、权限快照和审查闭环。X 今日原帖直开为空或 403，相关搜索候选不纳入优先级。

## 当前仓库能力基线：已实现、已验证与未覆盖

| 能力面 | 已观察实现 | 当前证据边界 | 主要差距 |
|---|---|---|---|
| 自动化任务 | Definition/Run/Receipt 三个持久表；创建、编辑、暂停、恢复、删除、立即运行、取消、mark-read；每次 occurrence 创建 Fresh Root Agent + Result Session | 源码、81/81 自动化测试、main CI 通过；完整 alpha.6 Web/Desktop 人工流程未执行 | 无可审查 Artifact/Review 状态；无 RunAttempt/预算；删除后 history 保留但无 tombstone/active-owner 实机故障注入 |
| 插件体系 | 一个可安装 Host/Web Bundle；Cordis effect 生命周期；stock Settings + Conversation shortcut；存在 Shell slots 时升级全局页；Agent tools 与 Web 共用 `snapshot/dispatch` | stock rc.8 隔离 Profile CLI 安装通过；alpha.5 Web 旧基线、alpha.6 UI 实机复验待完成 | CI 只验证 rc.8；未验证最新 rc.2；社区目录 Draft/提交不能当已收录；公开 Release 最新仅 alpha.4 |
| 调度 | once、固定间隔、daily、weekly、manual；IANA 时区；同一 recurrence 实现负责 UI 预览和 Host；DST gap 跳过、fall-back 保持本地时间；deterministic occurrence、latest-only misfire、防重叠 | recurrence、domain、service 自动化覆盖 | 无任意 cron/RRULE 输入（不是当前缺口）；无“应运行但完全未入账”的 dead-man health；无事件 Trigger |
| 执行与编排 | 单 occurrence 的 `claim → setup → executing → settling → delivery`；lease/heartbeat、全作业 deadline、并发上限、保守重启恢复 | 自动化覆盖 phase、timeout、safe-before-side-effect requeue、post-side-effect interrupted | 这是执行生命周期，不是 DAG；Automation Agent 明确阻止 delegation/background process；无 durable checkpoint/resume、多 Agent 编排 |
| 监控与审计 | 持久 Run history、summary、Result Session、requested/effective model、结构化错误、blocked preflight、unread failure、最近运行和统计卡 | 自动化覆盖，页面实机状态矩阵未完成 | 无阶段开始/结束时间与队列年龄；无 expected-vs-actual occurrence、stuck/dead-man；`delivery` 目前只是保存/归档结果，不是独立交付收据 |
| 通知与注意力 | 失败/中断/跳过的未读徽标，可打开 Result Session 后 mark-read | 源码与 client tests | 无 OS/toast/webhook 通知；无 stable lifecycle event；成功一律 unread，不能区分 no-op/actionable/needs-input/changes-ready |
| 权限与安全 | `read-only` / `workspace-write` 快照；approval=`never`；无人值守工具 allowlist；禁止递归 Automation、交互工具、subagent 与后台进程；RPC loopback；只接受已注册 Workspace | 源码与 executor/tools/index tests；不是安全审计 | allowlist 为全局固定集合，尚无 per-role/per-Run MCP/tool policy、credential capability preflight 或插件风险 manifest |
| 生态集成 | DSH 原生插件安装、Agent tools、旧 `dsh_automation` 只读导入、旧/新 Scheduler 冲突保护、可归档 Result Session | 安装/迁移/冲突自动化覆盖 | 无 GitHub/Slack/Linear/file/webhook Trigger 或 Delivery；无公开脱敏事件供 `dsh-task-notify` 等插件直接订阅 |

来源：[README](https://github.com/usersx/dsh-automation-center/blob/4ea5cc3dfa81967f3b2c25a113ab5ffc62eb00c2/README.md)、[domain](https://github.com/usersx/dsh-automation-center/blob/4ea5cc3dfa81967f3b2c25a113ab5ffc62eb00c2/src/domain.ts)、[scheduler/service](https://github.com/usersx/dsh-automation-center/blob/4ea5cc3dfa81967f3b2c25a113ab5ffc62eb00c2/src/service.ts)、[executor/permission](https://github.com/usersx/dsh-automation-center/blob/4ea5cc3dfa81967f3b2c25a113ab5ffc62eb00c2/src/executor.ts)、[recurrence](https://github.com/usersx/dsh-automation-center/blob/4ea5cc3dfa81967f3b2c25a113ab5ffc62eb00c2/src/recurrence.ts)、[CI](https://github.com/usersx/dsh-automation-center/blob/4ea5cc3dfa81967f3b2c25a113ab5ffc62eb00c2/.github/workflows/ci.yml)。

## 与 2026-08-22 基线的去重

昨日的 [Coding Agent 自动化生态与用户诉求调研](./automation-ecosystem-demand-2026-08-22.md) 已覆盖 Codex/OpenClaw/gh-aw/DSH Scheduler 等 coding-agent 自动化，结论集中在无人值守、Attention/Delivery、显式模型与权限快照、worktree Review，以及 Trigger/Execution/Delivery 分层。本文不重复展开这些仓库和相同建议。

今日新增的是跨生态基线，重点回答三个此前证据较薄的问题：

- 长运行工作流暂停/恢复后，状态和人类输入如何不丢、不串、不重复执行；
- scheduler、worker、队列和可见性如何证明“真实数据路径健康”，而不只是某个进程存活；
- 插件/MCP 目录做大以后，工具筛选、凭据边界、投稿准入和团队隔离如何演进。

同时对昨日 coding-agent 样本做了一次今日快照复核。下表的“约 1 日 Star 变化”只比较仓库内 2026-08-22 报告与 2026-08-23 11:52 GitHub API 快照，不是 GitHub 官方增长序列；Release 数包含预发布，commit/作者与 Issue 是最近 30 天、最多 100 条的活动样本。

| 分类 | 项目 | 今日热度/增长 | 近 30 日工程与需求活动 | 结论 |
|---|---|---|---|---|
| 产品问题样本 | [openai/codex](https://github.com/openai/codex) | 113,158 Star，约 +687；13,486 open issues/PRs | 69 Releases；最近 100 commits / 42 位作者；91 条 Issue 活动样本 | 体量与活跃度最高的 Automation 用户问题池，但仓库总 Star 不能当 Automation 功能热度 |
| 广义自主 Agent | [openclaw/openclaw](https://github.com/openclaw/openclaw) | 387,161 Star，约 +42；6,101 open issues/PRs | 8 Releases；最近 100 commits / 18 位作者；43 条 Issue 活动样本 | 累计热度极高，适合取 cron 漏跑、删除残留、迁移和 delivery 故障样本，不是 DSH 直接竞品 |
| Agentic Workflow | [github/gh-aw](https://github.com/github/gh-aw) | 4,978 Star，约持平；392 open issues/PRs | 20 Releases；最近 100 commits / 3 位作者；61 条 Issue 活动样本；Discussions 持续产生日报/审计产物 | 可借鉴 Trigger、safe output、并发和 delivery；今日 whole-job timeout Issue 已关闭 |
| GitHub 事件 Agent | [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action) | 8,697 Star，约 +1；702 open issues/PRs | 20 Releases；61 commits / 23 位作者；36 条 Issue 活动样本 | headless/background 子任务的三条公开 Bug 仍 open，证明“turn 结束”不能等同整个 Run 完成 |
| 可集成 Agent 平台 | [langchain-ai/open-swe](https://github.com/langchain-ai/open-swe) | 10,589 Star，约 +3；30 open issues/PRs | 最近 100 commits / 6 位作者；无 GitHub Releases；stale sandbox owner Issue 仍 open | Slack/Linear/GitHub、sandbox 和 Draft PR 是后续 adapter 参考；当前不应复制其云控制面 |
| Worktree 事故样本 | [BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban) | 27,886 Star，约 +3；533 open issues/PRs | 近 30 日 0 commit / 0 Release；最后推送 2026-04-24 | 累计 Star 高但研发已停滞，只用于 worktree 清理 fail-closed 反例，不作为当前实现选型 |
| DSH 直接竞品 | [titanwings/dsh-automation](https://github.com/titanwings/dsh-automation) | 72 Star，约 +1；4 open Issue | 14 commits / 1 位作者；2 Releases；7 条 Issue 活动 | 体量小但需求贴近：全局入口、显式模型、Session 噪音；其中前两项当前项目 alpha.6 已覆盖 |
| 相邻控制台 | [Lexus2016/claude-code-studio](https://github.com/Lexus2016/claude-code-studio) | 131 Star，约持平；2 open Issue | 17 Releases；最近 100 commits / 1 位作者；25 条 Issue 活动 | 单维护者高频迭代，适合借鉴 Queue、DAG、Telegram/MCP 与 quota 状态；bus factor 风险高 |
| 多 Runtime Desktop | [drewnekota/cetus](https://github.com/drewnekota/cetus) | 125 Star，约持平；4 open Issue | 2 Releases；69 commits / 3 位作者 | per-Run worktree、Review Board、runtime/model 选择与当前差异化方向一致 |

GitHub 数据来源为各仓库 [REST repository endpoint](https://docs.github.com/en/rest/repos/repos#get-a-repository)、Releases、Commits、Issues 和 Discussions，采集时间均为 2026-08-23 11:52（Asia/Shanghai）。增长基线来源为项目内 [2026-08-22 报告](./automation-ecosystem-demand-2026-08-22.md)。

## 研究口径与限制

- Star 是规模信号，不是产品质量或当前动能。GitHub 不提供官方逐日历史 Star 序列，本次也没有同口径的前日快照，因此表中“近期 Star 增长”统一标为**不可验证**，不计算增长率。
- 活跃度综合仓库页的当前 Star/Issue/PR、最近提交、最近 Release，以及公开 Atom commit feed 最近 20 条中的作者去重数。作者数只是“小样本贡献面”，不能当作全体 contributors。
- Release 口径需按仓库解释：Airflow 的 provider RC、Prefect 的 nightly、Temporal 的 server build 会放大发布频率，不能与稳定产品版本直接横比。
- GitHub REST API 在采集过程中触发公共速率限制；后续数字改由公开仓库页、Releases、Atom feed 和具体 Issue/Discussion 交叉核对。Issue 数会持续变化，本文保留采集时快照。
- Issue/Discussion 是明确的用户或贡献者问题，不自动证明所有用户都受影响；跨两个以上项目出现同类问题时，才提升为“反复诉求”。

## 高信号项目基线

| 分类 | 项目 | 热度与当前规模 | 活跃度信号 | 定位判断 | 一手来源 |
|---|---|---|---|---|---|
| 直接竞品 | **n8n** | 201.8k Star、60.3k Fork、350 Issue、约 720 PR；README 称 1,500+ integrations、9,000+ templates | 最近推送 2026-08-22；[2.35.7](https://github.com/n8n-io/n8n/releases/tag/n8n%402.35.7) 于 2026-08-21；最近 20 条 commit feed 约 18 位作者 | 通用自动化与 AI Workflow 成熟平台；目录和模板规模强，但 queue/schedule/wait 可靠性仍有公开问题 | [Repo](https://github.com/n8n-io/n8n) · [Commits](https://github.com/n8n-io/n8n/commits/master) · [Issues](https://github.com/n8n-io/n8n/issues) |
| 直接竞品 | **Dify** | 153.2k Star、24.2k Fork、采集时约 291—296 Issue、656—672 PR | 最近推送 2026-08-23；[1.16.1](https://github.com/langgenius/dify/releases/tag/1.16.1) 于 2026-07-28；最近 20 条 commit feed 约 12 位作者 | 视觉 AI Workflow、Agent、工具和 LLMOps；HITL、RBAC、MCP/OAuth 是当前高信号缺口 | [Repo](https://github.com/langgenius/dify) · [Commits](https://github.com/langgenius/dify/commits/main) · [Issues](https://github.com/langgenius/dify/issues) |
| 直接竞品 | **CrewAI** | 57.5k Star、8.2k Fork、约 112—113 Issue、711—713 PR | 最近提交 2026-08-21；[1.15.17](https://github.com/crewAIInc/crewAI/releases/tag/1.15.17) 于 2026-08-20；最近 20 条 commit feed 约 3 位作者 | 多 Agent/Flow 编排；持久状态、暂停恢复、MCP 和生产运行管理仍持续修复 | [Repo](https://github.com/crewAIInc/crewAI) · [Releases](https://github.com/crewAIInc/crewAI/releases) · [Discussions](https://github.com/crewAIInc/crewAI/discussions) |
| 直接竞品 / 可借鉴 | **LangGraph** | 40.3k Star、6.8k Fork、约 467—468 Issue、242 PR | 最近提交 2026-08-23；SDK [0.4.3](https://github.com/langchain-ai/langgraph/releases/tag/sdk%3D%3D0.4.3) 于 2026-08-19；最近 20 条 commit feed 约 5 位作者 | 长运行有状态 Agent 的 durable execution/checkpoint/HITL 代表；其 Issue 是恢复语义的高信号样本 | [Repo](https://github.com/langchain-ai/langgraph) · [Releases](https://github.com/langchain-ai/langgraph/releases) · [Issues](https://github.com/langchain-ai/langgraph/issues) |
| 直接竞品 / 可借鉴 | **Microsoft Agent Framework** | 13.1k Star、2.2k Fork、493 Issue、107 PR | 最近提交与 [.NET 1.19.0](https://github.com/microsoft/agent-framework/releases/tag/dotnet-1.19.0) 均为 2026-08-22；最近 20 条 feed 约 10 位作者 | Python/.NET/Go Agent 与工作流，含 checkpoint、HITL、time travel、OTel、skills 和 durable extension；当前动能高 | [Repo](https://github.com/microsoft/agent-framework) · [Issues](https://github.com/microsoft/agent-framework/issues) |
| 可集成 / 可借鉴 | **OpenAI Agents SDK (Python)** | 28.9k Star、4.6k Fork、采集时 8 Issue、6 PR | 最近提交 2026-08-23；[0.22.0](https://github.com/openai/openai-agents-python/releases/tag/v0.22.0) 于 2026-08-19；最近 20 条 feed 约 5 位作者 | Agent、handoff、MCP、guardrail、session、tracing 的 SDK；适合作为执行层，不是完整调度控制面 | [Repo](https://github.com/openai/openai-agents-python) · [MCP docs](https://github.com/openai/openai-agents-python/blob/main/docs/mcp.md) · [Issues](https://github.com/openai/openai-agents-python/issues) |
| 可集成 / 可借鉴 | **Temporal** | 22.5k Star、1.8k Fork、555 Issue、364 PR | 最近提交 2026-08-21；Release feed 最新 server build [v1.32.0-162.0](https://github.com/temporalio/temporal/releases/tag/v1.32.0-162.0) 于 2026-08-21；最近 20 条 feed 约 12 位作者 | 耐久执行基础设施；适合借鉴 workflow history、lease、worker/poller health，不宜照搬成产品 UI | [Repo](https://github.com/temporalio/temporal) · [Issues](https://github.com/temporalio/temporal/issues) |
| 可集成 / 可借鉴 | **Apache Airflow** | 46.6k Star、17.7k Fork、约 1.1k Issue、812 PR | 最近推送 2026-08-22；近况以 3.3.x 与 provider 发布为主；最近 20 条 feed 约 18 位作者 | 成熟 schedule/monitor/data workflow；scheduler heartbeat、missed interval、multi-team security 是高价值反例 | [Repo](https://github.com/apache/airflow) · [Releases](https://github.com/apache/airflow/releases) · [Issues](https://github.com/apache/airflow/issues) |
| 可集成 / 可借鉴 | **Prefect** | 23.7k Star、2.5k Fork、786 Issue、约 66—67 PR | 最近推送 2026-08-22；稳定版 [3.8.3](https://github.com/PrefectHQ/prefect/releases/tag/3.8.3) 于 2026-08-13，feed 后续含 nightly；最近 20 条 feed 约 7 位作者 | 现代 Python 编排、schedule、event automation、retry、monitor；并发、手工 retry 和自托管 health 问题密集 | [Repo](https://github.com/PrefectHQ/prefect) · [Issues](https://github.com/PrefectHQ/prefect/issues) · [Discussions](https://github.com/PrefectHQ/prefect/discussions) |
| 直接竞品 | **Activepieces** | 24.0k Star、4.1k Fork、390 Issue、100 PR；README 称约 400 pieces、约 60% 社区贡献 | 最近提交 2026-08-22；[0.88.3](https://github.com/activepieces/activepieces/releases/tag/0.88.3) 于 2026-08-19；最近 20 条 feed 约 8 位作者 | 社区插件、MCP/tool、HITL、自动 retry、版本化兼具，是插件生态直接样本 | [Repo](https://github.com/activepieces/activepieces) · [Releases](https://github.com/activepieces/activepieces/releases) · [Issues](https://github.com/activepieces/activepieces/issues) |
| 直接竞品 / 相邻 | **Windmill** | 17.6k Star、1.1k Fork、556 Issue、261 PR | 最近提交与 [1.795.0](https://github.com/windmill-labs/windmill/releases/tag/v1.795.0) 均为 2026-08-22；最近 20 条 feed 约 4 位作者 | 把脚本变成 webhook/workflow/UI，支持 schedule、HTTP、Kafka、WebSocket、email 等触发；可借鉴 adapter 思路 | [Repo](https://github.com/windmill-labs/windmill) · [Releases](https://github.com/windmill-labs/windmill/releases) |
| 直接竞品 / 可借鉴 | **Trigger.dev** | 16.1k Star、1.4k Fork、347 Issue、76 PR | 最近提交 2026-08-21；最新可见稳定版本 [4.5.8](https://github.com/triggerdotdev/trigger.dev/releases/tag/v4.5.8) 于 2026-07-27 | 面向开发者的耐久后台任务；执行日志、版本偏差、自托管资源和 OTel 配置是代表性问题 | [Repo](https://github.com/triggerdotdev/trigger.dev) · [Releases](https://github.com/triggerdotdev/trigger.dev/releases) · [Issues](https://github.com/triggerdotdev/trigger.dev/issues) |
| 可集成生态 | **MCP Servers / Registry** | 89.8k Star、11.5k Fork、246 Issue、289 PR | 最近提交/Release 为 2026-08-18；最近 20 条 feed 约 3 位作者 | README 明确该 repo 主要是小型 reference servers，并非生产级目录；已发布 server 应查 MCP Registry，不能把 89.8k Star 当成插件安装量 | [Repo](https://github.com/modelcontextprotocol/servers) · [Release 2026.8.18](https://github.com/modelcontextprotocol/servers/releases/tag/2026.8.18) · [MCP Registry](https://registry.modelcontextprotocol.io/) |

### 不应被累计 Star 误导的迁移信号

[Microsoft AutoGen](https://github.com/microsoft/autogen) 仍有 60.6k Star，但官方 README 已明确进入 maintenance mode，不再接受新功能，并建议新用户转向 Microsoft Agent Framework；其最近正式版停在 2025-09-30，代码推送也明显慢于后者。因此它应归为“迁移观察”，不能与当前活跃直接竞品按累计 Star 并列排序。

## Issues / Discussions 中反复出现的需求

### 1. 暂停、恢复与人类输入必须保持因果一致

| 公开证据 | 用户实际遇到的问题 | 可复用的需求定义 | 信号强度 |
|---|---|---|---|
| LangGraph [#8579](https://github.com/langchain-ai/langgraph/issues/8579)、[#8458](https://github.com/langchain-ai/langgraph/issues/8458)、[#6792](https://github.com/langchain-ai/langgraph/issues/6792)、[#6626](https://github.com/langchain-ai/langgraph/issues/6626)、[#6624](https://github.com/langchain-ai/langgraph/issues/6624) | 多个 pending interrupt 下 scalar resume 可能落到非预期请求；从 subgraph checkpoint time-travel/replay 时可能重新执行旧节点或遗漏并行中断 | 每个 human-input/approval 都要有稳定 request/interrupt ID；多请求只接受 ID 映射；恢复点带状态版本；外部副作用节点必须幂等 | 高：同一项目多条 + 其他项目交叉印证 |
| CrewAI [#6706](https://github.com/crewAIInc/crewAI/issues/6706)、[#6766](https://github.com/crewAIInc/crewAI/issues/6766) | 旧 checkpoint 恢复后，新版本增加的 state 字段被静默清掉；自定义 route 后 assistant 回复未进入持久会话，直到新实例才可见 | 状态演进需 schema/version/migration；恢复后要验证持久 state、transcript 和展示层一致 | 高 |
| Dify [#38432](https://github.com/langgenius/dify/issues/38432)、[#38991](https://github.com/langgenius/dify/issues/38991) | HITL 恢复后 workflow 内部继续执行，但最终 Answer 不展示/不持久化；UI 丢失 stop 控制 | `finished` 不能只看引擎；应校验 effective output 已持久化、用户可见并仍可取消 | 高 |

### 2. 调度、并发与 retry 需要耐久收据

| 公开证据 | 用户实际遇到的问题 | 可复用的需求定义 | 信号强度 |
|---|---|---|---|
| n8n [#22901](https://github.com/n8n-io/n8n/issues/22901)、[#15233](https://github.com/n8n-io/n8n/issues/15233)、[#29370](https://github.com/n8n-io/n8n/issues/29370) | queue mode 下 evaluation/error workflow 未入队；陈旧 `waitTill` 导致负 timeout 循环、主进程静默退出并产生假错误 | 分离 due/admitted/queued/started；enqueue 要有 durable receipt；异常 wait 需被 quarantine 而不是拖死主循环 | 高 |
| Prefect [#22386](https://github.com/PrefectHQ/prefect/issues/22386)、[#17484](https://github.com/PrefectHQ/prefect/issues/17484)、[#17913](https://github.com/PrefectHQ/prefect/issues/17913)、[#16984](https://github.com/PrefectHQ/prefect/issues/16984) | slot 空闲仍延迟 12—15 分钟；UI/manual retry 长期卡在 AwaitingRetry；碰撞策略下仍积累 late runs | retry/取消/重跑均需命令收据和超时；并发状态要显示占用者、lease、队列年龄；late/missed/skipped 是显式终态 | 高 |
| Airflow [#67870](https://github.com/apache/airflow/issues/67870)、[#66791](https://github.com/apache/airflow/issues/66791) | scheduler 进程存活但 heartbeat 停止、任务全卡；`catchup=false` 静默跳过 interval，缺明确事件 | watchdog 检查 heartbeat/推进量而非 PID；任何 missed/skipped occurrence 都要记录原因并可通知 | 高 |

### 3. 监控要覆盖真实执行数据路径

| 公开证据 | 用户实际遇到的问题 | 可复用的需求定义 | 信号强度 |
|---|---|---|---|
| Prefect Discussion [#15992](https://github.com/PrefectHQ/prefect/discussions/15992) | UI 能看到函数失败，却不能聚合查看哪个 worker 处理了任务、对应基础设施日志在哪里；维护者承认 task-worker observability 有限 | 每个 Run 绑定 worker/host/queue/attempt；失败可追到基础设施日志和健康状态 | 中高：明确使用场景 + 维护者确认 |
| Prefect Discussion [#20738](https://github.com/PrefectHQ/prefect/discussions/20738) | 自托管 Postgres 静默退化，Redis 任务堆积后崩溃；`/health` 只检查 API 存活，不证明 scheduler/automation services 健康 | 依赖、消费者、scheduler、lease monitor、queue lag 分项 health；需要 dead-man 和最后成功推进时间 | 中高：方案由 bot 代发，事故和现状仍可核对，需降一档 |
| Temporal [#11402](https://github.com/temporalio/temporal/issues/11402)、worker-controller [#447](https://github.com/temporalio/temporal-worker-controller/issues/447)、[#8654](https://github.com/temporalio/temporal/issues/8654) | 丢失 worker registration 后 activity dispatch 永久半注册；K8s ready 不证明 Temporal poller 健康；workflow 存在但 list/UI 不可见 | liveness/readiness 必须发真实探针覆盖 poller/dispatch/visibility；区分运行事实与列表最终一致性 | 高 |

### 4. 插件与 MCP 需要按角色最小授权

| 公开证据 | 用户实际遇到的问题 | 可复用的需求定义 | 信号强度 |
|---|---|---|---|
| CrewAI Tools [#317](https://github.com/crewAIInc/crewAI-tools/issues/317)；OpenAI Agents SDK [#830](https://github.com/openai/openai-agents-python/issues/830) 与 [MCP 文档](https://github.com/openai/openai-agents-python/blob/main/docs/mcp.md) | 同一 MCP Server 的所有工具默认暴露给所有 Agent，带来安全、上下文污染和命名冲突；OpenAI SDK 后续提供静态/动态 filtering、approval、retry、cache | 按 Agent/角色/Run 计算 effective tool allowlist；filter 错误 fail closed；高风险 tool 单独审批；记录实际暴露工具快照 | 高：跨两个 Agent 框架，且一个已落地 |
| OpenAI Agents SDK [#3868](https://github.com/openai/openai-agents-python/issues/3868) | 公开安全报告涉及 SSRF 与 stdio 环境变量泄露，Issue 已关闭 | 插件执行默认最小 env、显式网络策略、敏感值不向子进程透传；修复状态不等于其他平台天然安全 | 中高 |
| Dify Plugins [#2160](https://github.com/langgenius/dify-plugins/issues/2160) 与 [官方投稿要求](https://github.com/langgenius/dify-plugins/blob/main/docs/plugin-submission-requirements.md) | 社区提出自动安全扫描；官方规范已区分风险等级、敏感能力、secret/dev-state、版本与 breaking change 披露 | plugin manifest 承载 capability/risk/secrets/version；先做静态准入和人工升级门禁，再考虑新扫描服务 | 中高：Issue 中扫描数量是作者主张，未独立验证 |
| Airflow [security model](https://github.com/apache/airflow/blob/main/airflow-core/docs/security/security_model.rst)、[#65372](https://github.com/apache/airflow/issues/65372) | 官方明确多团队隔离仍有边界；曾出现团队 secrets backend 忽略 `team_name`、多个团队解析同一 namespace | 团队/租户 secret 作用域必须进入解析键并可审计；共享执行资源不能被描述成强隔离 | 高 |

### 5. 人工运维需要细粒度、可审计的控制

- Prefect Discussion [#15829](https://github.com/PrefectHQ/prefect/discussions/15829)：用户不能直接从 UI 重试或跳过单个 failed task，需要更窄的运行干预。
- Prefect Discussion [#14621](https://github.com/PrefectHQ/prefect/discussions/14621)：flow retry 缺少与 task 对齐的指数退避/jitter，后续给出 GPU 资源分配等具体场景。
- Airflow Discussion [#27400](https://github.com/apache/airflow/discussions/27400)：用户为工作流人工检查点自建外部服务与 sensor，并希望在 UI 中表达原因与审批。

共同要求不是“任意改状态”，而是 task/run 级操作、actor/reason 审计、可撤销边界，以及与运行历史一致的控制收据。

## X 公开讨论：受访问限制

今日检索定位到若干候选 X URL，但直接打开原帖时得到空内容或 HTTP 403，例如：

- <https://x.com/AzFlin/status/2038254991719465285>：公开打开返回 0 行正文；
- <https://x.com/degensing/status/2026578817016566047>：公开打开返回 403；
- <https://x.com/sako_brain/status/2025772842324042025>、<https://x.com/kaiware007/status/2025922591857492001>：公开打开未得到可核验正文。

因此：

- 不从搜索结果摘要推断用户诉求；
- 不引用帖子原文，不报告 likes/reposts/views；
- 不把这些候选放入需求频次或优先级判断；
- 2026-08-22 报告中的 X 样本属于昨日采集，不能冒充今日重新验证结果。

若后续具备可稳定访问原帖的已登录浏览环境，可对候选做“全文、发布时间、作者上下文、互动数据”四项复核后再纳入增量。

## 外部证据支持的最小改动原则

| 方向 | 最小可复用动作 | 不宜立即扩大为 | 外部证据置信度 |
|---|---|---|---|
| Durable continuation | 现有 Run/事件中加入 interruption ID、state revision、resume receipt；恢复只接受明确请求映射 | 新建完整 BPMN/审批实体体系 | 高 |
| 分段运行收据 | 记录 due/admitted/queued/started/finished/delivered 时间、owner/attempt/lease 和错误 | 只增加一张“成功率”大盘 | 高 |
| Data-path health | 基于现有 scheduler/worker/queue/connector 加 heartbeat、queue age、last progress、dead-man | 仅用进程/HTTP 200 作为健康 | 高 |
| Tool least privilege | 复用 plugin manifest/profile 生成 per-role/per-run tool allowlist；高风险 tool 走现有审批 | 再造一套与插件配置并行的权限中心 | 高 |
| Plugin admission | manifest 增加风险、网络、secret、env、版本/兼容声明；自动静态检查 + 人工高风险门禁 | 首日自研全量恶意代码沙箱/商店审核平台 | 中高 |
| Operator controls | 先做 task/run 级 retry/cancel/skip/approve 的 actor/reason/receipt | 任意改 DB 状态或全局重置 | 中高 |
| 生态接入 | 优先 MCP/adapter 复用官方 server，并保留 schema/credential/timeout/health 证据 | 一次性自建数百 connector | 高 |

## 汇总映射与优先级

| 类别 | 项目或诉求 | 热度/需求信号 | 来源链接 | 当前能力与差距 | 建议改进或进化方向 | 影响 | 优先级 | 成本 | 可信度 |
|---|---|---|---|---|---|---|---|---|---|
| 平台兼容/发布 | DSH `0.1.1-rc.2` 与 alpha.6 交付闭环 | 宿主在两天内从 rc.8 发布到 rc.2；当前 main CI 成功，但 GitHub Release 最新仅 alpha.4 | [DSH rc.2](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.1-rc.2) · [项目 Releases](https://github.com/usersx/dsh-automation-center/releases) · [CI](https://github.com/usersx/dsh-automation-center/actions/runs/32599392403) | 当前安装 CI 只固定 rc.8；alpha.6 Web/Desktop 实机矩阵未完成 | 在现有 `stock-rc8-install` job 上增加 rc.2 安装/activation/核心 CRUD+run smoke；完成 Web/Desktop 未执行矩阵后再发 alpha.6 | 极高：决定用户是否能安装和信任 | P0 | S–M | 高 |
| 已有但需验收 | Supervisor、whole-job timeout、target preflight、幂等写收据 | Codex create hang [#39566](https://github.com/openai/codex/issues/39566)、gh-aw timeout [#53938](https://github.com/github/gh-aw/issues/53938)；后者今日已修复关闭 | [alpha.6 验收](https://github.com/usersx/dsh-automation-center/blob/4ea5cc3dfa81967f3b2c25a113ab5ffc62eb00c2/docs/acceptance-results-2026-08-23-alpha.6.md) | 已实现并自动化覆盖；阶段强杀、权限拒绝、实机 timeout/blocked 画面未跑 | 不再新增实体；补现有阶段 fault-injection 与 observed evidence，确认 unknown receipt/read-after-write 用户路径 | 极高：核心可靠性 | P0 | S | 高 |
| 监控/健康 | “正确 no-op”与“根本没运行”不可区分 | Claude Action Discussion [#1686](https://github.com/anthropics/claude-code-action/discussions/1686) 给出真实长期无人值守场景；Codex 后台卡住 [#36414](https://github.com/openai/codex/issues/36414) 仍 open；OpenClaw 漏跑 [#10401](https://github.com/openclaw/openclaw/issues/10401) | 同左 | 已有 nextRun、phase、lease、heartbeat 和 Run history；Host/clock 完全没 admission 时没有记录，也没有 overdue health | 从 Definition schedule + 最新 Run 派生 `expectedAt/overdueBy/lastProgressAt`；先在 snapshot/UI 做 dead-man，不建新 Health 表；later 才接外部 heartbeat | 极高：避免静默失效 | P0 | M | 高 |
| 注意力/结果语义 | 只在 actionable 时打扰；区分 no-change、需输入、改动待审、失败 | Codex quiet/actionable [#28922](https://github.com/openai/codex/issues/28922)、run cleanup [#29179](https://github.com/openai/codex/issues/29179)；Titan Session 噪音 [#2](https://github.com/titanwings/dsh-automation/issues/2) | 同左 | 当前仅 `unread` + failed/interrupted/skipped 徽标；所有完成 Run 都 unread；summary 文本不足以稳定分类 | 扩展现有 Run/视图为 `attention=none|no_change|needs_input|changes_ready|failed|blocked`；先显式工具/结构化结束契约，不从自然语言猜 | 高：降低噪音、形成 Review Inbox | P0 | M | 高 |
| 通知/生态集成 | 生命周期通知与 Delivery receipt | [`dsh-task-notify`](https://github.com/ltao0829/dsh-task-notify) 已实现 toast/OS/sound，但通过 Session snapshot diff 识别；Codex 需要机器可读生命周期事件 [#16484](https://github.com/openai/codex/issues/16484) | 同左 | 项目无出站通知、无公开 run lifecycle event；`delivery` 只是保存/归档 | 复用 Cordis typed events 发布脱敏 `run.started/progress/attention/finished`；先由 task-notify adapter 消费，Definition 加最小 `silent|failure|actionable|always` policy | 高：闭合无人值守反馈 | P1 | S–M | 高 |
| 代码交付/隔离 | per-Run worktree + Review artifacts | Cetus 125 Star/69 commits 样本；Codex cleanup [#29179](https://github.com/openai/codex/issues/29179)；Vibe Kanban 清理事故 [#3406](https://github.com/BloopAI/vibe-kanban/issues/3406) | [Cetus](https://github.com/drewnekota/cetus) · [Vibe issue](https://github.com/BloopAI/vibe-kanban/issues/3406) | `workspace-write` 直接在目标目录执行；Result Session 有轨迹但无 base SHA、diff、test evidence、接纳状态 | Git Workspace 的可写 Run opt-in worktree；保存 base SHA + artifact manifest；accept/keep/discard，清理校验 common-dir/ownership 并 fail closed；首版不 push/PR | 高：产品差异化与安全 | P1 | L | 高 |
| 留存/可见性 | 高频 Run/Session 污染 | Titan [#2](https://github.com/titanwings/dsh-automation/issues/2) 已因真实需求增加归档；Codex [#29179](https://github.com/openai/codex/issues/29179) 要 metadata-backed cleanup | 同左 | 只有全局 `archiveRunSessions` 和每 Automation 同一 `historyLimit`；无 per-task 策略、dry-run、pinned/ambiguous 排除 | 在 Definition 现有配置中加 per-task visibility/retention；cleanup 先返回 preview receipt，再二次确认；活动/不明归属绝不删 | 中高：长期可用性 | P1 | M | 高 |
| 成本/重试 | 预算边界、瞬时失败与配额阻塞 | Codex budget Discussion [#40148](https://github.com/openai/codex/discussions/40148)；Claude Studio quota 状态诉求 [#27](https://github.com/Lexus2016/claude-code-studio/issues/27) | 同左 | 已有 model policy/timeout；无 token/cost、Attempt、nextRetryAt；当前不自动 retry 是安全默认 | 先记录可得的 usage 与 `budget_exhausted/quota_blocked`，仅对 Session 创建前的可判定瞬时错误增加 bounded Attempt；越过 side-effect boundary 仍不重跑 | 中高：成本和 babysitting | P1 | M | 中高 |
| 权限/插件 | per-role/per-Run tool/MCP 最小权限 | CrewAI Tools [#317](https://github.com/crewAIInc/crewAI-tools/issues/317)、OpenAI Agents SDK [#830](https://github.com/openai/openai-agents-python/issues/830) 跨框架重复；Dify 插件开始要求风险声明 | 同左 | 当前固定无人值守 allowlist 安全但粗；Definition 不能声明更窄 tools/MCP/credential capability；无 effective-tools audit | 不建权限中心；从现有 profile/manifest 解析可选的更窄 allowlist，保存 effective tool snapshot；filter/config 错误 fail closed，高风险能力仍不开放给 unattended Run | 高：安全与可集成性 | P1 | M | 高 |
| Trigger/Delivery | GitHub、file、webhook、MCP、after-run | Claude Action schedule [#220](https://github.com/anthropics/claude-code-action/issues/220)、Open SWE Slack/Linear/GitHub、gh-aw safe outputs；n8n/Dify 有大目录但仍受可靠性困扰 | [Open SWE](https://github.com/langchain-ai/open-swe) · [gh-aw](https://github.com/github/gh-aw) | 当前只有 schedule/manual；Session 是唯一结果承载，无 connector health/dedupe cursor | 等 Run health/event 稳定后，再做 `TriggerAdapter → TriggerEvent → existing admission` 和 `DeliveryAdapter`；优先 GitHub/文件报告，复用 MCP/官方 server | 中高：扩场景，但不是当前地基 | P2 | L | 高 |
| 连续任务/记忆 | 跨 Run context，但需作用域和成本控制 | Codex Memories Discussion [#12567](https://github.com/openai/codex/discussions/12567) 34 comments；automation 污染 global memory [#33641](https://github.com/openai/codex/issues/33641) | 同左 | Fresh Session、无来源授权是正确默认；当前无 Automation-local memory/continuity | 保持 fresh 默认；若进入 monitor，再加显式 `memory=off|automation-local`、来源/新鲜度、secret sanitization；禁止默认写全局 memory | 中：长期 monitor 有价值 | P2 | M–L | 高 |
| HITL/恢复 | 暂停恢复的 request 关联与可见结果 | LangGraph、CrewAI、Dify 多条 Issue 反复出现 resume 错配、旧 state 丢字段、内部完成但 UI 无结果 | [LangGraph #8579](https://github.com/langchain-ai/langgraph/issues/8579) · [CrewAI #6706](https://github.com/crewAIInc/crewAI/issues/6706) · [Dify #38432](https://github.com/langgenius/dify/issues/38432) | 当前无人值守 Run 明确不等待人工授权，这避免了整类中途挂起风险 | 暂不加入 in-run HITL；需要输入时先终结为 `needs_input`，用户确认后显式创建 follow-up Run；未来若做 resume，必须有 request ID/state revision/receipt | 中：有需求但会扩大状态机 | P2 | L | 高 |
| DAG/分布式执行 | 多 Agent 工作流、跨 Workspace fan-out、云 Runner | LangGraph/CrewAI/Agent Framework 热度高；DSH 自带 `ctx.workflowEngine`，但官方文档明确 foreground-only、无 journal/resume | [DSH workflow](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.0-rc.8/packages/workflow/workflow/README.md) | Automation 当前单根 Agent；tool guard 阻止 delegation；没有 durable workflow state | 暂不投入新 DAG/分布式 Scheduler；有明确场景后把 `ctx.workflowEngine` 作为可替换执行 seam，先补 journal/resume/预算，不重复造引擎 | 当前低、未来高 | P2/暂缓 | L–XL | 高 |

## 今日最值得推进的 Top 5

1. **P0：补 DSH rc.2 兼容与 alpha.6 observed acceptance。** 在现有 CI 增加 `dsh-v0.1.1-rc.2` 安装/activation smoke；完成 stock Web、macOS Desktop、blocked/timeout/permission/conflict/阶段强杀矩阵。未完成前不把 alpha.6 描述为稳定可用。
2. **P0：增加“预期 occurrence 未发生”的派生健康。** 复用现有 schedule、Definition 和 Runs 计算 `expectedAt / overdueBy / lastProgressAt`，让 Host 未触发、admission 未发生和执行卡住能被区分；先不增加数据库实体。
3. **P0：把 `unread` 进化为明确 Attention/Outcome。** 定义 `no_change / needs_input / changes_ready / failed / blocked`，让成功 no-op 默认静默、真正待处理结果进入 Inbox；分类必须来自结构化结束契约，不能从摘要猜。
4. **P1：发布脱敏生命周期事件并接入本地通知。** 基于现有 Cordis 事件机制输出 run/attention 事件，让 `dsh-task-notify` 一类插件消费；先做 OS/toast/deep link，不直接做 Slack/GitHub 外部写入。
5. **P1：设计并实现一条 worktree Review 纵切。** 只覆盖 Git Workspace 的可写 Run：隔离执行、base SHA、diff/test evidence、accept/keep/discard、冲突与清理 fail closed；首版不自动 merge/push/PR。

## 证据不足与待人工确认

1. **Star 增长没有 GitHub 官方历史序列。** 只有九个 coding-agent 样本能与 2026-08-22 仓库内快照做约 1 日差值，不能当增长率；其他项目只报告累计 Star 和工程活动。
2. **贡献者活跃度是小样本。** coding-agent 表使用最近最多 100 commits 的作者去重，跨生态表使用最近 20 条 feed；两者都不能替代完整 contributors、bus factor 或企业内合并账号分析。
3. **Release 数不可直接横比。** Airflow provider、Prefect nightly、Temporal build tag 会放大频率；主报告若要评分，应分别比较稳定产品发布和组件/预发布。
   本文没有按 Release 数评分；Codex/gh-aw 的预发布也与稳定版分开解释。
4. **Issue 数是动态快照。** GitHub REST 的 `open_issues_count` 还包含 PR；本文只把它作为讨论规模和维护负载信号，不用于精确排名。
5. **X 今日受访问限制。** 原帖直开为空或 403；搜索索引虽出现正文片段，也没有作为原帖证据使用。无可核验全文/上下文/互动数据，可信度为“不可用于结论”。
6. **Dify 插件安全扫描 Issue 中的数量/发现率是提案作者主张。** 本文只采用“用户要求自动扫描”这一事实，不采用其统计数字。
7. **直接竞品边界需产品负责人确认。** LangGraph/Agent Framework 更像执行与编排框架，Temporal/Airflow/Prefect 更像基础设施；它们应主要用于能力和故障模式借鉴，不宜按同一商业产品横排。
8. **alpha.6 的运行时结论有限。** main CI 和 81/81 tests 是已确认的自动化证据；Web/Desktop 完整 UI、真实错误、强杀和跨平台原生 Desktop 未运行，不能写成通过。
9. **公开分发状态需要继续核对。** GitHub Release/Tag 可确认最新只到 alpha.4；本次 npm registry 查询超时，因此没有把 npm 当前 dist-tag 写成事实。
10. **安全能力未经审计。** tool allowlist、loopback 和 Workspace 约束有源码/测试证据，但不等于 sandbox escape、凭据泄露或插件供应链审计通过。
11. **三项需人工产品确认。** 一是官方兼容范围应以 rc.8 为下限还是只追最新 rc.2；二是 `no_change/needs_input/changes_ready` 的业务判定和默认通知策略；三是 worktree accept/discard 的 destructive UX、保留期限和 merge 权限。

## 今日新增的可追溯证据索引

- 暂停/恢复：LangGraph [#8579](https://github.com/langchain-ai/langgraph/issues/8579)、[#8458](https://github.com/langchain-ai/langgraph/issues/8458)、[#6792](https://github.com/langchain-ai/langgraph/issues/6792)；CrewAI [#6706](https://github.com/crewAIInc/crewAI/issues/6706)、[#6766](https://github.com/crewAIInc/crewAI/issues/6766)；Dify [#38432](https://github.com/langgenius/dify/issues/38432)、[#38991](https://github.com/langgenius/dify/issues/38991)。
- 调度/重试：n8n [#22901](https://github.com/n8n-io/n8n/issues/22901)、[#29370](https://github.com/n8n-io/n8n/issues/29370)；Prefect [#22386](https://github.com/PrefectHQ/prefect/issues/22386)、[#17913](https://github.com/PrefectHQ/prefect/issues/17913)；Airflow [#67870](https://github.com/apache/airflow/issues/67870)、[#66791](https://github.com/apache/airflow/issues/66791)。
- 运行健康：Prefect [#15992](https://github.com/PrefectHQ/prefect/discussions/15992)、[#20738](https://github.com/PrefectHQ/prefect/discussions/20738)；Temporal [#11402](https://github.com/temporalio/temporal/issues/11402)、worker-controller [#447](https://github.com/temporalio/temporal-worker-controller/issues/447)、[#8654](https://github.com/temporalio/temporal/issues/8654)。
- 权限/插件：CrewAI Tools [#317](https://github.com/crewAIInc/crewAI-tools/issues/317)；OpenAI Agents SDK [#830](https://github.com/openai/openai-agents-python/issues/830)、[#3868](https://github.com/openai/openai-agents-python/issues/3868)；Dify Plugins [#2160](https://github.com/langgenius/dify-plugins/issues/2160)；Airflow [security model](https://github.com/apache/airflow/blob/main/airflow-core/docs/security/security_model.rst)。

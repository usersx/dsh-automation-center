# 自动化生态与用户需求雷达日报（2026-08-29）

> 数据采集与复核时间：2026-08-29 10:30—16:30（Asia/Shanghai，UTC+08:00）。精确事件窗口固定为：`2026-08-28T02:15:49.806Z`—`2026-08-29T02:30:19.574Z`；晚于自动化触发时刻的新事件不纳入今日增量。
> 只报告相对 [2026-08-28 日报](./automation-ecosystem-radar-2026-08-28.md) 的新增或状态变化。Star/Fork 快照略晚于截止时间，只作当前关注度背景，不伪装成精确窗口增长。
> 证据口径：**Observed** 为本轮直接读取本地 Git/源码/文档或 GitHub 官方页面/API/Release；**Maintainer signal** 为官方 Release、维护者评论或合并；**Reported** 为报告者复现，尚未获维护者确认；**Inference** 为映射到本项目的建议，不是已实现或已验收事实。
> 本轮只做调研与建议；未修改业务代码、未运行测试、未提交 Issue、未发布内容、未对外联系。

## 1. 执行摘要

1. **DeepSeek Harness alpha.1 仍无上游代码闭环，但兼容风险已从“接口变化”升级为多条可复现运行报告。** 窗口内无新 Release、默认分支无新增提交；[#4950](https://github.com/deepseek-ai/deepseek-harness/discussions/4950) 报默认插件清单扩展收集异常会让每次 DeepSeek 请求以 `REQUEST_EXTENSION` 失败，禁用扩展后恢复；[#4969](https://github.com/deepseek-ai/deepseek-harness/discussions/4969) 报 path-prefix 反向代理下所有 connection RPC 静默失败；[#4972](https://github.com/deepseek-ai/deepseek-harness/discussions/4972) 报兼容网关没有 `[DONE]` 时，已有 content + `finish_reason: stop` 仍被记为 `STREAM_CLOSED`。均未获维护者确认。昨日 alpha.1 acceptance P0 保持，并新增 inventory enabled/disabled + 错误透明度、`/dsh-automation-center` path-prefix Remote 和流式终态 conformance 三组负向用例；inventory 是否 fail-open 属于宿主策略，不由本插件擅自改变。
2. **今日最强外部信号是“超时以后副作用仍在执行、重投以后仍会重复执行”。** Activepieces [#15127](https://github.com/activepieces/activepieces/issues/15127) 显示 Agent 固定 60 秒 RPC 超时先报失败，而 90 秒 API action 继续并成功，重试可双执行；[#15130](https://github.com/activepieces/activepieces/issues/15130) 显示 OOM 杀 worker 后的 reclaim 不计 attempts，单 Run 可在 fleet 循环约 17 小时且取消无效；[#15132](https://github.com/activepieces/activepieces/issues/15132) 又把 10—17 秒的交互配置延迟关联到与昨日 enable hook 共用的 worker 队列。P0 应把 ack、execution、cancel/reconcile 预算分开，并在现有 Run/Receipt 上记录 effect id、attempt 与终态。
3. **结果完成必须由 Result Session 可打开且 scope 一致来证明。** Hermes [#96876](https://github.com/NousResearch/hermes-agent/issues/96876) 给出真实日志：cron 被记录为 delivered，却复用已关闭会话轮次的 msgId，用户在当前会话看不到；[#97489](https://github.com/NousResearch/hermes-agent/issues/97489) 又显示 profile A 的 cron 正常执行，但 Session、消息和日志被写进 profile B 的数据库。当前项目不向外部聊天平台投递，不能据此推导本项目缺平台 message id；应复用现有 Run/Result Session，补 Session 存在、可打开、Workspace 归属、provenance、摘要/终态和冷重启后的 scope conformance。未来通知 Adapter 才需要 recipient message id/readback，无需现在新增通知实体。
4. **MCP 准入要从“能列工具”扩到“包真实存在、参数不被污染、鉴权可绑定、断连会清理”。** n8n [#37308](https://github.com/n8n-io/n8n/issues/37308) 中 `tools/list` 成功，但客户端额外注入 `toolCallId/sessionId`，严格 schema server 拒绝实际调用；[#37340](https://github.com/n8n-io/n8n/issues/37340) 报 OAuth access token 缺 `iss` 且 `typ` 不合 RFC 9068。Registry [#1579](https://github.com/modelcontextprotocol/registry/issues/1579) 的窗口内补充扫描又报告 58 个声明包明确 404。昨日 P1 admission 方向不变，但测试边界应扩到 package existence、schema-preserving call、issuer/audience 和 disconnect cleanup。
5. **持久化升级、流式回放和消息游标都必须遵守不可变快照。** OpenAI Agents SDK [#4729](https://github.com/openai/openai-agents-python/issues/4729) 的确定性复现显示从 SQLiteSession 升级到 AdvancedSQLiteSession 会隐藏旧历史，并在首次 pop/delete 时永久删除；[#4727](https://github.com/openai/openai-agents-python/issues/4727) 显示流式 tool-call/text 顺序可污染 Session，使后续回放永久 400。Trigger.dev [v4.5.13](https://github.com/triggerdotdev/trigger.dev/releases/tag/v4.5.13) 与 [v4.5.14](https://github.com/triggerdotdev/trigger.dev/releases/tag/v4.5.14) 则给出供应方闭环：持久 pending message、稳定 record id/cursor、不越过未消费消息和 lastEventId 重连。P1 应复用现有 Run/Receipt 做 immutable snapshot、迁移 dry-run 和 terminal-aware idempotency。

## 2. 当前项目与宿主能力复核

主 Agent 本轮复核到：项目 `main`、`alpha.6` 与 main CI 均无代码或状态变化；宿主最新仍为 `dsh-v0.1.2-alpha.1`。下表能力沿用源码已验证基线，本轮全部 **NOT RUN**，不能据此宣称 alpha.1、生产或稳定版已接受；稳定版仍 **NO-GO**。

| 能力面 | 当前源码已具备（Observed，非本轮重测） | 本轮边界与新增差距 |
|---|---|---|
| 自动化任务 | 持久 Definition/Run/Command Receipt；创建、编辑、暂停、恢复、删除、立即运行、取消、mark-read；新建 Root Agent 与 Result Session | 无 typed Outcome/Attention；需区分 ack timeout、execution timeout、cancel 与外部 effect reconciliation |
| 插件体系 | DSH Host/Web Bundle、Cordis 生命周期；Settings 与 Conversation fallback；Web/Agent Tools 共用 `snapshot/dispatch` | alpha.1 NOT RUN；需加默认 inventory 异常、共存插件 projection 与 package/install 负向 |
| 编排/恢复 | `claim → setup → executing → settling → delivery`、lease/heartbeat、whole-job deadline、保守恢复、target/model preflight | 缺 terminal-aware idempotency、迁移 dry-run、不可变 pending cursor 与 detached effect 回收矩阵 |
| 调度 | once/interval/daily/weekly/manual、IANA 时区/DST、deterministic occurrence、latest-only misfire、防重叠；schedule 与 Definition 单记录持久 | 昨日 #15114 仍 open；需证明 worker/pump 接管、attempt budget、dead-man health，不新增调度实体 |
| 监控/通知 | Run history、phase、summary、结构化 error、unread、durable Receipt、read-after-write、Result Session 入口 | delivery phase 不是外部送达收据；需证明 Result Session 存在/可打开/scope 一致；缺 expectedAt/overdueBy/lastProgressAt |
| 权限 | read-only/workspace-write、approval=`never`、固定 unattended allowlist，拒绝递归 Automation、交互工具与后台进程 | alpha.1 Token/authenticated channel 未验；path-prefix Remote、effective actor、MCP issuer/audience 未验 |
| 生态集成 | `settings.section`、generic `connection.rpc`、Workspace/Agent Preset/模型目录、Agent Tools | `/dsh-automation-center` path-prefix、schema-preserving MCP call、package existence、disconnect cleanup 未验 |

## 3. 热度、发布与工程活动增量

热度来自 GitHub 同源快照；精确增量仅用于同一来源的昨日对比。commit/作者数只表示窗口内默认分支可见活动，不代表质量。Hermes Issue/commit 高度机器化，数量不能当独立用户数。

| 定位 | 项目 | 当前快照及窗口工程活动 | 窗口新增/闭环判断 |
|---|---|---|---|
| 直接宿主 | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | 最新仍 alpha.1；窗口 0 默认分支 commit、0 Release | 多条 alpha.1 Reported，均无 maintainer closure；P0 acceptance 加强但不宣称已不兼容 |
| 直接竞品 | [Hermes Agent](https://github.com/NousResearch/hermes-agent) | 237,862 Star / 48,340 Fork；195 commit / 32 作者 | [#96876](https://github.com/NousResearch/hermes-agent/issues/96876)、[#97489](https://github.com/NousResearch/hermes-agent/issues/97489) 强化 delivery 与 scope；仍过滤 sweeper/重复噪音 |
| 可集成平台 | [n8n](https://github.com/n8n-io/n8n) / [Dify](https://github.com/langgenius/dify) | 202,749 / 60,444，39 commit / 29 作者；153,794 / 24,308，21 / 14 | 昨日 runner #37069 只是 closed duplicate，窗口 stable/prerelease 无 runner 修复；n8n 新增 MCP call/OAuth 合同证据 |
| Agent Workflow | [LangGraph](https://github.com/langchain-ai/langgraph) / [MAF](https://github.com/microsoft/agent-framework) | 40,648 / 6,849，1 / 1；13,192 / 2,238，1 / 1 | LangGraph [#8748](https://github.com/langchain-ai/langgraph/issues/8748) 报 async durability 下 live checkpoint 被后续 superstep 反写；无 maintainer closure；MAF 无改序信号 |
| Agent SDK | [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) / [CrewAI](https://github.com/crewAIInc/crewAI) | 29,049 / 4,625，2 / 2；57,775 / 8,279，4 / 3 | #4727/#4729 是确定性无网络复现；Issue closed 不等于 Release 修复；CrewAI 无改序信号 |
| 调度基建 | [Temporal](https://github.com/temporalio/temporal) / [Airflow](https://github.com/apache/airflow) / [Prefect](https://github.com/PrefectHQ/prefect) | 22,592 / 1,845，4 / 4；46,630 / 17,697，23 / 14；23,713 / 2,486 | Temporal [#11842](https://github.com/temporalio/temporal/issues/11842) 报混合 queue rollout 永久 `IN_PROGRESS` 与 503 重试；不足以改变“不引入分布式 Scheduler”结论 |
| 自动化生态 | [Activepieces](https://github.com/activepieces/activepieces) / [Windmill](https://github.com/windmill-labs/windmill) / [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | 24,082 / 4,112；17,713 / 1,089，9 / 4；16,155 / 1,425，13 / 8 | Activepieces 三条 worker 状态机报告；Trigger.dev 两个 stable Release 构成持久消息/重连闭环，但 [#4819](https://github.com/triggerdotdev/trigger.dev/issues/4819) 的失败 Run idempotency 仍 open |
| MCP 生态 | [MCP Servers](https://github.com/modelcontextprotocol/servers) / [Registry](https://github.com/modelcontextprotocol/registry) | 89,945 / 11,525，11 / 10；7,198 / 970，0 commit | #1579 补 58 个明确 404；#4702 仍 open，仅有 Brave deprecation 旁支；[#4710](https://github.com/modelcontextprotocol/servers/issues/4710) 新报 disconnect 后 subscription 未清理 |

## 4. 今日新增需求与当前项目映射

### 4.1 P0：把 alpha.1 acceptance 扩成“安装、请求扩展、路径前缀、流式终态”矩阵

**证据与价值：** [#4950](https://github.com/deepseek-ai/deepseek-harness/discussions/4950) 在 alpha.1 exact revision 上给出 enabled/disabled 对照，说明可选 inventory 元数据失败可能阻断所有模型请求；[#4969](https://github.com/deepseek-ai/deepseek-harness/discussions/4969) 把 reverse-proxy path-prefix 下的 RPC 静默失败定位到 channel path contract；[#4972](https://github.com/deepseek-ai/deepseek-harness/discussions/4972) 给出 SSE 内容/终态对照。用户需要插件能真实启动、调用并得到可解释终态。

**差距与最小动作（Inference）：** 在昨日 alpha.1 pack/install、Host+Client、Settings、auth negative 基础上，增加：验证本包 manifest name/version 与 inventory enabled/disabled 两种 profile；`REQUEST_EXTENSION` 必须分类为可操作的宿主请求扩展错误，不能被本项目吞成普通模型失败。是否用空清单 fail-open 由宿主决定，本项目只记录开关与结果。再以 `/dsh-automation-center` 做 Remote/path-prefix 正负对照；流式终态按 content、finish_reason、`[DONE]`、EOF 的组合验收，保留真正 truncation fail-closed。先测试，不先做兼容分支。

**影响/成本/风险：** 影响极高、P0、成本 M。前置是 alpha.1 源码资产、反向代理和兼容网关；风险是把社区 Discussion 当维护者确认，或把任意 EOF 当成功。

### 4.2 P0：副作用执行预算、attempt budget 与取消/reconcile 分离

**证据与价值：** Activepieces [#15127](https://github.com/activepieces/activepieces/issues/15127) 的 60 秒 RPC timeout 与 90 秒成功 action 造成“用户已见失败、外部副作用稍后成功”；[#15130](https://github.com/activepieces/activepieces/issues/15130) 的 OOM reclaim 不计 attempts 让单 Run 无限重投；[#15132](https://github.com/activepieces/activepieces/issues/15132) 把用户交互和 enable hook 延迟关联到共享 worker path。用户需要超时、重试、取消与实际副作用一致，不重复扣费或重复写入。

**差距与最小动作（Inference）：** 复用现有 Run/Receipt，记录 `{effectId, owner, attempt, ackAt, startedAt, completedAt, reconcileStatus}`；ack deadline 只表示未确认，不能直接等价于 execution failure；超时后先按 effect id read/reconcile，再决定 retry；OOM/disconnect reclaim 必须消耗 attempt budget；取消后由 recovery scanner 收敛 detached effect。补 60/90 秒、OOM before/after ack、取消竞态与进程重启测试，不新增 Job 表。

**影响/成本/风险：** 影响极高、P0、成本 M。前置是列清所有外部 effect 和幂等能力；风险是对本来不可查询的副作用误判，应允许 `unknown` 并人工处理。

### 4.3 P1：Result Session 必须可见、可打开且 scope 一致

**证据与价值：** Hermes [#96876](https://github.com/NousResearch/hermes-agent/issues/96876) 记录 `delivered`，但旧 round msgId 使用户看不到；[#97489](https://github.com/NousResearch/hermes-agent/issues/97489) 中执行 scope 正确、持久化 scope 错误，profile A 内容进入 profile B 的数据库。它们证明“执行完成”不能替代“结果在正确目标可见”，但不证明当前项目已有平台消息投递缺陷。

**差距与最小动作（Inference）：** 当前每个 Run 已创建独立 Result Session，且现有 Client 已按“打开成功后才 mark-read”处理。应保留并复验这一不变量，补 `Run.sessionId → Session exists → attached Workspace → automation/run provenance → UI open succeeds → summary/terminal matches` 的 readback，以及冷重启、归档开关、跨 Workspace 拒绝测试。任何 owner/Workspace/profile 不一致都 fail closed 并进入 Attention。未来接通知 Adapter 时，再把 recipient/message id/readback 放进现有 Receipt，不先建通知中心。

**影响/成本/风险：** 影响高、P1 验证项、成本 S-M；若发现跨 scope 写入则按安全缺陷升级。前置是 alpha.1 Web/Desktop 与至少两个 Workspace；风险是把 UI 导航失败、Session 持久化失败和未来外部通知混成一个状态，测试应分段记录。

### 4.4 P1：MCP admission 加入 schema-preserving call、issuer 与断连清理

**证据与价值：** n8n [#37308](https://github.com/n8n-io/n8n/issues/37308) 证明 connect + `tools/list` 成功仍可能因客户端污染参数而全部调用失败；[#37340](https://github.com/n8n-io/n8n/issues/37340) 证明 OAuth flow 成功仍可能缺少 issuer 绑定；Registry [#1579](https://github.com/modelcontextprotocol/registry/issues/1579) 新增 58 个声明包明确 404；Servers [#4710](https://github.com/modelcontextprotocol/servers/issues/4710) 报 disconnect 后 subscription 未清理。

**差距与最小动作（Inference）：** 在昨日 transport/package、version/deprecation、schema、connect/call/reconnect canary 上，新增 package existence、按声明 schema 原样发参、issuer/audience/token type、disconnect 后资源/订阅清零。`gated`、`transient`、`invalid`、`deprecated` 分层，不能把需要鉴权当失效；先选 2—3 个真实 MCP。

**影响/成本/风险：** 影响高、P1、成本 M。风险是外部短故障误封和 OAuth 供应方差异；需明确重试与例外白名单。

### 4.5 P1：迁移与恢复必须基于不可变快照和 terminal-aware idempotency

**证据与价值：** Agents SDK [#4729](https://github.com/openai/openai-agents-python/issues/4729) 证明“增强版”存储迁移可静默删除历史；[#4727](https://github.com/openai/openai-agents-python/issues/4727) 证明流式顺序一旦持久化错误会让后续 Session 永久不可用。Trigger.dev 两个 stable Release 则表明 pending message、稳定 record id、未消费 cursor、lastEventId 可恢复是现实修复方向；其 [#4819](https://github.com/triggerdotdev/trigger.dev/issues/4819) 又提醒 idempotency 不能只看 key/expiry，还要看旧 Run terminal status。

**差距与最小动作（Inference）：** 任何 schema/session 升级先 dry-run、备份与 row-count/hash 对账，读不到旧记录时禁止 orphan cleanup；把 provider stream 标准化后再持久；pending input 以稳定 id+cursor 写入 Receipt，只有真正消费后推进；命中失败/取消终态的 idempotency key 时按 policy 新建 attempt 或明确返回旧失败，不能伪装成功缓存。

**影响/成本/风险：** 影响高、P1、成本 M。前置是定义 migration contract 和 terminal retry policy；风险是快照体积与 secret，需白名单和保留期。

## 5. 汇总映射与优先级

| 类别 | 项目或诉求 | 热度/需求信号 | 来源链接 | 当前能力与差距 | 建议改进或进化方向 | 影响、风险或前置 | 优先级 | 成本 | 可信度 |
|---|---|---|---|---|---|---|---|---|---|
| 宿主兼容 | alpha.1 请求扩展、path-prefix、流式终态 | 直接依赖；3 条精确复现；0 上游 commit/Release | [#4950](https://github.com/deepseek-ai/deepseek-harness/discussions/4950) · [#4969](https://github.com/deepseek-ai/deepseek-harness/discussions/4969) · [#4972](https://github.com/deepseek-ai/deepseek-harness/discussions/4972) | CI 只到 rc.2；alpha.1 NOT RUN | inventory on/off+错误透明度、path-prefix Remote、EOF/finish conformance | 极高；fail-open 属宿主策略；勿把 Reported 写成确认 | P0 | M | 中高（复现）/未知（本项目） |
| Worker/副作用 | 超时后成功、OOM 无限重投、共享队列延迟 | 3 个窗口新 Issue；含 60/90 秒与约 17h 实例 | [#15127](https://github.com/activepieces/activepieces/issues/15127) · [#15130](https://github.com/activepieces/activepieces/issues/15130) · [#15132](https://github.com/activepieces/activepieces/issues/15132) | 有 Run/Receipt/lease；effect/attempt/reconcile 不全 | 分离 ack/execution/cancel；effect receipt；attempt budget | 极高；需外部 effect 可查询/幂等 | P0 | M | 中高 |
| 结果可见性/隔离 | delivered 但不可见；跨 profile 持久化 | Hermes 高活动；真实日志/DB 对照 | [#96876](https://github.com/NousResearch/hermes-agent/issues/96876) · [#97489](https://github.com/NousResearch/hermes-agent/issues/97489) | 有 Result Session/Workspace attach；未做完整 readback/scope conformance | Session exists/open/provenance/Workspace/cold-restart 验收；未来通知复用 Receipt | 高；若发现跨 scope 写入则升级安全缺陷 | P1 | S-M | 中高（外部）/未知（本项目） |
| MCP 调用 | 客户端污染参数，list 成功/call 失败 | n8n 202,749 Star；双 server 对照 | [#37308](https://github.com/n8n-io/n8n/issues/37308) | 仅 admission 基线；无 schema-preserving call | 对声明参数做 exact-shape canary；额外元数据走协议外通道 | 高；需真实严格 server | P1 | S-M | 中高 |
| MCP 鉴权/目录 | issuer 缺失、包 404、disconnect 泄漏 | Registry 补 58 个明确 404；member 提出 cleanup Issue | [#37340](https://github.com/n8n-io/n8n/issues/37340) · [#1579](https://github.com/modelcontextprotocol/registry/issues/1579) · [#4710](https://github.com/modelcontextprotocol/servers/issues/4710) | allowlist/preflight 有；缺 issuer/package/live teardown | package existence、issuer/aud、connect/call/disconnect | 高；区分 gated/transient/invalid | P1 | M | 中高/中 |
| Session 迁移 | 升级隐藏并删除旧历史 | SDK 29,049 Star；无网络确定性复现 | [#4729](https://github.com/openai/openai-agents-python/issues/4729) | 有持久 Run/Session；无迁移 dry-run/对账 | 备份、dry-run、hash/count、不可读即禁清理 | 高；需迁移合同 | P1 | M | 高（复现）/中（上游关闭语义） |
| 流式回放 | 首轮成功，后续 replay 永久 400 | main/release 均复现 | [#4727](https://github.com/openai/openai-agents-python/issues/4727) · [DSH #4972](https://github.com/deepseek-ai/deepseek-harness/discussions/4972) | 有 phase/error；缺 provider stream normalization/terminal matrix | 标准化后持久；完整/截断分层 | 高；不能把任意 EOF 当成功 | P1 | M | 高/中高 |
| 持久消息/重连 | pending cursor、lastEventId、redelivery accounting | Trigger.dev 两个窗口 stable Release | [v4.5.13](https://github.com/triggerdotdev/trigger.dev/releases/tag/v4.5.13) · [v4.5.14](https://github.com/triggerdotdev/trigger.dev/releases/tag/v4.5.14) | Receipt 可承载；无 pending input cursor | 稳定 id/cursor；消费后推进；精确 resume | 高；供应方修复不等于本项目已具备 | P1 | M | 高（Release） |
| 未闭环去重 | Activepieces enable、n8n runner、MCP旧版本 | 昨日 Issue 均无有效修复闭环 | [#15114](https://github.com/activepieces/activepieces/issues/15114) · [#37069](https://github.com/n8n-io/n8n/issues/37069) · [#4702](https://github.com/modelcontextprotocol/servers/issues/4702) | 昨日 P0/P1 保持 | 不重复扩设计；继续等待 release + 用户复测 | 高；closed duplicate 不是修复 | 保持 | — | 中 |
| 暂缓 | 通用 DAG/HITL、分布式 Scheduler、大连接器市场 | 今日无当前项目直接需求闭环 | [Temporal](https://github.com/temporalio/temporal) · [MAF](https://github.com/microsoft/agent-framework) | 当前本地自动化深度足够，稳定/兼容更急 | 继续观察；不新增实体/配置流 | 成本 L-XL、权限/状态面扩大 | P2 | L-XL | 中 |

## 6. 今日最值得推进的 Top 5

1. **P0：完成 alpha.1 acceptance 增量矩阵。** 在昨日全链路上加 inventory on/off 与 `REQUEST_EXTENSION` 错误透明度、`/dsh-automation-center` path-prefix Remote、SSE content/finish/`[DONE]`/EOF 组合；仍标 alpha.1 NOT RUN，直到真实验收。
2. **P0：补 side-effect/attempt 故障矩阵。** 覆盖 ack 超时但 effect 成功、OOM before/after ack、redelivery budget、取消后 detached effect、重启 reconciliation；复用 Run/Receipt。
3. **P1：证明 Result Session 可见且 scope 一致。** 验证 Session 存在、目标 Workspace、automation/run provenance、UI 打开、摘要/终态、归档和冷重启；未来通知再复用 Receipt 加 message id/readback。
4. **P1：扩 MCP admission。** 用 2—3 个真实 server 验 package existence、exact-schema call、OAuth issuer/audience、connect/call/reconnect/disconnect；对 gated/transient/invalid/deprecated 分层。
5. **P1：做持久化迁移与回放保护。** 迁移 dry-run+备份+hash/count；流式结果标准化后持久；pending cursor 只在消费后推进；失败终态 idempotency 不得返回“成功缓存”。

与昨日相比：alpha.1 P0 从泛化兼容验收收敛到三个明确负向；worker health P0 从“是否接管”扩到“超时后副作用、OOM 重投和 attempt budget”；Hermes 证据新增 P1 Result Session 可见性/scope 验收，不引入平台通知实体。MCP admission、immutable context/Outcome 保持 P1；通用 DAG、多 Agent、分布式 Scheduler、大市场仍 P2。

## 7. 证据不足、访问受限与人工确认

1. **alpha.1 仍无维护者闭环。** #4950/#4969/#4972、[#4915](https://github.com/deepseek-ai/deepseek-harness/discussions/4915) 和 [#4918](https://github.com/deepseek-ai/deepseek-harness/discussions/4918) 都是用户/社区报告；窗口内没有新 Release 或默认分支提交。当前项目 alpha.1 pack/install、Remote、真实 Agent Run 全部 NOT RUN。
2. **Issue closed 不等于修复发布。** n8n #37069 是 duplicate closure；Agents SDK #4727/#4729 虽 closed，但本轮没有看到包含修复的官方 Release 和用户升级复测。Trigger.dev Release 是供应方修复声明，不是本项目验收。
3. **MCP 大样本仍是报告者自测。** Registry #1579 的 58 个明确 404 和 #1487 的在线率数据方法完整但作者非维护者；可用于准入测试设计，不应用作生态总体 SLA。`gated` 不能与不可用合并。
4. **X 受访问限制。** 精确窗口内未找到可直接核验的 X 原帖；未采用搜索摘要、转述、互动量或窗口外帖子。这不等于 X 上没有讨论。
5. **热度边界。** Star/Fork 快照略晚于事件截止；commit/Issue 数不代表独立用户、部署量或满意度，Hermes 尤其含大量自动化与重复活动。
6. **需要人工确认。** 一是 alpha.1 默认插件包清单上送的隐私/关闭口径；二是 ack 超时后外部 effect 的自动 reconcile 与人工 Attention 阈值；三是哪些 channel 能提供 recipient readback；四是 MCP OAuth 允许的 issuer/token profile 例外；五是 Session/Receipt 快照白名单、备份与保留期。

## 8. 一手证据索引

- 宿主：[alpha.1 Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1) · [#4950](https://github.com/deepseek-ai/deepseek-harness/discussions/4950) · [#4969](https://github.com/deepseek-ai/deepseek-harness/discussions/4969) · [#4972](https://github.com/deepseek-ai/deepseek-harness/discussions/4972) · [#4915](https://github.com/deepseek-ai/deepseek-harness/discussions/4915) · [#4918](https://github.com/deepseek-ai/deepseek-harness/discussions/4918)。
- Worker/调度：[Activepieces #15114](https://github.com/activepieces/activepieces/issues/15114) · [#15127](https://github.com/activepieces/activepieces/issues/15127) · [#15130](https://github.com/activepieces/activepieces/issues/15130) · [#15132](https://github.com/activepieces/activepieces/issues/15132) · [n8n #37069](https://github.com/n8n-io/n8n/issues/37069)。
- 投递/隔离：[Hermes #96876](https://github.com/NousResearch/hermes-agent/issues/96876) · [#97489](https://github.com/NousResearch/hermes-agent/issues/97489)。
- MCP：[n8n #37308](https://github.com/n8n-io/n8n/issues/37308) · [#37340](https://github.com/n8n-io/n8n/issues/37340) · [Registry #1579](https://github.com/modelcontextprotocol/registry/issues/1579) · [#1487](https://github.com/modelcontextprotocol/registry/issues/1487) · [Servers #4702](https://github.com/modelcontextprotocol/servers/issues/4702) · [#4710](https://github.com/modelcontextprotocol/servers/issues/4710)。
- 持久化/恢复：[Agents SDK #4727](https://github.com/openai/openai-agents-python/issues/4727) · [#4729](https://github.com/openai/openai-agents-python/issues/4729) · [#4740](https://github.com/openai/openai-agents-python/issues/4740) · [Trigger.dev v4.5.13](https://github.com/triggerdotdev/trigger.dev/releases/tag/v4.5.13) · [v4.5.14](https://github.com/triggerdotdev/trigger.dev/releases/tag/v4.5.14) · [#4819](https://github.com/triggerdotdev/trigger.dev/issues/4819) · [LangGraph #8748](https://github.com/langchain-ai/langgraph/issues/8748) · [Temporal #11842](https://github.com/temporalio/temporal/issues/11842)。

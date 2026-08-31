# 自动化生态与用户需求雷达日报（2026-08-30）

> 数据采集与复核时间：2026-08-30 10:17—11:49（Asia/Shanghai，UTC+08:00）。精确事件窗口：`2026-08-29T02:30:19.574Z`—`2026-08-30T02:17:13.272Z`；晚于截止时刻的更新不计入今日增量。
> 只报告相对 [2026-08-29 日报](./automation-ecosystem-radar-2026-08-29.md) 的新增或状态变化。Star/Fork 快照略晚于截止时间，只作关注度背景，不伪装成精确截止值。
> 证据口径：**Observed** = 本轮直接读取本地 Git/源码/验收文档或 GitHub 官方页面/API/Release/Issue/Discussion；**Maintainer signal** = 官方 Release、维护者评论/标签/合并；**Reported** = 报告者给出复现，尚未获维护者确认；**Inference** = 面向当前项目的建议，不是已实现、已修复或生产接受事实。
> 本轮只新增本报告；未修改业务代码、未运行测试、未提交 Issue、未发布内容、未对外联系。

## 1. 执行摘要

1. **当前项目 Alpha.7 已完成 GitHub 预发布与 alpha.1/Desktop 实机验收，但 npm 仍明确 BLOCKED，稳定版仍 NO-GO。** `main=e997185`，tag `v0.1.0-alpha.7` 指向 `cd1f46c`；GitHub tgz、SHA-256、SPDX SBOM 与 Sigstore/GitHub attestation 已回读，alpha.1 Web 最终 tgz E2E 与 macOS Desktop 2.0.3 真实模型 Run/三次冷启动已通过。npm Trusted Publishing 最终 PUT 返回 E404，registry 中不存在 Alpha.7，不能把 GitHub Release 写成 npm 发布成功。[本项目 Release](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.7) · [验收记录](https://github.com/usersx/dsh-automation-center/blob/main/docs/acceptance-results-2026-08-30-alpha.7.md)。
2. **今日最高优先级新增是宿主 Settings 脱敏可能 fail-open。** DeepSeek Harness [Discussion #5055](https://github.com/deepseek-ai/deepseek-harness/discussions/5055)（2026-08-29T19:00:12Z）报告 `redactSecrets` 只遍历 object/dict/array；union、intersection、tuple、transform、lazy 或 dict-key 下的 secret 可能原样出现在 wire descriptor，同时 `secrets=[]`。报告附 fork patch、22/22 新 gate 测试、204/204 package/controller 测试，但无维护者确认或上游合入。Alpha.7 已验收 Settings 展示，不等于复杂 schema secret 安全通过；P0 应补 fail-closed 负向，不能引用社区 patch 当已修复。
3. **结果落盘成功仍可能在 UI 永久不可见，昨日 Result Session readback P1 获得更直接证据。** DSH [#5056](https://github.com/deepseek-ai/deepseek-harness/discussions/5056)（2026-08-29T19:29:18Z）报告 idle dispose 后 turns 6—9 已持久、seq 连续、fork 可见，但原页面永远停在 turn 5；本地修复为 disposed 时关闭旧 follow stream。当前项目 Alpha.7 已通过 Result Session 与冷启动，不代表 dispose/cold-follow 重连路径已覆盖；P1 增加 `disposed → follow terminal → relist/refollow → latest seq visible` 生命周期不变量。
4. **恢复和缓存不能依赖位置、同名 node 或无 scope 的动态 identity。** CrewAI [#7154](https://github.com/crewAIInc/crewAI/issues/7154)（16:38:51Z）报告 task list 前插后 `replay()` 仍按日志 position 复原，输出错配到别的任务；LangGraph [#8753](https://github.com/langchain-ai/langgraph/issues/8753)（16:03:17Z）报告 callable/partial 的动态 cache namespace 冲突，使 Graph B 静默返回 Graph A 结果；MAF [#7943](https://github.com/microsoft/agent-framework/issues/7943)（04:22:38Z，标 `reproduced`）报告 compaction 已生成 summary，却在 reconcile 后把旧上下文与新 summary 一起丢掉。P1 应在既有 Run/Receipt 上保存稳定 Definition/task/tool identity + revision/scope，并做 input→projected→persisted conformance。
5. **取消清理必须保持 owner 直到 settle 完成。** OpenAI Agents SDK [#4747](https://github.com/openai/openai-agents-python/issues/4747)（03:21:49Z）报告 PTY finalizer 先从 registry pop，再 await teardown；调用者取消后，资源已无 owner，后续 terminate-all 也找不到。该证据直接强化昨日 P0 cancellation-safe cleanup：先标 settling、shield/await cleanup，再释放 registry ownership；不能“先删注册、后等清理”。

## 2. 当前项目增量与能力边界

| 观察面 | 本轮 Observed | 能力/验证边界 | 尚缺或建议 |
|---|---|---|---|
| 发布 | `main@e997185`；Alpha.7 GitHub prerelease、固定 tgz/checksum/SBOM/attestation PASS | npm Alpha.7 因 Trusted Publishing E404 未发布；Alpha.6 仍是 registry 可安装基线 | 先修 npm 包权限并做 registry readback；不得用本机身份绕过既定发布边界 |
| 宿主兼容 | alpha.1 Web 最终 tgz 安装、Host/Client、一次性 Token、Settings、Definition、Run Now、失败终态、Result Session/Attention readback PASS | 真实模型成功 Run 在 alpha.1 Web 仍待最终验收；inventory/path-prefix/复杂 secret 负向未跑 | P0 补 Settings secret gate、冗余 sandbox request、path-prefix/inventory；保持最小测试改动 |
| Desktop | macOS Desktop 2.0.3（内置 rc.2）Alpha.7 升级、真实模型 Run、结构化 Outcome、Result Session、三次冷启动 PASS | Windows/Linux Desktop GUI、卸载/恢复与真实进程强杀未完成 | 稳定版继续 NO-GO；未运行项不能被 Alpha.7 PASS 覆盖 |
| 自动化任务 | Definition/Run/Command Receipt、structured Outcome/Attention、Result Session 与 read-after-write 已落地 | dispose 后 follow 重连、compaction summary identity、跨 revision replay/caching 尚未系统验收 | 复用现有 Run/Receipt/Session；不新增 Job、Replay 或 Cache 实体 |
| 权限/安全 | read-only/workspace-write、approval=`never`、固定 unattended allowlist；拒绝递归 Automation、交互工具和后台进程 | host Settings complex schema redaction、redundant same-mode escalation 与 schema/default/error text 泄漏未验 | fail-closed secret negative；same/narrower/wider sandbox matrix；结果仅记录 observed |
| 生态/MCP | DSH 原生插件、generic RPC、Workspace/Preset/模型目录、Agent Tools | 通用 durable MCP Run 仍未实现；握手 instructions、package/schema/call/issuer/disconnect 尚未全链路 | P1 做 policy-gated instructions provenance + live canary；大市场仍 P2 |

## 3. 热度、发布与工程活动增量

以下热度来自 GitHub 同源快照；括号为相对 08-29 日报的 Star/Fork 变化。默认分支 commit/作者数严格按事件窗口；Hermes 活动高度机器化，不当作独立用户数。跟踪仓库窗口内均无新 Release，不能用 commit 或 Issue 代替发布闭环。

| 定位 | 项目 | 当前热度及变化 | 窗口工程活动 | 新需求/闭环判断 |
|---|---|---:|---:|---|
| 直接宿主 | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | 203,587 / 23,511（+1,060/+204） | 0 commit / 0 Release | #5055 secret redaction、#5056 cold follow、[#4976](https://github.com/deepseek-ai/deepseek-harness/discussions/4976) sandbox non-widening、[#5003](https://github.com/deepseek-ai/deepseek-harness/discussions/5003) MCP instructions；均无 maintainer closure |
| 直接竞品 | [Hermes Agent](https://github.com/NousResearch/hermes-agent) | 238,179 / 48,450（+317/+110） | 218 / 36 | 高活动但本轮未发现改变 P0/P1 排序的非机器化闭环；昨日 teardown/delivery 结论保持 |
| 可集成平台 | [n8n](https://github.com/n8n-io/n8n) / [Dify](https://github.com/langgenius/dify) | 202,819 / 60,459（+70/+15）；153,851 / 24,316（+57/+8） | 2/2；6/4 | n8n [#37354](https://github.com/n8n-io/n8n/issues/37354) 报每次模型调用为每个 MCP 重连+tools/list，10 MCP 时 median 60.29s；无 maintainer closure；Dify 无改序信号 |
| Agent Workflow | [LangGraph](https://github.com/langchain-ai/langgraph) / [MAF](https://github.com/microsoft/agent-framework) | 40,685 / 6,858（+37/+9）；13,208 / 2,239（+16/+1） | 0；0 | #8753 cache scope collision；#7943 标 `reproduced` 的 compaction summary 丢失；均无 Release 修复 |
| Agent SDK | [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) / [CrewAI](https://github.com/crewAIInc/crewAI) | 29,064 / 4,630（+15/+5）；57,803 / 8,284（+28/+5） | 0；0 | #4747 teardown owner；#7154 positional replay；无 Release/维护者闭环 |
| 调度基建 | [Temporal](https://github.com/temporalio/temporal) / [Airflow](https://github.com/apache/airflow) / [Prefect](https://github.com/PrefectHQ/prefect) | 22,598 / 1,848（+6/+3）；46,642 / 17,700（+12/+3）；23,716 / 2,487（+3/+1） | 0；23/16；4/2 | 没有改变“不引入分布式 Scheduler/DAG”排序的新证据 |
| 自动化生态 | [Activepieces](https://github.com/activepieces/activepieces) / [Windmill](https://github.com/windmill-labs/windmill) / [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | 24,100 / 4,117（+18/+5）；17,718 / 1,089（+5/0）；16,159 / 1,429（+4/+4） | 0；6/1；4/3 | #15114/#15127/#15130/#15132 仍 open，无维护者/Release 闭环；Trigger #4819 无窗口更新，最新仍 v4.5.14 |
| MCP 生态 | [MCP Servers](https://github.com/modelcontextprotocol/servers) / [Registry](https://github.com/modelcontextprotocol/registry) | 89,961 / 11,533（+16/+8）；7,200 / 970（+2/0） | 0；0 | Registry #1579 的下一次更新发生在 `02:46:49Z`，晚于截止，明确排除；本窗口无产品闭环 |

## 4. 今日新增需求与当前项目映射

### 4.1 P0：Settings secret 的 wire face 必须 fail closed

**证据/用户价值：** [DSH #5055](https://github.com/deepseek-ai/deepseek-harness/discussions/5055) 报复杂 schema 容器后的 secret 可绕过结构遍历，wire descriptor 表面成功却携带明文。当前插件已在 alpha.1 Settings 上展示并通过功能验收，用户需要“配置能显示”同时不把凭据暴露给非 owner、浏览器、日志或错误文本。

**差距/最小动作（Inference）：** 不改宿主实现，先在 Alpha.7/alpha.1 验收矩阵注册 adversarial settings namespace：object/dict/array 正常脱敏，以及 union/intersection/tuple/transform/lazy/default/schema-description/error-message 全部不得出现 sentinel secret；遇到无法安全遍历的 secret-bearing schema 应拒绝 wire describe 并给不含 schema 文本的错误。当前项目若无自有 secret 字段，也要验证共存插件不会通过宿主共享 Settings 面泄漏。

**影响/成本/风险：** 影响极高、P0、安全边界、成本 S-M。前置是隔离 profile 与假凭据；风险是社区 fork patch 未获维护者确认，报告只能写测试结果，不能写上游已修。

### 4.2 P0：teardown owner 在 settle 完成前不能释放

**证据/用户价值：** [Agents SDK #4747](https://github.com/openai/openai-agents-python/issues/4747) 的确定性复现显示“先 registry pop、后 await terminate”会在调用者取消时永久失去 PTY/WebSocket/session owner。用户需要取消、超时和重启真正结束资源，而不是 Run 终态先完成、后台资源继续占用或计费。

**差距/最小动作（Inference）：** 在现有 Supervisor、Run phase、lease/Receipt 上建立 `owned → settling → released` 不变量：registry/owner 只在 cleanup settled 后移除；cleanup task 使用 cancellation-safe shield/uncancelled waiter，失败持久化 `cleanupStatus=unknown|retrying|manual`；进程强杀后由 recovery scanner 按 effect id reconcile。不新增资源表。

**影响/成本/风险：** 影响极高、P0、成本 M。前置是列全子进程、Session、锁、连接和 worktree owner；风险是 shield 无上限，仍需 outer dead-man 与人工 Attention。

### 4.3 P1：Result Session follow 必须在 dispose/cold restore 后收敛

**证据/用户价值：** [DSH #5056](https://github.com/deepseek-ai/deepseek-harness/discussions/5056) 区分了 durable history 正常与 UI follow 永久冻结；fork/list 能看到新 turns，原页面却无错误、无重连。当前 Alpha.7 Result Session/三次冷启动 PASS 是强基线，但未覆盖 idle dispose 后同页面继续写入/追尾。

**差距/最小动作（Inference）：** 复用现有 Result Session，不建投递实体；补 `session/disposed`、旧 journal EOF、refollow、latest seq、UI open、Workspace/provenance、mark-read 的 conformance。disposed 后旧 follow 必须 terminal，客户端要明确 relist/refollow；超时显示 Attention，而不是静默停在旧 seq。

**影响/成本/风险：** 影响高、P1、成本 S-M。若发现跨 scope 或错误 Session 内容，则升级安全/P0；本 Discussion 仍是 Reported。

### 4.4 P1：恢复、缓存与 compaction 使用稳定 identity，不用 position 或 `__dynamic__`

**证据/用户价值：** CrewAI [#7154](https://github.com/crewAIInc/crewAI/issues/7154) 的 task 前插/reorder 会把旧输出错配给新 task；LangGraph [#8753](https://github.com/langchain-ai/langgraph/issues/8753) 的 callable/partial cache identity 缺失会让不同 graph 静默串值；MAF [#7943](https://github.com/microsoft/agent-framework/issues/7943) 已标 `reproduced`，但 compaction summary 在 reconcile 后被静默丢弃。用户需要恢复的是同一个定义/任务/上下文，不是相同位置或同名 node。

**差距/最小动作（Inference）：** 复用 Definition.id/revision、Run.id、Receipt 与 Result Session provenance，生成稳定 `definitionRevision + task/tool identity + workspace/graph scope`；replay/cache hit 前校验 identity，无法证明则 miss/fail closed。compaction 做 `input ids → projected ids/summary id → persisted ids` 对账，并记录 dropped reason；不要新增通用 DAG/cache 服务。

**影响/成本/风险：** 影响高、P1、成本 M。前置是冻结 identity 规范与 migration policy；风险是 hash 包含 secret，必须只对白名单元数据取摘要。

### 4.5 P1：MCP 握手 instructions 与 tools cache 必须有 provenance 和策略边界

**证据/用户价值：** [DSH #5003](https://github.com/deepseek-ai/deepseek-harness/discussions/5003)（2026-08-29T07:26:43Z）报 MCP client 只消费 tools/list，不读取 handshake `instructions`，跨工具顺序、分页和禁用约束因此静默丢失；n8n [#37354](https://github.com/n8n-io/n8n/issues/37354) 报每次 model call 为每个 MCP 重连+list，10 MCP median 60.29s，聚合后降到 3.4—5.9s。

**差距/最小动作（Inference）：** 不把外部 instructions 无条件拼进 system prompt。连接时记录 `{server identity, version, instructions hash, trust/effective actor, fetchedAt}`，经 allowlist/policy 决定是否注入脱敏 guidance；tools cache key 至少含 server identity/version/auth scope/schema hash，默认 per-execution，支持动态 list opt-out 与显式 invalidation。connect/call/reconnect/disconnect canary 保持。

**影响/成本/风险：** 影响高、P1、成本 M。风险是 prompt injection、陈旧权限和跨租户缓存；前置是 2—3 个可信/恶意正负 MCP 样本。

## 5. 汇总映射与优先级

| 类别 | 项目或诉求 | 热度/需求信号 | 来源链接 | 当前能力与差距 | 建议改进或进化方向 | 影响、风险或前置 | 优先级 | 成本 | 可信度 |
|---|---|---|---|---|---|---|---|---|---|
| 发布 | Alpha.7 GitHub PASS、npm BLOCKED | 完整 prerelease 资产；registry E404 | [Release](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.7) · [验收](https://github.com/usersx/dsh-automation-center/blob/main/docs/acceptance-results-2026-08-30-alpha.7.md) | alpha.1/Desktop 实机显著推进；npm 与稳定版未完成 | 修 Trusted Publisher 权限后 registry readback；继续稳定版门槛 | 极高；不得绕过发布授权边界 | P0 交付 | S | 高 |
| Settings 安全 | complex schema secret fail-open | DSH +1,060 Star；fork patch 22/22、204/204；无上游合入 | [#5055](https://github.com/deepseek-ai/deepseek-harness/discussions/5055) | Settings 功能 PASS；复杂 secret/default/error 负向缺失 | adversarial namespace；wire describe fail closed | 极高；假凭据/隔离 profile；社区报告非修复 | P0 | S-M | 中高 |
| 取消/清理 | registry pop 后 teardown 被取消 | SDK 29,064 Star；确定性 repro；无 Release | [#4747](https://github.com/openai/openai-agents-python/issues/4747) | 有 Supervisor/lease；owner settle 不变量未完整证明 | owned→settling→released；Receipt reconcile | 极高；shield 需 dead-man | P0 | M | 高（复现）/中（本项目映射） |
| Sandbox 兼容 | non-widening request 使工具全失败 | DSH #4976 有 rc.2 repro + alpha.1 源码复核 | [#4976](https://github.com/deepseek-ai/deepseek-harness/discussions/4976) | approval never/workspace-write 已有；冗余 same-mode 未验 | same/narrower/wider + empty justification matrix；先验收不改宿主 | 高；模型可能投机填参 | P0 验证 | S | 中高 |
| Result Session | durable turns 有、原页面永久不可见 | DSH #5056 真实 seq/fork/list 对照 | [#5056](https://github.com/deepseek-ai/deepseek-harness/discussions/5056) | 冷启动 PASS；idle dispose/refollow 未验 | dispose→follow terminal→refollow→latest seq | 高；需 alpha.1 Web 长会话 | P1 | S-M | 中高 |
| Replay/Cache | position 错配、dynamic scope 串值 | 两个独立项目确定性复现 | [CrewAI #7154](https://github.com/crewAIInc/crewAI/issues/7154) · [LangGraph #8753](https://github.com/langchain-ai/langgraph/issues/8753) | 有 Definition/Run id；缺统一 revision/scope identity contract | stable identity + miss/fail closed；不用 positional replay | 高；hash 不含 secret | P1 | M | 高（复现） |
| Compaction | summary 生成后静默丢弃 | MAF `reproduced` 标签；4→2 而非 3 | [#7943](https://github.com/microsoft/agent-framework/issues/7943) | 有 Result Session/Outcome；无 projection/persist 对账 | ids/count/summary conformance；dropped reason | 高；标签非 Release 修复 | P1 | S-M | 高（维护流程信号） |
| MCP context/perf | instructions 丢失；每次重连/list 线性变慢 | DSH/n8n 独立报告；10 MCP median 60.29s | [DSH #5003](https://github.com/deepseek-ai/deepseek-harness/discussions/5003) · [n8n #37354](https://github.com/n8n-io/n8n/issues/37354) | admission 基线有；无 instructions provenance/cache identity | policy-gated guidance；per-execution scoped cache + invalidation | 高；prompt injection/陈旧授权 | P1 | M | 中高 |
| 未闭环去重 | Activepieces、Trigger、MCP Registry | 昨日 Issues 无维护者/Release 状态改变 | [#15114](https://github.com/activepieces/activepieces/issues/15114) · [#4819](https://github.com/triggerdotdev/trigger.dev/issues/4819) · [Registry #1579](https://github.com/modelcontextprotocol/registry/issues/1579) | 昨日 P0/P1 保持 | 不重复扩设计；等待 Release+用户复测 | #1579 cutoff 后更新必须排除 | 保持 | — | 中 |
| 暂缓 | DAG/HITL、分布式 Scheduler、大连接器市场 | 窗口无当前项目需求闭环 | [Temporal](https://github.com/temporalio/temporal) · [Airflow](https://github.com/apache/airflow) | 当前本地自动化深度足够 | 继续观察，不增实体/配置流 | 成本 L-XL、权限/状态面扩大 | P2 | L-XL | 中 |

## 6. 今日最值得推进的 Top 5

1. **P0：补 Settings secret fail-closed 与 sandbox 权限负向。** 用 sentinel secret 覆盖复杂 schema/default/error text；覆盖 same/narrower/wider escalation 和空 justification。只记录 Alpha.7/alpha.1 实测，不引用社区 patch 为修复。
2. **P0：完成 Alpha.7 npm 受控发布。** 修复 Trusted Publisher 对包的权限后重跑既有 release workflow，必须以 registry version/integrity/provenance 回读为完成；不使用本机已登录身份绕过。
3. **P0：验证 teardown ownership。** 对取消、deadline、强杀、restart 覆盖 `owned→settling→released`，registry 只在 cleanup settled 后删除，未知外部 effect 进入 Attention/reconcile。
4. **P1：补 Result Session dispose/refollow 与 compaction conformance。** 同页面 idle dispose 后继续产生结果必须追到最新 seq；compaction summary 要有稳定 id 且确实持久，不能只看策略返回成功。
5. **P1：冻结 replay/cache/MCP identity。** 以 definition revision、task/tool/server/auth scope/schema hash 做命中边界；MCP instructions 经 provenance/trust policy 后再使用，动态 tools 支持显式不缓存。

相较昨日：Alpha.7 已从“待验收”推进到 GitHub prerelease/alpha.1 Web/Desktop 实机 PASS，但 npm 与稳定版仍未闭环；宿主 Settings secret 进入新的 P0 安全验证；Result Session P1 从一般可见性收敛为 dispose/refollow；immutable identity P1 获得 CrewAI、LangGraph、MAF 三个独立项目共振。通用 DAG、多 Agent、分布式 Scheduler、大市场仍 P2。

## 7. 证据不足、访问受限与人工确认

1. **DSH 社区报告不是上游修复。** #5055/#5056/#4976/#5003 均无 maintainer 合入或 Release；fork/local patch 和通过的自报测试只能提高复现可信度，不能写成宿主已修。
2. **Alpha.7 边界清晰。** GitHub Release、alpha.1 Web、macOS Desktop 是 Observed PASS；npm 是 BLOCKED；Windows/Linux Desktop GUI、卸载/恢复、真实进程强杀、path-prefix/inventory、复杂 secret 负向仍未完成；稳定版 NO-GO。
3. **Issue 状态边界。** Agents #4747、CrewAI #7154、LangGraph #8753、n8n #37354 均 open；MAF #7943 的 `reproduced` 是维护流程信号，不是 Release 修复。Activepieces 旧 Issues 只有外部评论，无新增复现/维护者信号。
4. **精确截止。** MCP Registry #1579 的 `updatedAt=2026-08-30T02:46:49Z` 晚于 `02:17:13.272Z`，已排除，不计今日变化。
5. **X 受访问限制。** 精确窗口检索只返回窗口外旧帖，没有可直接核验且可纳入的 X 原帖；未采用搜索摘要、转述或互动量。这不等于 X 上没有讨论。
6. **热度边界。** Star/Fork 快照略晚于 cutoff；commit/Issue 数不代表独立用户、部署量或满意度，Hermes 尤其含大量机器化活动。
7. **需要人工确认。** 一是 npm Trusted Publisher 的包权限配置；二是复杂 Settings schema 的 fail-closed UX；三是 cleanup shield 的最大预算与人工接管阈值；四是 replay/cache identity 的兼容迁移；五是 MCP instructions 的信任、脱敏、注入与缓存策略。

## 8. 一手证据索引

- 当前项目：[Alpha.7 Release](https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.7) · [验收结果](https://github.com/usersx/dsh-automation-center/blob/main/docs/acceptance-results-2026-08-30-alpha.7.md) · [实施审计](https://github.com/usersx/dsh-automation-center/blob/main/docs/implementation-status-2026-08-30-alpha.7.md)。
- 宿主：[DSH #5055](https://github.com/deepseek-ai/deepseek-harness/discussions/5055) · [#5056](https://github.com/deepseek-ai/deepseek-harness/discussions/5056) · [#4976](https://github.com/deepseek-ai/deepseek-harness/discussions/4976) · [#5003](https://github.com/deepseek-ai/deepseek-harness/discussions/5003)。
- 恢复/身份：[Agents SDK #4747](https://github.com/openai/openai-agents-python/issues/4747) · [CrewAI #7154](https://github.com/crewAIInc/crewAI/issues/7154) · [LangGraph #8753](https://github.com/langchain-ai/langgraph/issues/8753) · [MAF #7943](https://github.com/microsoft/agent-framework/issues/7943)。
- MCP/性能：[n8n #37354](https://github.com/n8n-io/n8n/issues/37354) · [MCP Registry #1579](https://github.com/modelcontextprotocol/registry/issues/1579) · [MCP Servers](https://github.com/modelcontextprotocol/servers)。

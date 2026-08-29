# 自动化生态与用户需求雷达日报（2026-08-28）

> 数据采集时间：2026-08-28 10:08—10:27（Asia/Shanghai，UTC+08:00）；仓库热度快照最晚采于 2026-08-28T02:23Z。
> 精确事件去重窗口：2026-08-27T02:32:30Z（昨日证据截止）至任务指定截止 2026-08-28T02:15:49.806Z；晚于该时刻的 Star/Fork 只作当前快照，不计为 Issue/Release/Discussion 增量。
> 范围：当前项目、DeepSeek Harness 宿主、AI Agent 自动化、调度与编排、插件/MCP、监控、通知和权限。只报告相对 [2026-08-27 日报](./automation-ecosystem-radar-2026-08-27.md) 的新变化；未修改业务代码、未运行测试、未提交 Issue、未发布内容、未对外联系。
> 证据标记：**Observed** = 本轮直接读取本地 Git/源码/文档或 GitHub 官方仓库、Release、Issue、Discussion；**Maintainer signal** = 官方 Release/Planned/修复 PR 等供应方信号；**Reported** = 报告者给出复现或数据但未获维护者确认；**Inference** = 面向当前项目的建议，不是已实现、已修复或生产接受事实。

## 1. 执行摘要

1. **今日优先级最高的变化来自直接宿主，而不是竞品。** DeepSeek Harness 在窗口内发布 [`dsh-v0.1.2-alpha.1`](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1)，相对 rc.2 ahead 1,079 commits；官方声明移除旧 ApiProxy、网络访问改为一次性 Token、增加 Settings 插件扩展位和 ACP 自动化控制、Headless 将进度写 stderr，并默认随 DeepSeek 请求发送启用插件包名/version。当前项目 CI 只 pin rc.8/rc.2，README/技术文档仍称 rc.2 为“最新”。P0 应先把口径改为“已验证至 rc.2；alpha.1 NOT RUN”，再做 pack/install、Host+Client、Settings、snapshot/mutation、Remote 鉴权负向和真实 Agent Run；不能把源码接口变化写成已确认不兼容。
2. **“启用成功”必须是调度定义和实际时钟同时可证明。** Activepieces [#15114](https://github.com/activepieces/activepieces/issues/15114) 证明 publish/enable 会先删旧 scheduler，再等待 ON_ENABLE；worker 超时后留下 `schedule=NULL`、无 Run、无错误，skipped hook 还会把用户的 2 分钟 cadence 静默改成默认 5 分钟。当前项目已把 schedule 内嵌在 Definition，校验后单次 `put` 再重排 pump，架构上没有独立 scheduler 可先删；P0 应守住这一单记录不变量并补 put/ack/pump/restart 故障注入，而不是新增 prepare/commit/rollback 或调度实体。
3. **超时不等于清理完成，外层预算必须覆盖内层 teardown。** Hermes [#96801](https://github.com/NousResearch/hermes-agent/issues/96801) 的 Gateway 只给 adapter 5 秒，但 Feishu disconnect 最长需 15 秒，取消可跳过 executor/线程/app lock 清理，现场计划重启到重连耗时 409.320 秒；Airflow [#72128](https://github.com/apache/airflow/issues/72128) 又显示 54 个 provider operator 只在 `on_kill` 清理，普通终态失败后外部 Job 继续耗费计算。P0 应加 cancellation-safe `finally`、预算不变量、外部 effect id/owner 和进程外 reconciliation。
4. **跨阶段编排最容易丢“已经解析过的真实上下文”。** Airflow [#72144](https://github.com/apache/airflow/issues/72144) 的 110 个 AWS defer site 中 61 个没有完整传递 region/SSL verify/botocore config；MAF [#7902](https://github.com/microsoft/agent-framework/issues/7902) 把 declarative `input.arguments` 计算后静默丢弃，[#7916](https://github.com/microsoft/agent-framework/issues/7916) 又让 MCP `_meta` 中的文件句柄在 hosted Responses 路径消失。当前项目应在现有 Run/Receipt 上保存脱敏 resolved context，并做 `Definition → Run → Agent input → Result Session → delivery` conformance。
5. **MCP 市场的首要缺口仍是可用性准入，不是目录体量。** Registry [#1579](https://github.com/modelcontextprotocol/registry/issues/1579) 在 25,125 个 distinct server 中发现 387 个 `active` 记录既无 remotes 也无 packages；Servers [#4702](https://github.com/modelcontextprotocol/servers/issues/4702) 核验 13 个旧 filesystem 版本在 zod v4 下几乎所有 tool schema 为空，严格客户端会在 `tools/list` 拒绝。P1 先做 transport/package、schema、版本/deprecation、connect/call/reconnect canary；大连接器市场继续 P2。

## 2. 当前项目与宿主增量边界

| 观察面 | 本轮 Observed | 能力/验证边界 | 新差距 |
|---|---|---|---|
| 当前项目 | 远端 `main@b0bb2db`、tree=`832a603`，与本地 `chore/dsh-rc2-compat@0920888` tree 一致；alpha.6 与 main CI 无变化 | 82/82、rc.8 Web/macOS Desktop、rc.2 install/activation 只沿用既有记录；本轮 NOT RUN，稳定版仍 NO-GO | README/技术文档的“最新 rc.2”已事实漂移；alpha.1 兼容与真实权限边界未验 |
| alpha.1 宿主 | [`dsh-v0.1.2-alpha.1`](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1) 于 2026-08-27T17:06:37Z 发布，tag `cd5ef814`；官方 [compare](https://github.com/deepseek-ai/deepseek-harness/compare/dsh-v0.1.1-rc.2...dsh-v0.1.2-alpha.1) ahead 1,079 commits | `settings.section` 和 generic `connection.rpc` 仍存在；未出现 `sidebar.primary.action` / `shell.page`，因此 UI 入口基线不变 | `HostConnectionRpc.handle` 从三参 authority 变为二参 authenticated channel；当前项目继续传第三参 `loopback`，JS 会忽略额外参数。这是接口/授权语义重验点，不是已确认漏洞或不兼容 |
| alpha.1 供应方能力 | Remote + 一次性 Token、Settings 插件扩展位、ACP automation controls、Headless stderr progress、插件包名/version 默认上送（可关闭） | 均是 Release 声明；当前项目未 pack/install/实机；默认插件元数据上送需安全/隐私确认 | CI 未覆盖 alpha.1；无 Host+Client、Settings、snapshot/mutation、remote-auth negative、stdout/stderr contract、真实 Agent Run |
| 公开用户证据 | alpha.1 发布后同日 Discussion [#4794](https://github.com/deepseek-ai/deepseek-harness/discussions/4794) 报 latest pull 后 Windows source build 缺 export，回复建议 `pnpm run clean`；[#4798](https://github.com/deepseek-ai/deepseek-harness/discussions/4798) 是 rc.2 的 preset 全局 tool 注册冲突 | #4794 不是已安装 alpha.1 包的 runtime 回归，且没有维护者复现/修复闭环；#4798 明确是 rc.2 | 截止窗口没有可据此断言 alpha.1 已不兼容的用户复测；需要本项目自行 observed acceptance |

### 2.1 已实现能力复核（本轮无代码增量）

| 能力面 | 当前源码已具备（Observed） | 本轮验证边界与仍缺 |
|---|---|---|
| 自动化任务 | 持久 Definition/Run/Command Receipt；创建、编辑、暂停、恢复、删除、立即运行、取消、mark-read；每次新建 Root Agent 与 Result Session | 既有 82/82 与实机记录未复跑；无结构化 Outcome/Attention |
| 插件体系 | DSH Host/Web Bundle、Cordis 生命周期；Settings 全局页与 Conversation fallback；Web/Agent Tools 共用 `snapshot/dispatch` | alpha.1 pack/install/激活 NOT RUN；无 per-Run Skill/MCP/version/effective capability snapshot |
| 编排/恢复 | `claim → setup → executing → settling → delivery`、lease/heartbeat、whole-job deadline、保守恢复、target/model preflight | 非协作阻塞、五阶段强杀、teardown 预算与外部 effect reconciliation 未实机 |
| 调度 | once/interval/daily/weekly/manual、IANA 时区与 DST、deterministic occurrence、latest-only misfire、防重叠；schedule 与 Definition 单记录持久 | 无 `expectedAt/overdueBy/lastProgressAt`；put/ack/pump/restart 故障矩阵不全；无事件 Trigger Adapter |
| 监控/通知 | Run history、phase、summary、结构化 error、unread、durable Receipt、read-after-write、Result Session 入口 | 无 structured Outcome、lifecycle event、逐目标 delivery receipt 与 dead-man 告警 |
| 权限 | read-only/workspace-write、approval=`never`、固定 unattended allowlist，拒绝递归 Automation、交互工具和后台进程 | alpha.1 authenticated channel 与原 `loopback` authority 的有效边界未验；无 effective actor/effect snapshot |
| 生态集成 | `settings.section`、generic `connection.rpc`、Workspace/Agent Preset/模型目录、Agent Tools；宿主新增 ACP 自动化能力 | ACP 是宿主已发布能力，不是当前项目已集成；无大连接器目录、通用 DAG 或 durable MCP Run |

## 3. 热度、发布与工程活动增量

Star/Fork 是 GitHub 官方仓库 HTML 的同源快照；主体仓库采样于 10:08—10:23 CST，核心框架快照约晚于事件窗口 2 分钟，故只作关注度区间，不伪装成精确截止值。Issue/Release 严格按上方事件窗口；commit 来自官方 Atom/API，`≥20` 表示 feed 截断下限，显示作者数只覆盖可见条目。Hermes Issue 高度机器化，数量不能当独立用户数。

| 定位 | 项目 | 当前热度及较昨日变化 | 窗口活动 | Release / 新需求信号 | 判断 |
|---|---|---:|---|---|---|
| 直接宿主 | [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) | 本轮不以 Star 排序；直接依赖权重大于外部热度 | alpha.1 相对 rc.2 ahead 1,079 commits；Issues 禁止创建，Discussion 可用 | [alpha.1](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1)；[#4794](https://github.com/deepseek-ai/deepseek-harness/discussions/4794) 为 source build 报告 | 唯一改变当前发布排序的新增；先兼容验收和权限重验 |
| 直接竞品 | [Hermes Agent](https://github.com/NousResearch/hermes-agent) | 237,357 Star / 48,116 Fork；`+436/+196` | 235 新 Issue；commit feed ≥20 / 9 显示作者 | stable [v0.20.6](https://github.com/NousResearch/hermes-agent/releases/tag/v2026.8.27) 汇总约 525 PR；[#96801](https://github.com/NousResearch/hermes-agent/issues/96801)、[#96793](https://github.com/NousResearch/hermes-agent/issues/96793)、[#96775](https://github.com/NousResearch/hermes-agent/issues/96775) | 工程活动和增长仍最高；只采用有时间线、代码路径或对照的报告 |
| 可集成平台 | [n8n](https://github.com/n8n-io/n8n) / [Dify](https://github.com/langgenius/dify) | 202,638 / 60,430，`+104/+20`；153,697 / 24,294，`+95/+22` | 5 / 18 新 Issue；commit feed ≥20（18 / 8 显示作者） | n8n prerelease [2.37.3](https://github.com/n8n-io/n8n/releases/tag/n8n%402.37.3) 修 runner image glibc/libatomic；[#37259](https://github.com/n8n-io/n8n/issues/37259) 手动执行无 Run/无错误；Dify [#41386](https://github.com/langgenius/dify/issues/41386) editor 反复 403 | n8n runner 报告从昨日 28 降至今日 5 个总 Issue，但无 stable/用户复测闭环；不撤销既有 P0，也不再升级 |
| Agent Workflow | [LangGraph](https://github.com/langchain-ai/langgraph) / [MAF](https://github.com/microsoft/agent-framework) | 40,571 / 6,837，`+64/+6`；13,159 / 2,233，`+23/+3` | 2 Issue/2 commit/1 Release；10 Issue/14 commit/1 Release，MAF Discussion 查询 0 | [LangGraph #8728](https://github.com/langchain-ai/langgraph/issues/8728) 参数名碰撞与空错误；[#8734](https://github.com/langchain-ai/langgraph/issues/8734) ghost namespace；[MAF #7902](https://github.com/microsoft/agent-framework/issues/7902)、[#7916](https://github.com/microsoft/agent-framework/issues/7916) 静默丢输入/附件元数据 | P1 conformance/错误透明度证据强；不引入通用 DAG |
| Agent SDK | [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) / [CrewAI](https://github.com/crewAIInc/crewAI) | 29,017 / 4,615，`+32/+10`；57,689 / 8,266，`+33/+6` | 1 Issue/8 commit/0 Release；1 Issue/4 commit/1 Release | Agents [#4705](https://github.com/openai/openai-agents-python/issues/4705) 是 Modal OIDC 窄场景；CrewAI [1.15.18](https://github.com/crewAIInc/crewAI/releases/tag/1.15.18) 修 task failure 记 success、空 final 丢 tool result、suppressed resume 仍发 lifecycle 等 | CrewAI Release 强化 Outcome/lifecycle，但仍是供应方修复声明 |
| 调度基建 | [Airflow](https://github.com/apache/airflow) / [Prefect](https://github.com/PrefectHQ/prefect) / [Temporal](https://github.com/temporalio/temporal) | 46,622 / 17,688，`+8/+4`；23,699 / 2,484，`+6/+1`；22,573 / 1,843，`+23/+4` | 4 / 5 / 1 新 Issue；commit ≥20/13、9/4、13/9 | [Airflow #72144](https://github.com/apache/airflow/issues/72144)、[#72128](https://github.com/apache/airflow/issues/72128)；[Prefect #22957](https://github.com/PrefectHQ/prefect/issues/22957) automation `event.url` 空；Temporal [#11822](https://github.com/temporalio/temporal/issues/11822) 新入口未复用 cron 校验 | 继续借鉴 phase handoff、cleanup、模板合同和共享校验；不移植分布式 Scheduler |
| 自动化生态 | [Activepieces](https://github.com/activepieces/activepieces) / [Windmill](https://github.com/windmill-labs/windmill) / [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | 24,066 / 4,108，`+15/+5`；17,704 / 1,085，`+16/0`；16,145 / 1,423，`+10/0` | 7 / 1 / 1 新 Issue；13/5、6/4、7/4 commit/作者 | [Activepieces #15114](https://github.com/activepieces/activepieces/issues/15114) 是窗口最强调度样本；Windmill [v1.798.1](https://github.com/windmill-labs/windmill/releases/tag/v1.798.1) 仅一项权限读取修复；Trigger.dev 无改序证据 | 先做原子 enable/可观测失败，不追连接器数量 |
| MCP 生态 | [MCP Servers](https://github.com/modelcontextprotocol/servers) / [Registry](https://github.com/modelcontextprotocol/registry) | 89,915 / 11,517，`+22/+4`；7,194 / 967，`+1/+1` | 1 / 3 新 Issue；窗口 commit 均 0；无新 Release | [Registry #1579](https://github.com/modelcontextprotocol/registry/issues/1579) 387 active 无 transport；[Servers #4702](https://github.com/modelcontextprotocol/servers/issues/4702) 13 个旧版本 schema 为空 | 强化准入、deprecation 与 live canary；大市场仍 P2 |

## 4. 今日新增需求与当前项目映射

### 4.1 P0：alpha.1 兼容与权限边界重验

**证据与用户价值：** alpha.1 把旧 ApiProxy 收敛到 Remote + 一次性 Token，补 Settings 扩展位、ACP 自动化和 Headless 输出合同；这些能力直接影响插件能否安装、展示、连接、自动运行以及网络访问是否仍受控。当前项目只验证到 rc.2，继续写“最新 rc.2”会让用户把“已测试”误解为“当前最新”。

**差距与最小动作（Inference）：** 先以 S 成本修正文档口径为“已验证至 rc.2；alpha.1 NOT RUN”；再以 M 成本在现有 CI/E2E 增加 alpha.1 pack/install、Host+Client、Settings section、snapshot/mutation、Remote one-time-token negative、Headless stdout/stderr、真实 Agent Run。`HostConnectionRpc.handle` 的三参到二参变化只列为授权语义审计点；验证 authenticated channel 的来源、错误路径和跨 profile 边界，不先改代码。

**影响/风险/前置：** 影响极高、P0。前置是取得 alpha.1 可安装资产和真实模型/Remote 环境；风险是把预发布变化写成稳定合同，或在没有失败证据时做兼容分支。插件包名/version 默认上送还需人工确认隐私口径、关闭开关和审计要求。

### 4.2 P0：守住 schedule 单记录原子性，并证明时钟已接管

**证据与用户价值：** Activepieces [#15114](https://github.com/activepieces/activepieces/issues/15114) 在 main `65f9687`、schedule piece 0.1.22 上复现：old scheduler 先删，ON_ENABLE 超时后持久 row 为 `schedule=NULL`，refill 既不在 boot 运行又跳过 NULL，用户只看到任务再也不跑；hook 被跳过时又会把 2 分钟 cadence 静默变成 5 分钟默认值。用户需要“继续按旧配置跑”或明确失败，而不是无 Run、无错误、错误频率。

**差距与最小动作（Inference）：** 当前实现已经先完成 schedule/model/preset 校验，再把 Definition 与 schedule 作为一个记录 `put`，随后才 `requestPump()`；不存在 Activepieces 式“先删旧 scheduler、后调用 worker”的第二状态源。缺口是这一优势尚无完整故障注入和 expected/effective 健康证据。补 `validation failure / storage put failure / commit ack lost / crash after put before pump / arm timer failure` 测试：失败写入不得改变旧 Definition/revision；已提交但回执丢失走现有 `unknown + read-after-write`；pump 失败必须保留新 Definition、进入 retry，并由 `expectedAt/overdueBy/lastProgressAt` 暴露。只有未来接外部 Trigger Adapter 时，才需要 prepare/commit/rollback。

**影响/风险/前置：** 影响极高、P0 验证项、成本 S-M。前置是确认 `put` 已提交但 pump 尚未接管时的 UI/告警语义；风险是为不存在的双状态源过度设计。未来接外部 Trigger 时才需要用 occurrence/idempotency 约束双注册短窗。

### 4.3 P0：所有 teardown 必须在预算内完成本地所有权释放

**证据与用户价值：** Hermes [#96801](https://github.com/NousResearch/hermes-agent/issues/96801) 给出 outer 5 秒、inner 最长 15 秒的确定矛盾，取消跳过 app lock/executor/thread 清理后计划重启耗时 409.320 秒；Airflow [#72128](https://github.com/apache/airflow/issues/72128) 区分“进程仍活着的终态失败”和 SIGKILL，指出 54 个外部 Job operator 在普通失败后不会收到清理回调。用户价值是停止、取消、升级、重启真正收敛，不留锁、孤儿进程或继续计费的外部任务。

**差距与最小动作（Inference）：** 在现有 Supervisor、whole-job timeout、lease/heartbeat 上增加预算不变量 `inner graceful + local finalize < outer cancel`；所有 release lock/close executor/persist dedup/recipient state 放入 cancellation-safe `finally` 且幂等。对进程不可合作或 SIGKILL，复用 Run/Receipt 保存 external effect id、owner、cleanup status，由恢复扫描做 reconcile，不新增通用 Job 表。

**影响/风险/前置：** 影响极高、P0、成本 M。前置是列清本项目持有的子进程、Session、连接、文件锁和 delivery ownership；风险是强制清理可能破坏仍应保留的外部任务，需按 Run terminal/retry policy 判断。

### 4.4 P1：resolved context 与 artifact handle 要端到端一致

**证据与用户价值：** Airflow [#72144](https://github.com/apache/airflow/issues/72144) 的 110 个 defer site 中 61 个缺 region/verify/botocore config，任务 defer 后静默换 endpoint、CA 或 retry 策略；MAF [#7902](https://github.com/microsoft/agent-framework/issues/7902) 无异常地把 declarative arguments 丢成空字符串；[#7916](https://github.com/microsoft/agent-framework/issues/7916) 在 direct MCP 能看到 container/file id，但 hosted Responses 丢 `_meta`，用户拿不到已生成文件。LangGraph [#8728](https://github.com/langchain-ai/langgraph/issues/8728) 还显示保留参数名碰撞后错误被过滤为空，模型不能自纠。

**差距与最小动作（Inference）：** 当前 target/model preflight、phase、Result Session 和 Receipt 已能承载第一版 conformance。保存脱敏 immutable resolved context：runId/revision、target/model、permission/effective actor、tool/MCP/version、timeouts、input identity；artifact 用 `{kind,id,name,sourceRunId}` 句柄透传，不把 blob 塞入新实体。测试 `Definition → Run → Agent input → tool result/meta → Result Session → UI/delivery`，缺字段或碰撞要 fail closed 并保留可操作错误。

**影响/风险/前置：** 影响高、P1、成本 M。前置是定义必保字段和脱敏/保留周期；风险是快照过大或含 secret，需白名单而非任意序列化。

### 4.5 P1：插件/MCP 准入先证明“可安装、可发现、可调用”

**证据与用户价值：** Registry [#1579](https://github.com/modelcontextprotocol/registry/issues/1579) 对 82,994 version record 去重后得到 25,125 distinct server，其中 387 个 `active` 无 remotes/packages；Servers [#4702](https://github.com/modelcontextprotocol/servers/issues/4702) 直接核验 13 个 `server-filesystem<=2025.8.21` 版本在 zod v4 下 10/11 或 13/14 tool schema 为空，用户会误以为是权限/sandbox 错。用户需要目录点击前就知道它是否有 transport、版本是否被弃用、schema 和调用是否真实可用。

**差距与最小动作（Inference）：** 复用固定 unattended allowlist、target preflight 和 Receipt，增加 manifest/registry 校验：至少一个 remote/package、版本/deprecation、`tools/list` 非空且 schema 可校验、connect/call/reconnect/liveness canary、effective actor/effect。失败进入 `blocked`，不自动换旧版本或放宽权限。不要先建大连接器目录、凭据中心或新审批流。

**影响/风险/前置：** 影响高、P1、成本 S-M。前置是选 2—3 个真实 MCP 做正负样本；风险是外部短暂故障导致误封，需区分 transient/invalid/deprecated 并允许显式重试。

## 5. 汇总映射与优先级

| 类别 | 项目或诉求 | 热度/需求信号 | 来源链接 | 当前能力与差距 | 建议改进或进化方向 | 影响/风险与前置 | 优先级 | 成本 | 可信度 |
|---|---|---|---|---|---|---|---|---|---|
| 宿主兼容/权限 | DSH alpha.1 | 直接依赖；ahead 1,079 commits；Release 改 Remote/Token/Settings/ACP/Headless | [Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1) · [compare](https://github.com/deepseek-ai/deepseek-harness/compare/dsh-v0.1.1-rc.2...dsh-v0.1.2-alpha.1) | CI 只到 rc.2；文档“最新”漂移；authority 语义未验 | 先改“已验证至 rc.2”；补 alpha.1 全链路与 auth negative | 极高；需 alpha.1 资产/真实环境；勿预判不兼容 | P0 | S+M | 高（变化）/未知（兼容） |
| 调度/健康 | enable 半提交、错误 cadence | main 复现；无 Run/无错误；默认 5min 替换用户 2min | [Activepieces #15114](https://github.com/activepieces/activepieces/issues/15114) | schedule 已与 Definition 单记录持久；缺 put/ack/pump/restart 故障矩阵和 expected/effective health | 守住单记录不变量；复用 unknown/read-after-write/retry；仅 future Trigger 做两阶段切换 | 极高；避免为不存在的双状态源过度设计 | P0 验证 | S-M | 高（代码路径）/中高（运行报告） |
| 取消/恢复 | outer timeout 早于 inner cleanup | Hermes 409.320s；Airflow 54 operator external job cleanup gap | [Hermes #96801](https://github.com/NousResearch/hermes-agent/issues/96801) · [Airflow #72128](https://github.com/apache/airflow/issues/72128) | 有 Supervisor/timeout/lease；资源所有权/进程外 reconcile 不全 | 预算不变量、cancellation-safe finally、external effect receipt | 极高；需列全资源和 retry policy | P0 | M | 中高 |
| 编排/context | deferral/agent/hosting 静默丢配置、输入、附件 | Airflow 61/110 site；MAF 最小无凭证复现和 MCP 对照 | [Airflow #72144](https://github.com/apache/airflow/issues/72144) · [MAF #7902](https://github.com/microsoft/agent-framework/issues/7902) · [#7916](https://github.com/microsoft/agent-framework/issues/7916) | 有 preflight/phase/Result Session；缺 immutable resolved snapshot/conformance | 白名单快照；artifact handle；全链路字段一致性 | 高；需脱敏与体积上限 | P1 | M | 高/中高 |
| 工具错误透明度 | 保留参数名误注入且空错误 | LangGraph 两版本/main 复现，根因行明确 | [#8728](https://github.com/langchain-ai/langgraph/issues/8728) | 固定工具集；尚无 reserved-name/schema collision matrix | preflight 检查参数冲突；错误不得被过滤成空 | 高；需避免暴露 secret | P1 | S | 高 |
| 插件/MCP 准入 | active 但不可达；旧版本 schema 空 | 387/25,125 无 transport；13 个发布版受影响 | [Registry #1579](https://github.com/modelcontextprotocol/registry/issues/1579) · [Servers #4702](https://github.com/modelcontextprotocol/servers/issues/4702) | allowlist/preflight 有；缺 transport/schema/deprecation/live canary | 复用 Receipt 做分层 admission；失败 blocked | 高；外部 transient 需可重试 | P1 | S-M | 高（审计）/中高（用户影响） |
| Outcome/通知 | failure/suppressed resume/event URL 与 lifecycle 不一致 | CrewAI 官方修复；Prefect 100% 空 URL 报告 | [CrewAI 1.15.18](https://github.com/crewAIInc/crewAI/releases/tag/1.15.18) · [Prefect #22957](https://github.com/PrefectHQ/prefect/issues/22957) | 有 summary/unread；无 typed outcome/lifecycle template contract | 结构化 Outcome/Attention；模板字段 snapshot + render test | 高；先定义 terminal 与 delivery 边界 | P1 | M | 高（Release）/中（报告） |
| 存储/清理 | 读操作制造 ghost namespace | 1,000 次 read 得 1,001 namespace；已有修复 PR | [LangGraph #8734](https://github.com/langchain-ai/langgraph/issues/8734) · [PR #8735](https://github.com/langchain-ai/langgraph/pull/8735) | 当前 Domain 基于真实 Definition/Run；legacy tombstone 仍 NOT RUN | 保持 read-only 查询无写；补 delete-last/read-miss invariant | 中；不要据此新增 namespace/entity | P1 | S | 高 |
| 今日未升级 | n8n runner incident | 新 Issue 总数从 28 降至 5；2.37.3 prerelease 修 runner image libs | [2.37.3](https://github.com/n8n-io/n8n/releases/tag/n8n%402.37.3) · [#37259](https://github.com/n8n-io/n8n/issues/37259) | 昨日 admission health P0 仍成立；没有 stable/用户复测闭环 | 保持昨日动作，不重复扩设计 | 高；不要以计数下降推断已修复 | P0 保持 | — | 中 |
| 暂缓 | durable DAG/HITL、多 Agent、分布式 Scheduler、大市场 | 供应方继续发布，但今日无当前项目需求闭环 | [Temporal](https://github.com/temporalio/temporal) · [MAF #7914](https://github.com/microsoft/agent-framework/issues/7914) | 本地定时自动化深度足够；稳定版/宿主兼容更急 | 继续观察，不追体量 | 成本 L-XL；会扩大状态/权限面 | P2 | L-XL | 中 |

## 6. 今日最值得推进的 Top 5

1. **P0：校正宿主支持口径并做 alpha.1 acceptance。** 先写清“已验证至 rc.2；alpha.1 NOT RUN”；再跑 pack/install、Host+Client、Settings、snapshot/mutation、Remote one-time-token negative、Headless stdout/stderr 和真实 Agent Run。
2. **P0：证明 schedule 单记录提交和时钟接管不变量。** 补 validation/put/ack/pump/restart 五类故障；失败写不动旧 Definition，歧义走现有 read-after-write，pump 失败进入 retry 并暴露 overdue。
3. **P0：验证 cancellation/teardown 预算与所有权释放。** 保证 inner cleanup 小于 outer timeout；锁、子进程、连接、Session、delivery owner 全部在 cancellation-safe finally，SIGKILL 后由 Receipt/recovery reconcile。
4. **P1：保存 resolved Run context 和 artifact handle。** 对 Definition→Run→Agent input→tool meta→Result Session→delivery 做字段 conformance，缺失/碰撞 fail closed 并给可操作错误。
5. **P1：补 MCP/插件准入负向矩阵。** 校验 transport/package、version/deprecation、tools/list schema、connect/call/reconnect/liveness；只选 2—3 个真实 MCP，暂不建大目录。

相较昨日：宿主 alpha.1 兼容/权限重验新进入 Top 1；Activepieces 的 enable 半提交强化了当前单记录 schedule 设计，并把缺口收敛为 `put/ack/pump/restart + expected health` 故障矩阵；Hermes/Airflow 将昨日的 timeout/fault-injection 具体化为 teardown 预算与外部 effect reconciliation。持久化 fail-closed、Outcome/Attention 仍保留；DAG、多 Agent、分布式 Scheduler、大市场、durable MCP/HITL 继续 P2。

## 7. 证据不足、访问受限与人工确认

1. **alpha.1 兼容没有实测。** Release、compare、tag 源码变化是 Observed；当前项目 pack/install、Web/Desktop、Remote、真实 Agent Run 全部 NOT RUN。额外第三参在 JS 中被忽略，不等于 authority 被绕过；authenticated channel 的建立与校验需动态验证。
2. **alpha.1 公开回归证据不足。** Discussion #4794 精确创建于 2026-08-27T18:32:18Z，晚于 Release，但描述 latest source pull/build，回复只建议 clean；不能当 packaged alpha.1 runtime 回归。#4798 精确创建于 19:48:41Z，但明确版本是 rc.2。截止窗口没有 alpha.1 安装后 Settings/Remote/ACP/automation 的用户复测。
3. **X 受访问限制。** 精确窗口检索 `DeepSeek Harness + plugin/Remote/ACP/automation`、`n8n/Dify/Hermes + scheduler/runner`、`MCP + registry/workflow`，没有返回可直接核验的 X 原帖，只返回 X 官方旧内容或无关页面；未采用搜索摘要、互动量或窗口外帖子。这不等于 X 上没有讨论。
4. **Discussions 边界。** DeepSeek Harness 与 MAF 可查询；LangGraph、Agents SDK、Temporal、CrewAI 未启用 Discussions，不能写成“0”。其它仓库没有发现会改变排序的新 Discussion，但跨仓搜索无法证明不存在。
5. **Release 不是用户接受。** Hermes 0.20.6、n8n 2.37.3、CrewAI 1.15.18、LangGraph SDK 0.4.4、MAF Python 1.16.0、Windmill 1.798.1 和 Temporal 版本化构建均为供应方发布；本轮没有安装或用户回读。n8n 2.37.3 还是 prerelease，不能据 runner image 修复推断昨日 incident 已闭环。
6. **Issue/热度边界。** Hermes 的 235 个 Issue 含大量 sweeper/duplicate；Issue 数不是独立用户数。Star/Fork 快照略晚于精确事件截止，只能作约 24 小时同源关注度变化，不代表部署量或满意度。
7. **上游报告边界。** Activepieces、Hermes、Airflow、Prefect、MAF、LangGraph 的复现主要由报告者提供；部分 Issue 虽有修复 PR/Planned/代码审计，仍未做本地复现。本文只采纳可观察行为、最小复现、对照和源码路径，不把报告者根因写成维护者结论。
8. **需要人工确认。** 一是 alpha.1 默认上送插件包名/version 的隐私和关闭口径；二是 enable 失败是否继续旧 schedule；三是取消后哪些外部任务应保留到 retry；四是 resolved context/artifact metadata 的白名单和保留期；五是 MCP transient failure 的重试/隔离阈值。

## 8. 一手证据索引

- 宿主：[DSH alpha.1](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1) · [rc.2…alpha.1 compare](https://github.com/deepseek-ai/deepseek-harness/compare/dsh-v0.1.1-rc.2...dsh-v0.1.2-alpha.1) · [Discussion #4794](https://github.com/deepseek-ai/deepseek-harness/discussions/4794) · [#4798](https://github.com/deepseek-ai/deepseek-harness/discussions/4798)。
- 调度/清理：[Activepieces #15114](https://github.com/activepieces/activepieces/issues/15114) · [Hermes #96801](https://github.com/NousResearch/hermes-agent/issues/96801) · [#96793](https://github.com/NousResearch/hermes-agent/issues/96793) · [#96775](https://github.com/NousResearch/hermes-agent/issues/96775) · [Airflow #72128](https://github.com/apache/airflow/issues/72128) · [#72144](https://github.com/apache/airflow/issues/72144)。
- 编排/结果：[MAF #7902](https://github.com/microsoft/agent-framework/issues/7902) · [#7916](https://github.com/microsoft/agent-framework/issues/7916) · [LangGraph #8728](https://github.com/langchain-ai/langgraph/issues/8728) · [#8734](https://github.com/langchain-ai/langgraph/issues/8734) · [CrewAI 1.15.18](https://github.com/crewAIInc/crewAI/releases/tag/1.15.18) · [Prefect #22957](https://github.com/PrefectHQ/prefect/issues/22957)。
- MCP 生态：[Registry #1579](https://github.com/modelcontextprotocol/registry/issues/1579) · [Servers #4702](https://github.com/modelcontextprotocol/servers/issues/4702) · [MCP Registry](https://github.com/modelcontextprotocol/registry) · [MCP Servers](https://github.com/modelcontextprotocol/servers)。

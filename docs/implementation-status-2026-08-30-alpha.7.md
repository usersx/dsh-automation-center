# Alpha.7 日报改进项实施审计（2026-08-30）

本文把 2026-08-23 至 2026-08-29 的自动化生态日报逐项映射到当前实现。状态只使用 **Completed / Tested / Partial / Deferred / NOT RUN**；不把建议、源码存在或供应方 Release 当成验收完成。

| 日报主题 | 当前实现 | 证据 | 状态 |
|---|---|---|---|
| 最新 DSH 兼容与授权语义 | CI 增加 rc.8、rc.2、alpha.1；Schemastery 成为显式 runtime dependency；RPC 同时兼容旧 Loopback authority 与 alpha.1 Token channel | `ci.yml`；alpha.1 源码全量 build；最终 tgz 全新 Profile 安装、Host/Client 与 Chrome | Tested |
| legacy delete → reopen 复活 | committed/unknown delete Receipt 作为 re-import tombstone | `a committed legacy delete remains deleted after the service reopens` | Completed |
| expected-vs-actual/dead-man health | 从 Definition/Run 派生 expected/admitted/claimed/queueWait/lastProgress/overdue/stalled，不新增 Health 表 | overdue、queued-stalled、admission 单测 | Completed |
| schedule 单记录与时钟接管 | schedule 继续内嵌 Definition；validation/Receipt/read-after-write 与 retry 保持单一真源 | revision/unknown/restart/clock 测试 | Completed |
| 结构化 Outcome/Attention | scoped `automation_report_outcome` 工具；`no_change/changes_ready/needs_input/blocked/partial/succeeded`；未报告则 unknown Attention | executor + client overview 测试 | Completed |
| 持久化 fail-closed / ack 丢失 | mutation 先写 unknown Receipt，再写 terminal；Client unknown 后读权威快照；Run terminal 写失败不发布成功 | Receipt、read-after-write、persistence_error 测试 | Completed |
| 非协作 timeout / teardown | whole-job deadline + 独立 teardown grace；不收敛则 cleanupIncomplete/effect unknown | non-cooperative executor 测试 | Completed（同步 event-loop freeze 仍需进程外 Host 保护） |
| attempt 与副作用对账 | Run 持久 attempt/effect；安全 pre-side-effect recovery 才自动重试；副作用不确定时中断并 Attention | safe retry / interrupted recovery 测试 | Completed（无稳定 external effect id 时保持 unknown） |
| lifecycle + 本地通知 | runId/revision/sequence 生命周期事件；UI/Sidebar Attention；已有浏览器通知权限时发送本地通知，不主动索取权限 | lifecycle sequence 测试；Chrome UI | Completed |
| effective actor/capability | 持久 actor、permission、preset、approval policy、有效工具；模型可见工具集按 unattended allowlist 裁剪 | strict MCP/management tool 从 schema 隐藏测试 | Completed |
| Result Session 可见与 scope | direct Session attach 源 Workspace；worktree Session 保留隔离 cwd 并真实处于未分组；Run 保留源 Workspace/provenance/直达链接；打开成功后 mark-read；跨 Workspace mutation 拒绝 | executor/service/client 测试；最终 tgz alpha.1 Chrome direct/worktree readback；Desktop 2.0.3 真实模型 Result Session | Tested |
| migration dry-run / tombstone | 全量转换与 conflict 在首个目标写之前验证；输出 count/hash；不可读时不执行后续写 | conflict-before-write 测试 | Completed |
| Git worktree Review | workspace-write only；clean base；detached worktree；patch hash/stat；accept/keep/discard；HEAD/dirty drift fail closed | review module与 service 纵切测试 | Completed |
| MCP package/schema/OAuth/live canary | 当前产品没有可配置 MCP Adapter；未知 MCP 工具不再暴露给无人值守 Agent | effective tool restriction 测试 | Deferred：等 Adapter 进入产品后复用 admission/Receipt，不提前新建凭据/连接器实体 |
| 事件 Trigger Adapter | 当前只支持 time/manual；日报要求 future adapter 保留 event id/watermark/idempotency | 无运行实现 | Deferred P2：没有当前用户闭环，避免新增 Trigger 状态流 |
| durable in-run HITL/MCP Run | 当前显式 `needs_input` 结束本 Run，后续由新 Run 继续 | Outcome 契约 | Deferred P2：日报持续建议暂缓 |
| 通用 DAG、多 Agent、分布式 Scheduler、大连接器市场、云 sandbox | 未实现 | 日报 08-23—08-29 均列为暂不投入 | Deferred P2：不属于本地 Automation Center 当前发布目标 |
| Windows/Linux Desktop 实机 | CI 在两 OS 执行质量门；无两台原生桌面环境 | GitHub Actions（发布前） | NOT RUN（不能用 CI 冒充 GUI E2E） |

## 发布前剩余硬门槛

1. 推送分支并等待三平台 CI + 三个 DSH tag 安装矩阵。
2. 合入 `main`，创建 GitHub prerelease，回读 tarball/checksum/SBOM/attestation；npm 仅在 Trusted Publisher 成功时记为完成。
3. 稳定版前另做 Desktop 卸载/恢复、真实进程强杀以及 Windows/Linux 原生 GUI；这些不阻塞 Alpha.7 prerelease。

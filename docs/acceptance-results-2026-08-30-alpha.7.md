# DSH Automation Center Alpha.7 验收结果（2026-08-30）

## 当前结论

- **源码质量门：PASS。** Node.js 24.20.0 下 typecheck、build、96/96 tests、repository check 与 `git diff --check` 通过。
- **DSH `0.1.2-alpha.1` 最终制品 Web E2E：PASS。** `0.1.0-alpha.7` 最终 tgz 的全新 Profile 安装、Host/Client、一次性 Token、Settings、direct/worktree Definition、Run Now、失败终态、Result Session、Attention readback、review keep 与 console 均已观察。
- **macOS Desktop：PASS。** DSH Desktop 2.0.3（内置 DSH `0.1.1-rc.2`）的 desktop Profile 升级到 Alpha.7 后，真实模型 Run、结构化 Outcome、Result Session 与三次冷启动回读均通过。
- **GitHub/npm Release：NOT RUN。** 尚未推送、合并或创建 Release。
- **稳定版：NO-GO。** Alpha.7 仍是 prerelease；Windows/Linux Desktop GUI、卸载与强杀矩阵未全部完成。

## 已观察的 alpha.1 Web 链路

| 场景 | 状态 | 证据 |
|---|---|---|
| 官方 revision | PASS | `dsh-v0.1.2-alpha.1` / `cd5ef8148158c3a752a658978873241fdf8e2bbc` |
| DSH 源码完整构建 | PASS | Node 24 + pnpm 11.7.0，Host/Client/Web frontend build 完成 |
| 最终插件 Profile 安装 | PASS | 文档冻结后最终 tgz `0f46fd0cbbd3140237b132bf2ee7a9095813055f21857d5ffc75c90fd84362b5`；显式 `@deepseek-ai/schemastery@3.18.1` 后依赖闭包进入全新隔离 Web Profile |
| Host/Client 激活 | PASS | Token URL 打开 DSH，Settings 导航出现“自动化” |
| 无 Workspace 空状态 | PASS | 0 Workspace 时创建按钮禁用，页面无 console error/warning |
| Workspace + 创建 Definition | PASS | 1 Workspace；`Alpha.7 Direct Final` 与 `Alpha.7 Worktree Final` 均从 UI 创建成功；worktree 自动切换为 workspace-write |
| Run Now / terminal | PASS（失败路径） | 两种模式都从 queued 进入 failed，保留 `MISSING_CREDENTIAL` 与 effective model；无凭据不伪装成功 |
| Direct Result Session | PASS | Session 标题等于任务名，位于目标 Workspace，失败内容可见 |
| Worktree Result Session | PASS | Session 标题等于任务名，真实位于“未分组”；不再强挂源 Workspace，Run 仍保留源 Workspace 身份与直达链接 |
| Git Review | PASS（无变更路径） | UI 显示 `No changes` 与 accept/keep/discard；keep 后持久状态为 `kept` |
| Attention readback | PASS | 打开 Session 后 Run 保留，Attention 从 1 清零 |
| Console | PASS | 上述最终页面 warning/error 列表为空 |
| 最终字节激活 | PASS | 文档冻结后 tgz 再装入第二个全新 alpha.1 Profile；Chrome 中 Settings → Automation 空状态可见，console 日志为空 |

## 已观察的 macOS Desktop 链路

| 场景 | 状态 | 证据 |
|---|---|---|
| Desktop 宿主 | PASS | DSH Desktop `2.0.3`，内置 `@deepseek-ai/dsh@0.1.1-rc.2` |
| Profile 升级 | PASS | `~/.dsh/profiles/desktop` 从 Alpha.6 tgz 升级到文档冻结后的最终 Alpha.7 tgz，安装包回读为 `0.1.0-alpha.7`，Profile spec 指向最终 tgz |
| Automation Center 激活 | PASS | 真实 Desktop Settings 出现“自动化”，保留既有 Definition/Run 历史 |
| 真实模型 Run | PASS | 升级后的 Alpha.7 插件执行 `deepseek-official/deepseek-v4-flash · high`，5 秒进入 completed |
| Structured Outcome | PASS | Session 轨迹显示 `automation_report_outcome · succeeded`，最终输出 `ALPHA6 DESKTOP E2E PASS` |
| Result Session | PASS | 最新 Session `dsh-auto…1e67` 可从 Run 打开，标题、步骤、模型、终态与输出可见 |
| 三次冷启动 | PASS | 每次完整退出并重新启动 Desktop 后，最新 Result Session 与最终输出均可回读；切换到文档冻结后的最终 tgz 后又完成一次启动回读 |

本轮复用了历史命名为 `Alpha.6 Desktop E2E 2026-08-23` 的已暂停 Definition；新 Run 发生在 Profile 已回读为 Alpha.7 之后。保留这个名称是为了验证升级不破坏既有定义，而不是把历史 Alpha.6 结果冒充本次结果。

## 本轮自动化覆盖

- legacy delete tombstone 与迁移 dry-run/conflict。
- expected/admitted/claimed/queue/stall/overdue health。
- structured Outcome/Attention、attempt/effect、bounded teardown。
- lifecycle identity/revision/sequence、effective actor/capability。
- model-visible unattended tool restriction。
- Result Session Workspace attach/readback。
- Git worktree Review prepare/collect/accept/keep/discard 与 source drift fail closed。

## 尚未执行，不能宣传为通过

- Windows/Linux 原生 Desktop GUI。
- 运行中卸载、五个 Supervisor phase 的真实进程强杀、真实系统 permission denial。
- path-prefix reverse proxy 与 inventory `REQUEST_EXTENSION` 故障注入的真实页面闭环。
- GitHub Release workflow、制品 attestation、npm Trusted Publisher 与 registry readback。

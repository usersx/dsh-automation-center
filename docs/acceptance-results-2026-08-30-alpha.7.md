# DSH Automation Center Alpha.7 验收结果（2026-08-30）

## 当前结论

- **源码质量门：PASS。** Node.js 24.20.0 下 typecheck、build、95/95 tests、repository check 通过。
- **DSH `0.1.2-alpha.1` 中间制品 Web E2E：PASS。** 安装、Host/Client、一次性 Token、Settings、Definition create、Run Now、失败终态、Result Session、Attention readback、console 均已观察。
- **Alpha.7 最终制品与 Desktop：NOT RUN。** 版本/文档/worktree Review 合入后必须重打包复验；macOS Desktop 2.0.3 仍停在首次设置向导。
- **GitHub/npm Release：NOT RUN。** 尚未推送、合并或创建 Release。
- **稳定版：NO-GO。** Alpha.7 仍是 prerelease；Windows/Linux Desktop GUI、最终 Desktop 成功模型 Run、卸载与强杀矩阵未全部完成。

## 已观察的 alpha.1 Web 链路

| 场景 | 状态 | 证据 |
|---|---|---|
| 官方 revision | PASS | `dsh-v0.1.2-alpha.1` / `cd5ef8148158c3a752a658978873241fdf8e2bbc` |
| DSH 源码完整构建 | PASS | Node 24 + pnpm 11.7.0，Host/Client/Web frontend build 完成 |
| 插件 Profile 安装 | PASS | 显式 `@deepseek-ai/schemastery@3.18.1` 后依赖闭包进入隔离 Web Profile |
| Host/Client 激活 | PASS | Token URL 打开 DSH，Settings 导航出现“自动化” |
| 无 Workspace 空状态 | PASS | 0 Workspace 时创建按钮禁用，页面无 console error/warning |
| Workspace + 创建 Definition | PASS | 1 Workspace，`Alpha.7 Web E2E` Definition 创建成功 |
| Run Now / terminal | PASS（失败路径） | 缺凭据时 Run 从 queued 进入 failed，保留 `MISSING_CREDENTIAL` 与 effective model |
| Result Session | PASS | Session 标题等于任务名，位于目标 Workspace，失败内容可见 |
| Attention readback | PASS | 打开 Session 后 Run 保留，Attention 从 1 清零 |
| Console | PASS | 上述最终页面 warning/error 列表为空 |

## 本轮自动化覆盖

- legacy delete tombstone 与迁移 dry-run/conflict。
- expected/admitted/claimed/queue/stall/overdue health。
- structured Outcome/Attention、attempt/effect、bounded teardown。
- lifecycle identity/revision/sequence、effective actor/capability。
- model-visible unattended tool restriction。
- Result Session Workspace attach/readback。
- Git worktree Review prepare/collect/accept/keep/discard 与 source drift fail closed。

## 尚未执行，不能宣传为通过

- `0.1.0-alpha.7` 最终 tgz 在 alpha.1 的重新安装与 Web E2E。
- macOS Desktop 2.0.3 首次设置、alpha.7 安装、真实模型成功 Run、三次冷启动。
- Windows/Linux 原生 Desktop GUI。
- 运行中卸载、五个 Supervisor phase 的真实进程强杀、真实系统 permission denial。
- path-prefix reverse proxy 与 inventory `REQUEST_EXTENSION` 故障注入的真实页面闭环。
- GitHub Release workflow、制品 attestation、npm Trusted Publisher 与 registry readback。

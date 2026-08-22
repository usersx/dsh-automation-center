# DSH Automation Center Alpha.6 验收结果（2026-08-23）

## 结论

`dsh-automation-center@0.1.0-alpha.6` 的源码、构建、npm 制品和原版 DSH rc.8 隔离 Profile 安装检查均通过，达到 **合并 feature PR** 的工程门禁；新增 Settings 全局页、模型策略、Supervisor 和写入 Receipt 已有自动化覆盖。

本轮没有完成 rc.8 Web 浏览器与 macOS Desktop 的完整人工 UI 流程，因此结论是：

- **Alpha.6 工程合并：GO**。
- **Alpha.6 npm/GitHub 预发布：等待合并后 CI 和 release workflow**。
- **稳定版：NO-GO**。自动化通过不等于实机观察通过，也不等于安全审计通过。

## 固定证据

| 项目 | 结果 |
|---|---|
| Git 分支 | `feat/alpha-6-trusted-runtime` |
| 版本 | `0.1.0-alpha.6` |
| DSH 目标 | 未修改的 `dsh-v0.1.0-rc.8` |
| 类型检查 / 构建 / 测试 / 仓库检查 | PASS；`pnpm check`，81 / 81 测试通过 |
| npm 制品 | `dsh-automation-center-0.1.0-alpha.6.tgz`；30 个文件；246,687 bytes |
| SHA-256 | `b820d848d8ce90f253f5b2cdd2f958cc062f6a94213e8eb7cf693e1c3efa108d` |
| 隔离 Profile 安装 | PASS；本地 `.tgz` 进入唯一 `dsh-automation-center` Bundle row |
| Client manifest | PASS；同时声明 `@deepseek-ai/dsh-client-ui-settings` 与 `@deepseek-ai/dsh-client-ui-conversation` |

本地验证使用 Node `23.11.1`，不在 DSH 声明的支持范围；公开 CI 固定 Node `22.19.0`，其结果是合并与发布的必要证据。本地 pnpm 尝试读取内部 registry 元数据时出现非致命 fetch warning，但本地制品安装、文件落盘和 `--dump-config` 均成功；这不能替代公开 CI 的干净网络环境。

## Alpha.6 自动化覆盖

| 能力 | 状态 | 证据范围 |
|---|---|---|
| Stock Settings Surface | PASS（自动化） | 原版形状注册 `settings.section`，无 Session 仍可承载 Center；Conversation 快捷入口保留 |
| 增强 Shell Surface | PASS（自动化） | 同时注册 Settings、`shell.page` 和 `sidebar.primary.action` |
| Model Policy | PASS（自动化） | inherit/pinned provider/model/reasoning；保存校验；Run requested/effective model |
| Target preflight | PASS（自动化） | Workspace、Preset、model 不可用时在 Result Session 创建前进入结构化 blocked/failed |
| Supervisor | PASS（自动化） | `claim/setup/executing/settling/delivery`、lease、heartbeat、副作用边界和终态清理 |
| Whole-job timeout | PASS（自动化） | 模型预检阻塞时也由 deadline 收敛为 `run_timeout`，且不创建 Session |
| Host recovery | PASS（自动化） | 未越过副作用边界的 Run 可重新排队；可能产生副作用的 Run 标记 `host_interrupted` 且不重放 |
| Durable receipts | PASS（自动化） | mutation request ID、revision、replay、`committed/rejected/unknown`；重复 run-now 只生成一个 Run |
| Read-after-write | PASS（自动化） | committed 后强制刷新；unknown 后先尝试读取权威快照再提示不确定性 |
| Agent Tools | PASS（自动化） | 模型字段和 Web 使用同一 dispatch 边界；Agent 身份/Workspace 作用域保持不变 |
| 原版 rc.8 安装 | PASS（CLI） | `.tgz` 安装、Host Bundle composition 和 Client manifest 文件检查 |

## 未执行，不能算通过

- rc.8 Web 浏览器中从 Settings 打开 Automation Center、无 Session/无 Workspace、新建/编辑固定模型、blocked 状态和运行阶段的完整截图流程。
- rc.8 macOS Desktop 冷启动三次、Settings 页面、深色/窄窗口和完整创建/运行流程。
- 运行中卸载、页面打开时卸载、Host 在每个 Supervisor 阶段被强制终止。
- 实机模型不可用、权限拒绝、whole-job timeout 和旧插件冲突画面。
- Windows / Linux 原生 Desktop。

Alpha.5 的既有 rc.8 Web 实机基线见[上一版验收记录](acceptance-results-2026-08-20.md)。Alpha.6 不继承未重新执行的观察结论；这里只把自动化、CLI 安装和旧版实机证据明确分开。

## 发布后检查

合并后仍需：

1. 等待 PR 与 `main` 的全部 GitHub Actions 通过。
2. 创建 `v0.1.0-alpha.6` 预发布，由 Trusted Publishing 发布 npm provenance、SBOM、SHA-256 与构建证明。
3. 用 npm 固定版本重新安装到空 Profile，并核对 registry tarball 的 integrity。
4. 完成上面的 Web/Desktop 未执行矩阵，再更新本记录；未执行项不得改写为 PASS。

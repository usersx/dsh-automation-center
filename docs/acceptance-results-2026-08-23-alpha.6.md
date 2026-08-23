# DSH Automation Center Alpha.6 验收结果（2026-08-23）

## 结论

`dsh-automation-center@0.1.0-alpha.6` 已在未修改的 DeepSeek Harness rc.8 Web 和 macOS DSH Desktop 2.0.1 上完成核心端到端流程，结论为：

- **Alpha.6 npm/GitHub 预发布：GO**。
- **稳定版：仍为 NO-GO**。Windows/Linux Desktop、运行中卸载和逐阶段进程强杀仍未实机覆盖；兼容性验收也不等于安全审计。

本轮实机验收发现 Settings 内容槽只有约 550 px、而浏览器视口仍为 1280 px 时，旧媒体查询会错误保留双栏布局，导致编辑操作不可见。现已改为同时响应 Automation Center 自身容器宽度，并增加回归测试；修复后重新执行创建、编辑、运行和结果 Session 全链路通过。

## 固定环境

| 项目 | 结果 |
|---|---|
| Git 分支 | `release/alpha-6-e2e` |
| 插件版本 | `0.1.0-alpha.6` |
| DSH Web | 未修改的 `dsh-v0.1.0-rc.8`，commit `141eb6fef8` |
| Desktop | macOS DSH Desktop `2.0.1` |
| 浏览器 / 主题 | Chromium；原版 DSH 浅色和深色主题 |
| 类型检查 / 构建 / 测试 / 仓库检查 | PASS；`pnpm check`，82 / 82 测试通过 |
| npm 制品 | 30 个文件；246,953 bytes；SHA-256 `320ab44dc25f628f646d158984e2525d0a141b63e934c7dc6f4f9972edffcc59` |
| Profile 安装 | PASS；Web 隔离 Profile 与真实 Desktop Profile 均只有一个 `dsh-automation-center` Bundle row |
| 旧插件冲突 | Desktop Profile 未安装 `@dsh-external/dsh-automation`；现有 Better Sidebar、皮肤、Prompt Enhancer 和插件市场同时启用，冷启动通过 |

## Web rc.8 端到端

| 场景 | 状态 | 观察证据 |
|---|---|---|
| 原版 rc.8 安装 | PASS | 本地 `.tgz` 安装到独立临时 Profile；不需要 Shell Page Patch |
| 无 Session / 无 Workspace | PASS | Settings 中可打开 Automation；已注册 0 个 Workspace 时“新建自动化”明确禁用 |
| 新建固定模型任务 | PASS | 保存 Workspace、名称、指令、日程、时区、Preset、只读权限、超时和固定 provider/model |
| 手动运行 | PASS | Run 从排队进入完成；确定性测试 Provider 返回 `ALPHA6 E2E PASS` |
| 结果 Session | PASS | 新建独立 Session；标题等于自动化名称，消息中显示精确结果 |
| 暂停 / 恢复 | PASS | revision 从 v1 更新到 v2、v3，状态与动作同步刷新 |
| 编辑后重跑 | PASS | 名称更新并保存为 v4；下一次 Result Session 使用新名称，旧 Session 标题保持不变 |
| Host 重启恢复 | PASS | 定义、历史 Run 和 Result Session 在优雅重启后保留 |
| 模型不可用 | PASS | 移除测试 Provider 后显示结构化“已阻塞”，给出不可用 provider/model，Run Now 被禁用且不创建 Session |
| Settings 窄容器 | PASS（发现并修复） | 约 550 px Settings 槽正确切换单栏，编辑按钮可见且可操作；新增 container-query 回归测试 |
| 浅色 / 深色 | PASS | 使用原版 DeepSeek 主题检查列表、表单、按钮和错误态，无鲸鱼娘皮肤干扰 |
| 浏览器错误 | PASS | 最终成功流程浏览器 console 为空，无 page error 或渲染崩溃 |

## macOS Desktop 2.0.1 端到端

| 场景 | 状态 | 观察证据 |
|---|---|---|
| 真实 Desktop Profile 安装 | PASS | `dsh plugin --profile desktop add <alpha.6.tgz>` 成功；安装后的 Client bundle SHA 与仓库构建一致 |
| 原生设置入口 | PASS | Desktop 冷启动后在“设置 > 自动化”打开全局 Automation Center，无需进入某个 Session |
| 创建任务 | PASS | 在 `deepseek-harness` Workspace 创建只读任务 `Alpha.6 Desktop E2E 2026-08-23` |
| 真实模型执行 | PASS | 跟随全局 `deepseek-official/deepseek-v4-flash`，Run 完成为 `ALPHA6 DESKTOP E2E PASS` |
| 结果 Session | PASS | 自动打开/定位独立结果 Session；窗口标题与 Session 标题均为任务名，结果文本一致 |
| 三次冷启动 | PASS | 三次完全退出并重新打开均无闪退；任务、运行记录和 Result Session 跨重启保留 |
| 共存插件 | PASS | Better Sidebar 0.12.1、Maid Atelier、Prompt Enhancer 和 dshmarket 同时启用时完成上述流程 |
| 验收任务收尾 | PASS | 实机 Run 成功后将测试自动化暂停到 v2，避免后续定时触发；结果 Session 保留为审计证据 |

## 自动化与协议覆盖

| 能力 | 状态 | 证据范围 |
|---|---|---|
| Stock Settings Surface | PASS | 原版 `settings.section`，无 Session 仍可承载 Center；Conversation 快捷入口保留 |
| 增强 Shell Surface | PASS | 同时注册 Settings、`shell.page` 和 `sidebar.primary.action`，能力缺失时自动回退 |
| Model Policy / preflight | PASS | inherit/pinned provider/model/reasoning；Workspace、Preset、model 缺失时结构化 blocked/failed |
| Supervisor / timeout / recovery | PASS | phases、lease、heartbeat、whole-job deadline、副作用边界和保守恢复均有自动化覆盖 |
| Durable receipts | PASS | request ID、revision、replay、`committed/rejected/unknown`；重复 run-now 只生成一个 Run |
| Read-after-write | PASS | committed 后权威刷新；unknown 后先读取权威快照再显示不确定性 |
| Agent Tools | PASS | Web 与工具使用同一 dispatch 边界；Agent 身份和 Workspace 作用域不变 |

## 发布证据

发布完成后在本节补充：

- GitHub Release、release workflow 运行链接与资产列表。
- npm registry 的固定版本、integrity、shasum、tarball URL 和 provenance。
- 从公开 npm 将 `dsh-automation-center@0.1.0-alpha.6` 安装到全新 rc.8 Profile 的结果。

## 未执行，不能算通过

- Windows / Linux 原生 Desktop。
- 运行中卸载、页面打开时卸载，以及在 Supervisor 每个阶段分别强制终止 Host 的全部实机画面。
- 真实系统权限弹窗中的人工拒绝、真实模型超时（协议层权限/超时已有自动化测试）。
- 与已启用的旧 `@dsh-external/dsh-automation` 同时运行；当前建议先禁用旧插件，避免两个调度器并存。

这些缺口不阻塞 Alpha.6 预发布，但任何未执行项都不能作为稳定版已通过宣传。

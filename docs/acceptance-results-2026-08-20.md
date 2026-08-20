# DSH Automation Center Alpha 验收结果（2026-08-20）

## 结论

`dsh-automation-center@0.1.0-alpha.5` 已达到 **原版 DSH rc.8 / Web 可直接安装**的 Alpha 发布标准：不修改 DSH 源码、不要求 Shell Page Patch，插件会使用原版公开的 `conversation.view` 扩展点；若目标 DSH 提供两个通用 Shell Slot，同一个包自动升级为全局中心模式。

- 插件源码测试：**69 / 69 通过**。
- 原版 DSH：`dsh-v0.1.0-rc.8`，提交 `141eb6fef83422698aef7a981029e843e8161534`，工作树干净。
- 隔离安装制品：`238925` bytes，SHA-256 `86d8fedf027f047c85f5ddccb2c86b8fefdbc64a8b0d28c7c65f2e36c4383e1e`。
- 原版 rc.8 Web 实机：安装、启动、会话标签、创建、持久化、立即运行、模型凭证缺失、结果 Session 命名、深色主题和 Host 异常退出恢复均已观察通过。
- 稳定版结论：**NOT PASSED**。rc.8 Desktop、运行中卸载、极窄原生窗口和部分破坏性场景仍未完成实机验收。

这份结果只说明下列兼容性和功能范围，不等于安全审计通过。

## 已测环境

| 项目 | 值 |
|---|---|
| DSH | 未修改的 `0.1.0-rc.8`；无 Shell Page Patch |
| Profile | 独立 `DSH_HOME` 下的 `web` Profile |
| Surface | 原版 `conversation.view` 兼容模式 |
| Theme | rc.8 原版 DeepSeek 官方浅色、深色皮肤 |
| 插件 | `dsh-automation-center@0.1.0-alpha.5` 本地 `.tgz` |
| Node / pnpm | 本地 Node `23.11.1`、pnpm `10.32.1`；Node 版本不在 DSH 支持范围，CI 固定 `22.19.0` |
| Workspace | `/private/tmp` 下的隔离空目录；无用户项目、凭证或 Home 写入 |

为让浏览器自动化能够操作目录选择器，测试 Profile 仅把 DSH 自带的 `directory-picker-auto` 切换为 DSH 自带的 `directory-picker-browse`。这不是 Shell Patch，也没有增加或修改任何 Client Slot；DSH 源码工作树保持干净。

## 原版 rc.8 / Web 实机观察

| 场景 | 状态 | 证据 |
|---|---|---|
| `.tgz` 安装 | PASS | `dsh plugin --profile web add <tgz>` 在约 205ms 完成，包没有运行时依赖下载 |
| Profile 组合 | PASS | `dsh web --dump-config` 出现唯一 `dsh-automation-center` Host entry |
| 无 Shell Slot 启动 | PASS | 原版源码中不存在 `sidebar.primary.action` / `shell.page`，页面仍正常启动且无 DOM 注入 |
| 兼容入口 | PASS | 创建 Session 后，原版“对话 / 轨迹”旁出现“自动化”标签 |
| 创建与持久化 | PASS | 创建“原版 rc.8 兼容验收”，刷新和 Host 重启后定义仍存在 |
| Composer 遮挡 | PASS | 初次实测发现底部操作被会话输入框覆盖；加入动态底部净空后，“立即运行”可正常命中 |
| 立即运行 | PASS | 手动 Run 进入“排队中”，随后生成独立 Result Session |
| 模型不可用 | PASS | 无 API Key 时 Run 终态为“失败”，显示结构化错误码 `MISSING_CREDENTIAL`；Automation Center 与原会话不崩溃 |
| Result Session 标题 | PASS | 新 Session 在侧栏和页头均显示“原版 rc.8 兼容验收”，不是 Workspace 名 |
| 深色主题 | PASS | 在原版设置中切换深色后，概览、卡片、错误态和输入框净空均正常 |
| Host 异常退出恢复 | PASS | 对隔离 Host 执行 `SIGKILL`，重启后定义、失败 Run 和 Result Session 均恢复 |
| 浏览器错误 | PASS | 本轮功能操作未产生 Client page error；测试期间因主动停服产生的 connection-lost warning 不计产品错误 |

## 全局中心模式的既有观察

以下结果来自提供 `sidebar.primary.action` 与 `shell.page` 的增强 DSH。它们证明 Surface Adapter 的增强分支，不代表两个 Slot 已进入 DSH 上游。

| 场景 | 状态 | 证据 |
|---|---|---|
| 根级入口位置 | PASS | “自动化”在“新会话”下方、“工作区”上方 |
| 展开态按钮 | PASS | 与“新会话”同一 Shell 按钮外壳、同中心线 |
| 折叠态按钮 | PASS | 与“新会话”同一圆形外壳和皮肤 |
| 点击后视觉 | PASS | pointer focus 主动释放，无残留选中底色 |
| 全局页面 | PASS | 中央完整页面，不属于 Session 标签或弹窗 |
| 旧 Desktop 观察 | PASS | macOS DSH Desktop 2.0.1 测试副本完成创建、暂停、手动运行与三次冷启动；该结果基于旧 DSH，不代替 rc.8 Desktop 验收 |

截图：

- [原版 rc.8 深色兼容模式](assets/stock-rc8-conversation-mode-dark.png)
- [展开侧栏](assets/sidebar-expanded-fixed.png)
- [折叠侧栏](assets/sidebar-collapsed-fixed.png)
- [点击后无选中底色](assets/desktop-no-active-paint.png)
- [原版空状态](assets/automation-center-empty.png)
- [原版创建表单](assets/create-form.png)

## 自动化覆盖

69 个插件测试覆盖：

- Surface Adapter 在增强 DSH 选择全局页、在原版 rc.8 选择 `conversation.view`。
- 原版会话输入框覆盖契约和动态底部净空，防止操作按钮被遮挡。
- Schedule 校验、IANA 时区、DST、misfire 和确定性 occurrence。
- 创建幂等、并发更新、暂停/恢复、防重叠和历史保留。
- Fresh Agent、Result Session 固定标题、无人值守工具边界、超时、取消、Host 中断和结构化错误。
- Loopback RPC、Workspace 作用域、无 Workspace 快照、旧数据只读迁移和旧 Scheduler 冲突。
- 创建/编辑协议、Result Session 导航、已归档 Session 和首条 Prompt 前标题固定。
- npm 包只携带可安装运行制品，`luxon` / `zod` 已打入 Host Bundle，不要求安装时下载运行时依赖。

## 尚未实机执行

以下项目不能计算为通过，因此当前不能发布稳定版：

- 原版 DSH rc.8 的 macOS Desktop 安装、冷启动和完整 UI 流程。
- 插件页面打开时卸载、运行中卸载以及卸载后的自动回退。
- 原生极窄窗口下的完整创建/编辑/错误处理流程；响应式规则和历史截图存在，但不等于本轮实机通过。
- Automation Run 正在执行时的 Host 崩溃；本轮实机覆盖的是异常退出后的持久化恢复，进行中 Run 的终态化由自动化测试覆盖。
- 实机超时与权限拒绝；对应执行器和错误分类测试通过。
- 旧 `@dsh-external/dsh-automation` 与新插件同时启用的实机冲突画面；冲突检测逻辑测试通过。
- Windows / Linux 原生 Desktop。
- 自动计划跨 DST 的真实长时间运行；确定性 recurrence 测试通过。

“完全没有 Workspace”在原版 DSH 中可正常启动并显示 DSH 自身空状态，但原版兼容入口属于 Session 标签，因此没有 Session 时无法进入 Automation Center。这是原版公开扩展点的信息架构限制；增强全局中心模式不受此限制。

## Go / No-Go

- **Alpha.5 / 原版 rc.8 Web：GO**。安装说明不再要求 Shell Page Patch。
- **Alpha.5 / 全局中心模式：GO（增强 DSH）**。必须明确目标 DSH 需要提供两个通用 Shell Slot。
- **稳定版：NO-GO**。必须完成 rc.8 Desktop、运行中卸载、极窄窗口和剩余破坏性实机项目，并让公开 CI 与固定版本发布证据通过。

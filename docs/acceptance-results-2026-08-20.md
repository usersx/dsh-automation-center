# DSH Automation Center Alpha 验收结果（2026-08-20）

## 结论

当前版本达到 **Alpha 预发布**标准，但尚不宣称稳定版 P0 全量 PASS。

- 插件源码测试：**67 / 67 通过**。
- DSH Layout / Sidebar / Workspace Shell 测试：**216 / 216 通过**；TypeScript 检查和 Client Bundle 构建通过。
- DSH `0.1.0-rc.8` 隔离 Web Profile + 原版官方皮肤：入口、页面、创建表单和点击态均已观察通过。
- macOS DSH Desktop 2.0.1 实机：入口、页面、创建、持久化、暂停、手动运行、Result Session、三次冷启动均已观察通过。
- 稳定版结论：**NOT PASSED**。卸载中途恢复、无 Workspace、窄窗口全流程等破坏性或边界场景尚未全部实机执行。

这份结果只说明兼容性和功能观察范围，不等于安全审计通过。

## 已测环境

| 项目 | 值 |
|---|---|
| DSH | `0.1.0-rc.8` + Shell Page Patch（Web）；旧 Desktop 观察基于 rc.7 |
| Desktop | macOS DSH Desktop 2.0.1，ad-hoc 签名测试副本（尚未用 rc.8 重新验收） |
| Profile | `desktop`、隔离 `web` Profile |
| Sidebar | rc.8 原版 Sidebar；旧 Desktop 另观察 Better Sidebar 0.12.1 |
| Theme | rc.8 原版 DeepSeek 官方皮肤 |
| 插件 | `dsh-automation-center@0.1.0-alpha.3` |

## 实机观察

| 场景 | 状态 | 证据 |
|---|---|---|
| 根级入口位置 | PASS | “自动化”在“新会话”下方、“工作区”上方 |
| 隔离 Web 启动 | PASS | rc.8 隔离 Profile 在 `127.0.0.1:3190` 加载入口、空状态和创建表单 |
| 展开态按钮 | PASS | 与“新会话”同一 class、同为 252 × 38、中心线同为 x=140、内容偏移 0px |
| 折叠态按钮 | PASS | 与“新会话”同一 class、同为 36 × 36、相同圆形皮肤 |
| 点击后视觉 | PASS | 鼠标仍停在按钮上时背景仍与“新会话”一致；pointer focus 会主动释放，无残留涂层 |
| Automation Center 页面 | PASS | 中央完整页面，不属于 Conversation 标签，也不是弹窗 |
| 创建与持久化 | PASS | 创建“验收：Automation Center 安装”，重启后仍存在 |
| 暂停 | PASS | 任务为“已暂停”，下次运行显示 `—` |
| 手动运行 | PASS | 新 Run 完成并生成独立 `dsh-automation-session-*` Session |
| Result Session 标题 | PASS | 窗口标题和会话标题均为“验收：Automation Center 安装”，不再是 `deepseek-harness` |
| 冷启动稳定 | PASS | 三次退出并重新启动，入口均存在，暂停任务均可重新读取 |
| 原始 Desktop | PASS | `/Applications/DSH Desktop.app` 未修改；测试版独立安装 |

截图：

- [展开侧栏](assets/sidebar-expanded-fixed.png)
- [折叠侧栏](assets/sidebar-collapsed-fixed.png)
- [点击后无选中底色](assets/desktop-no-active-paint.png)
- [Result Session 使用任务名](assets/result-session-title.png)

## 自动化覆盖

67 个插件测试覆盖：

- Schedule 校验、时区、DST、misfire 和确定性 occurrence。
- 创建幂等、并发更新、暂停/恢复、防重叠和历史保留。
- Fresh Agent、无人值守工具边界、超时、取消、Host 中断和结构化错误。
- Loopback RPC、Workspace 作用域、旧数据只读迁移和旧调度器冲突。
- Client 页面注册、创建/编辑协议、Result Session 导航和归档状态。
- Result Session 在首条 Prompt 前固定为自动化任务名。

216 个 DSH Layout / Sidebar / Workspace Shell 测试覆盖：

- 展开和折叠状态均由 Shell 使用“新会话”的同一按钮外壳渲染插件入口。
- 当前页保留无障碍语义，不添加 `data-active` 或选中态涂层；产品入口 hover 背景保持不变，鼠标 pointer focus 会释放。
- Slot、折叠动画、设置入口和 Workspace 区域没有回归。

## 未实机执行

以下项目不能计算为通过，因此当前不能发布稳定版：

- 插件打开页面时卸载以及卸载后的自动回退。
- 完全没有 Workspace 的 Desktop 空状态。
- 原生深色和极窄窗口下的全部创建/编辑流程（rc.8 原版浅色皮肤已观察）。
- macOS Desktop 使用 rc.8 Shell Patch 的重新验收。
- 实机超时、Host 崩溃、权限拒绝和模型不可用的错误页面。
- 旧插件与新插件同时启用的 Desktop 冲突画面（逻辑测试已通过）。
- 自动计划跨 DST 的真实长时间运行（确定性测试已通过）。

## Go / No-Go

- **Alpha 预发布：GO**。安装说明必须注明需要 Shell Patch。
- **稳定版：NO-GO**。需完成上述未实机执行项，并等待两个通用 Client Slot 进入上游 DSH 或提供正式兼容发行版。

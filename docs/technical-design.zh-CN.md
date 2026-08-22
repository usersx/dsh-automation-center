# DSH Automation Center 技术方案

## 目标

Automation Center 是 DSH 的全局一级页面。Automation 是持久化任务定义，Workspace 是执行目标，Run 是一次执行记录，Result Session 是 Run 的完整结果和审计轨迹。

## 两种 Surface，一套 Engine

### 原版兼容 Surface

未修改的 DSH `0.1.0-rc.8` 已公开全局 `settings.section` 和 Session 作用域的 `conversation.view`。插件始终注册 Settings 管理页，并在两个 Shell Slot 不可用时保留 Session 快捷入口：

```text
settings.section / automation  -> Automation Center（权威全局入口）
conversation.view / automation -> Automation Center（Session 快捷入口）
```

这种模式无需修改 DSH，也不注入 DOM。即使没有当前 Session，用户仍可从 Settings 查看和管理所有 Workspace 的任务；Conversation Surface 只提供就近入口。两个 Surface 只负责承载视图，Host Engine、RPC、存储和 Scheduler 均与增强模式相同。

### 全局 Shell Surface

DSH 上游提供两个通用扩展点：

- `sidebar.primary.action`：渲染在“新会话”和“工作区”之间的根作用域一级操作。
- `shell.page`：渲染与 Conversation 同级的根作用域中央页面。

`ctx.layout` 增加 `openPage(pageId)`、`showConversation()` 和当前 Shell Surface 的可观察状态。打开全局页面时，Conversation 只隐藏、不卸载，确保当前 Session、草稿和页面状态不丢失。

### Surface 协商

`dsh-automation-center` 注册：

```text
sidebar.primary.action / automation -> 自动化入口
shell.page / automation             -> Automation Center
```

Client 始终通过 manifest 已声明的 `@deepseek-ai/dsh-client-ui-settings` 注册全局设置页。启动时再检查 `ctx.layout` 导航能力：`surface`、`openPage` 与 `showConversation` 全部存在时选择增强 Shell 模式，否则通过 `@deepseek-ai/dsh-client-ui-conversation` 注册原版快捷入口。若目标 DSH 无法解析这些声明依赖，DSH Loader 会在 Client 组合阶段明确失败，不会静默丢失入口。

插件不使用 DOM 注入，也不覆盖 Sidebar。Surface Adapter 只暴露注册与导航差异，不复制业务逻辑。

## 核心模块

插件将调度复杂度收敛到一个深模块：

```ts
interface AutomationEngine {
  snapshot(
    scope: AutomationAccessScope,
    query: AutomationQuery,
    signal?: AbortSignal,
  ): Promise<AutomationSnapshot>

  dispatch(
    scope: AutomationAccessScope,
    command: AutomationCommand,
    signal?: AbortSignal,
  ): Promise<AutomationCommandReceipt>

}
```

Scheduler、Loopback RPC、Agent Tools 和 Client UI 都复用 `snapshot` / `dispatch` 主边界，不直接读写 Storage Domain。每个写命令带稳定 request ID，返回持久 Receipt：`committed`、`rejected` 或 `unknown`；Client 在 Receipt 后执行 read-after-write，以 Definition Store 的 revision 为唯一权威。

## 执行模型

每个 Run：

1. 以确定性的 occurrence key 领取计划。
2. 运行 Workspace、Preset、provider/model/reasoning 预检；不可用目标在创建 Session 前进入结构化失败。
3. 快照 Agent Preset、显式 Model Policy、权限和当前工作目录。
4. 持久记录 `claim -> setup -> executing -> settling -> delivery` 阶段以及 owner、heartbeat、expiry 和副作用边界。
5. 创建无父 Session、无历史、无临时授权的 Fresh Agent。
6. 使用 `source.kind = automation` 发送首条任务指令。
7. 以 whole-job deadline 等待成功、失败、取消或超时；deadline 从预检开始，覆盖收尾与交付。
8. 保存摘要、结构化错误、实际模型和 Result Session ID，并清除 lease。

同一个 Automation 不允许重叠运行；第一版不自动重试，避免重复产生外部副作用。Host 重启时，尚未越过副作用边界且没有 Session 的 Run 可以重新排队；其他遗留 Run 标记为 `host_interrupted`，绝不盲目重放。

## 权限边界

- Web 管理 RPC 仅允许可信 Loopback 连接。
- UI 只能选择 DSH 已注册的 Workspace ID，不能传入任意宿主路径。
- Agent Tools 只能管理调用 Session 所属 Workspace 的 Automation。
- Automation 创建的 Agent 不获得自动化管理工具，防止递归创建无人值守任务。
- 无人值守执行只支持 `read-only` 和 `workspace-write`，不等待人工授权。
- Token、环境变量和凭证不能进入日志、摘要或错误响应。

## 数据与迁移

新插件使用独立 Storage Domain。首次启动可以只读导入旧插件的 `dsh_automation` v1 数据，转换完成后比对记录数量和摘要，并保留旧数据用于回滚。

旧插件和新插件不得同时启动 Scheduler。检测到冲突时必须以 `AUTOMATION_PLUGIN_CONFLICT` 明确失败。

## 发布边界

当前插件提供可安装的 Host/Web Bundle，并能在未经修改的 DSH `0.1.0-rc.8` 上使用 Settings 全局管理页和 Conversation 快捷入口。Shell Patch/未来上游 Slot 只决定是否能展示 Sidebar 根入口，不再是安装前置条件。Release 必须分别声明 Stock Compatible 与 Global Center 的验收结果，不能把 Settings 页面描述成 Sidebar 根入口。只有 [验收标准](acceptance-criteria.zh-CN.md) 中对应发布声明的 P0 条目在 Web 与 Desktop 均通过后，才可升级为稳定版。

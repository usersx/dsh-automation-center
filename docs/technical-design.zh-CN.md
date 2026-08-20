# DSH Automation Center 技术方案

## 目标

Automation Center 是 DSH 的全局一级页面。Automation 是持久化任务定义，Workspace 是执行目标，Run 是一次执行记录，Result Session 是 Run 的完整结果和审计轨迹。

## 两条交付链路

### DSH 上游

DSH 上游提供两个通用扩展点：

- `sidebar.primary.action`：渲染在“新会话”和“工作区”之间的根作用域一级操作。
- `shell.page`：渲染与 Conversation 同级的根作用域中央页面。

`ctx.layout` 增加 `openPage(pageId)`、`showConversation()` 和当前 Shell Surface 的可观察状态。打开全局页面时，Conversation 只隐藏、不卸载，确保当前 Session、草稿和页面状态不丢失。

### 独立插件

`dsh-automation-center` 注册：

```text
sidebar.primary.action / automation -> 自动化入口
shell.page / automation             -> Automation Center
```

插件不使用 DOM 注入，不覆盖 Sidebar，也不注册到 Session 级的 `conversation.view`。

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

  readonly changes: HostObservable<AutomationChange>
}
```

CLI、Scheduler、Loopback RPC、Agent Tools 和 Client UI 都只能调用这个接口，不直接读写 Storage Domain。

## 执行模型

每个 Run：

1. 以确定性的 occurrence key 领取计划。
2. 通过 Workspace Registry 解析目标 Workspace。
3. 快照 Agent Preset、模型、权限和当前工作目录。
4. 创建无父 Session、无历史、无临时授权的 Fresh Agent。
5. 使用 `source.kind = automation` 发送首条任务指令。
6. 等待成功、失败、取消或超时。
7. 保存摘要、结构化错误和 Result Session ID。

同一个 Automation 不允许重叠运行；第一版不自动重试，避免重复产生外部副作用。

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

当前插件已经提供可安装的 Host/Web Bundle；DSH `0.1.0-rc.8` Shell Patch 也已实现并通过对应源码测试。由于两个通用扩展点尚未进入未经修改的 DSH `0.1.0-rc.8`，Release 必须明确标记为 Alpha，并把“上游原版 DSH”列为不兼容，而不能伪称开箱即用。只有 [验收标准](acceptance-criteria.zh-CN.md) 中全部 P0 条目在 Web 与 Desktop 均通过后，才可升级为稳定版。

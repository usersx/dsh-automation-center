# DSH Automation Center 验收标准

## 1. 验收范围

目标插件需要在 DSH Web 和 DSH Desktop 中提供自动化任务中心，并按 DSH 实际扩展能力选择界面：

- **原版兼容模式**：未修改的 DSH `0.1.0-rc.8` 通过公开的 `conversation.view` 提供“自动化”标签；不需要 Shell Page Patch，不允许 DOM 注入或替换 Sidebar。
- **全局中心模式**：DSH 同时提供 `sidebar.primary.action` 与 `shell.page` 时，提供完整的全局 Automation Center：
  - 入口位于左侧栏“新会话”正下方、“工作区”正上方；
  - 与“新会话”同属一级入口；
  - 不依赖当前 Session 或 Workspace；
  - 点击后在中央区域打开 Automation Center。
- 用户可以创建、管理、触发自动化任务。
- 每次执行创建一个独立 Session，并可从运行记录进入查看。
- 信息架构参考 Codex、Z Code，任务字段和运行能力可参考现有 DSH Automation 插件。
- 视觉遵循 DSH 原生设计，不要求像素级复制竞品。

原版兼容发布必须通过 A 类、D–S 类中适用的 P0 以及下方 SC 条目；B/C 的根级入口条目属于全局中心模式。宣称“完整全局中心稳定版”时，全部 P0 条目都必须通过且不得触发一票否决项。

### SC. 原版 rc.8 兼容模式

| ID | 验收项 | 通过标准 |
|---|---|---|
| SC-01 | 无 Patch 安装 | 未修改的 DSH `0.1.0-rc.8` 可以直接安装并启动，不要求用户替换 DSH 构建 |
| SC-02 | 原生扩展点 | 使用 `conversation.view` 注册标签，不扫描或修改 DSH DOM |
| SC-03 | Surface 协商 | `ctx.layout` 提供 Shell 导航能力时选择全局中心；否则注册声明在 Client manifest 中的 Conversation 依赖 |
| SC-04 | 功能同源 | 两种界面复用同一 AutomationEngine、RPC、数据和任务行为，不形成两套调度器 |
| SC-05 | 明确边界 | README 明确说明原版 rc.8 需进入 Session 才能看到标签，不能把它描述为全局根入口 |

## 2. P0 功能验收

### A. 插件安装与启动

| ID | 验收项 | 通过标准 |
|---|---|---|
| A-01 | DSH 命令安装 | 可以通过 `dsh plugin --profile <profile> add <package>` 完成安装 |
| A-02 | Desktop 生效 | 安装到 Desktop Profile 后，完整重启一次即可生效 |
| A-03 | Web 生效 | 对应 Profile 的 DSH Web 页面中可以看到插件 |
| A-04 | 冷启动稳定 | 连续启动 DSH Desktop 3 次，不闪退、不白屏 |
| A-05 | 缺少扩展点 | DSH 不支持 Shell Slot 时自动降级；若目标连 manifest 声明的 Conversation 包都无法解析，则由 DSH Loader 明确报告依赖错误 |
| A-06 | 卸载 | 卸载并重启后入口和页面消失，DSH 其他功能正常 |
| A-07 | 插件冲突 | 旧 `dsh-automation` 同时启用时明确提示冲突，不启动第二套调度器 |

### B. 左侧栏入口

| ID | 验收项 | 通过标准 |
|---|---|---|
| B-01 | 精确位置 | “自动化”位于“新会话”下方、“工作区”上方 |
| B-02 | 一级入口 | 视觉层级与“新会话”一致，不属于 Workspace 或 Session 列表 |
| B-03 | 无 Session 可见 | 没有当前 Session 时入口仍然存在且可以点击 |
| B-04 | 无 Workspace 可见 | 没有 Workspace 时入口仍可打开，页面显示引导状态 |
| B-05 | 展开状态 | 侧栏展开时与“新会话”使用同一按钮外壳、同宽并水平居中，显示图标、“自动化”和必要的状态徽标 |
| B-06 | 收起状态 | 侧栏收起时与“新会话”使用同一皮肤和圆形按钮尺寸，并通过 Tooltip 显示名称 |
| B-07 | 当前页语义 | Automation Center 打开时仅使用 `aria-current="page"` 表达当前页；按钮不得变色或增加选中背景 |
| B-08 | 待处理徽标 | 存在失败或待查看 Run 时显示数量徽标，没有时不显示 |
| B-09 | Better Sidebar | 与稳定版 Better Sidebar 同时启用时入口位置和点击行为正常 |

必须满足以下顺序：

```text
DeepSeek Harness
├── 新会话
├── 自动化
└── 工作区
```

### C. Automation Center 页面

| ID | 验收项 | 通过标准 |
|---|---|---|
| C-01 | 独立页面 | 点击入口后，中央区域切换到 Automation Center |
| C-02 | 非会话标签页 | 页面不出现在“对话”“轨迹”等 Session 标签中 |
| C-03 | 非弹窗 | Automation Center 是完整中央页面，不是临时弹窗 |
| C-04 | 全局作用域 | 默认展示所有 Workspace 的自动化 |
| C-05 | Workspace 筛选 | 可以按 Workspace 筛选任务和 Run |
| C-06 | 空状态 | 没有任务时显示功能说明和“创建第一个自动化”按钮 |
| C-07 | 页面状态 | 至少展示任务总数、启用数量、下次运行和需要关注的 Run |
| C-08 | 返回会话 | 点击普通 Session 后自动返回 Conversation 页面 |
| C-09 | 状态保留 | 进入 Automation Center 再返回后，当前 Session 和草稿不丢失 |
| C-10 | 卸载保护 | 页面打开时卸载插件，DSH 自动回到 Conversation，不白屏 |

### D. 自动化任务创建

创建表单至少包含：名称、任务指令、Workspace、运行计划、时区、Agent Preset、权限预设和超时时间。

| ID | 验收项 | 通过标准 |
|---|---|---|
| D-01 | 创建入口 | 页面顶部和空状态中都能进入创建流程 |
| D-02 | 表单校验 | 缺少必填字段时不能提交，并准确定位错误字段 |
| D-03 | Workspace 安全 | 不能输入任意宿主绝对路径，只能选择已注册 Workspace |
| D-04 | Schedule 预览 | 保存前显示下一次预计运行时间和时区 |
| D-05 | 创建成功 | 保存后任务立即出现在列表中 |
| D-06 | 持久化 | 重启 DSH 后任务仍然存在 |
| D-07 | 编辑 | 可以修改名称、指令、Schedule、Preset、权限和超时时间 |
| D-08 | 暂停恢复 | 可以暂停和恢复，暂停后不自动触发 |
| D-09 | 删除 | 删除前需要确认，删除 Definition 后保留已有 Run 历史 |
| D-10 | 立即运行 | 可以不等待 Schedule，创建一次手动 Run |
| D-11 | 重复提交 | 连续保存或网络重试不会创建重复任务 |

### E. 自动运行与 Result Session

| ID | 验收项 | 通过标准 |
|---|---|---|
| E-01 | 自动触发 | 到达计划时间后自动创建 Run，无需保持页面打开 |
| E-02 | Fresh Session | 每个 Run 创建一个新的根 Session |
| E-03 | 不继承历史 | Result Session 不继承创建者 Session 的聊天历史 |
| E-04 | 不继承授权 | Result Session 不继承临时人工授权 |
| E-05 | Workspace 正确 | Agent 在 Definition 指定的 Workspace 中执行 |
| E-06 | 来源标识 | Session 带有 Automation ID、Run ID 和计划时间来源信息 |
| E-07 | 运行状态 | Run 正确经历 `queued -> running -> succeeded/failed/cancelled` |
| E-08 | 结果入口 | 点击运行记录可以打开对应 Result Session |
| E-09 | 返回中心 | Result Session 中提供“返回自动化中心”入口 |
| E-10 | 运行摘要 | 展示结果摘要、开始时间、耗时和终态 |
| E-11 | 不重复执行 | 同一计划时间在重启、刷新或重复调度后最多领取一次 |
| E-12 | 并发保护 | 同一个 Automation 运行中时不启动第二个重叠 Run |
| E-13 | 超时 | 超时后终止并记录 `run_timeout` |
| E-14 | 取消 | 可以取消运行，并提示已有副作用不会自动回滚 |
| E-15 | Host 重启 | 遗留的 `running` Run 标记为 `host_interrupted` |

### F. 任务列表与运行历史

每个任务至少展示名称、Workspace、启用状态、Schedule、下次运行、最近状态以及立即运行、编辑、暂停和删除操作。

每个 Run 至少展示触发方式、计划时间、开始和结束时间、状态、结果摘要、Result Session 入口、结构化错误以及待查看状态。

错误至少区分 Workspace 不存在、路径不可用、Preset 不存在、模型不可用、权限拒绝、超时、Agent 崩溃、Host 中断和用户取消。

## 3. UI 与交互验收

参考优先级为：

1. 本文档确定的产品语义。
2. DSH 原生组件、主题和交互规范。
3. Codex、Z Code 的全局任务中心信息架构。
4. 现有 DSH Automation 的 Schedule、权限和运行历史能力。

页面至少包含标题、Workspace 筛选、统计概览、自动化任务列表、最近运行或 Review Queue，以及新建自动化按钮。

| ID | 验收项 | 通过标准 |
|---|---|---|
| UI-01 | DSH 原生风格 | 使用 DSH UI 组件和 `--dsw-*` 语义变量 |
| UI-02 | 主题兼容 | 浅色、深色和自定义背景主题下文字、按钮可读 |
| UI-03 | 中文文案 | 默认中文表达自然，不显示原始错误堆栈 |
| UI-04 | 窄窗口 | 窄窗口不出现页面横向溢出，核心操作可完成 |
| UI-05 | 加载状态 | 请求期间显示明确加载或局部忙碌状态 |
| UI-06 | 错误状态 | RPC 失败、Host 不可用时有明确恢复提示 |
| UI-07 | 操作反馈 | 创建、更新、暂停、运行和删除都有结果反馈 |
| UI-08 | 无视觉侵入 | 不覆盖 Sidebar、不遮挡设置、不破坏 Workspace 滚动 |
| UI-09 | 皮肤一致性 | 自动化入口由 DSH Shell 渲染按钮外壳，在任意皮肤中与“新会话”保持相同几何、对齐和视觉状态 |

## 4. 数据迁移验收

| ID | 验收项 | 通过标准 |
|---|---|---|
| M-01 | 旧数据检测 | 自动检测旧 `dsh_automation` 数据域 |
| M-02 | 迁移预览 | 告知发现的 Definition 和 Run 数量 |
| M-03 | 幂等迁移 | 重启或重复迁移不会产生重复记录 |
| M-04 | 数据保留 | 旧 Definition、Schedule、Workspace 和 Run 状态正确转换 |
| M-05 | 原数据不变 | 新插件不删除或覆盖旧存储域 |
| M-06 | 迁移失败 | 无法验证时停止迁移并指出记录和原因 |
| M-07 | 回滚 | 移除新插件后仍可重新安装旧插件读取旧数据 |

## 5. 安全与隐私验收

| ID | 验收项 | 通过标准 |
|---|---|---|
| S-01 | Loopback RPC | 自动化管理 RPC 只接受可信本地连接 |
| S-02 | Workspace 边界 | Web UI 只能选择已注册 Workspace |
| S-03 | Agent 作用域 | Agent 工具只能管理自身 Workspace 的 Automation |
| S-04 | 防递归 | Automation 创建的 Agent 不具备创建 Automation 的工具 |
| S-05 | 无交互授权 | 无人值守执行不能等待人工授权 |
| S-06 | 凭证保护 | Token、环境变量和凭证不进入日志、摘要和 UI 错误 |
| S-07 | Prompt 日志 | 任务指令可以本地持久化，但不写入普通诊断日志 |
| S-08 | 明确权限 | 创建任务时明确显示只读或工作区写入权限 |

## 6. 必须提供的验收材料

- DSH Web 和 Desktop 展开侧栏截图。
- 收起侧栏后的自动化图标截图。
- Automation Center 空状态、任务列表和运行历史截图。
- “安装、重启、创建、立即运行、打开 Result Session、返回中心、再次重启”的完整录屏。
- 自动化测试结果、支持的 DSH 版本范围、已知限制以及迁移和回滚说明。

## 7. 一票否决项

全局中心模式出现以下任意情况，MVP 直接判定失败：

- 入口不在“新会话”下方、“工作区”上方。
- 必须先进入 Session 才能看到入口。
- Automation Center 仍是“对话/轨迹”中的 Session 标签。
- 点击入口只打开弹窗，不切换中央页面。
- Desktop 看不到入口，只有 Web 页面存在。
- Better Sidebar 启用后入口消失。
- 重启后任务丢失。
- 同一计划时间产生两个 Run。
- Run 没有创建独立 Result Session。
- 插件导致 Desktop 闪退、白屏或无法启动。
- 旧插件冲突时静默启动两套调度器。
- 日志或 UI 泄露 Token、环境变量等凭证。

原版兼容模式另有三项一票否决：要求用户安装 Shell Page Patch、通过 DOM 注入伪造根入口、或者在 README 中把 Session 标签描述成全局入口。

最终结论只有：

```text
PASS（Stock Compatible）：SC、A 及适用功能条目通过，且没有触发原版兼容模式一票否决项。
PASS（Global Center）：全部 P0 条目通过，且没有触发任意一票否决项。
FAIL：对应发布声明中的任意 P0 条目失败，或触发任意一票否决项。
```

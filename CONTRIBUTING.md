<p align="center">
  <strong>简体中文</strong> · <a href="CONTRIBUTING.en.md">English</a>
</p>

# 贡献指南

感谢你帮助改进 DSH Automation Center。欢迎中文或英文 Issue 与 Pull Request。

## 先选择正确的反馈入口

- 可复现的功能故障、界面异常或兼容性问题：使用 [Bug report](https://github.com/usersx/dsh-automation-center/issues/new?template=bug.yml)。
- 新功能或行为调整：使用 [Feature proposal](https://github.com/usersx/dsh-automation-center/issues/new?template=feature.yml)，并关联对应的[验收标准](docs/acceptance-criteria.zh-CN.md)。
- 漏洞、凭证泄漏或绕过权限边界：使用 [GitHub Private Vulnerability Reporting](https://github.com/usersx/dsh-automation-center/security/advisories/new)，不要创建公开 Issue。
- 使用问题：先查看 [README](README.md)、[已知限制](README.md#已知限制)和现有 Issue。

提交 Bug 前请先搜索现有 Issue，并尽量确认问题仍可在最新发布版本中复现。

## Bug 复现要求

一份可处理的 Bug 报告至少应说明：

1. 插件版本、安装来源和 DSH 精确版本。
2. Web/Desktop 分发、操作系统、Node.js/pnpm 版本与 Profile 名称。
3. 使用的是原版 `conversation.view`，还是带 `sidebar.primary.action` / `shell.page` 的全局 Shell 模式。
4. 是否存在 Workspace、旧版 `@dsh-external/dsh-automation` 是否已禁用。
5. 最小复现步骤、预期结果、实际结果，以及问题从哪个版本开始出现。

如果问题涉及计划任务，请提供脱敏后的时区、触发方式、超时和权限预设；不要粘贴任务 Prompt。

截图应优先使用原版 DeepSeek 皮肤。若问题只在特定皮肤出现，请同时提供原版皮肤的对照结果。

## 数据与日志安全

公开 Issue、测试夹具、截图和日志中不得包含：

- API Token、Cookie、凭证、环境变量值或完整请求头；
- 私有 Prompt、模型输出、Workspace 文件内容或用户 Home 绝对路径；
- 公司内部域名、仓库地址、Session 数据或可识别个人的信息。

请用 `<redacted>`、`<workspace>` 和 `<home>` 替换敏感内容。不能安全脱敏的材料应通过私有安全报告提交。

## 本地开发

需要 Node.js `^22.19.0` 或 `>=24.0.0`，以及 pnpm `10.32.1`。

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` 会执行类型检查、构建、测试和仓库契约检查。不要只提交生成后的 `lib/`，源代码与测试必须同时更新。

### 改动对应的验证

- Surface 选择：同时覆盖原版 `conversation.view` 与全局 Shell 模式。
- Scheduler/时区：覆盖一次、间隔、每日、每周、错过触发与重启恢复。
- 执行与权限：覆盖成功、模型不可用、权限拒绝、超时、取消和 Host 中断。
- UI：至少验证原版浅色/深色、无 Workspace、窄窗口与无活动 Session。
- 兼容性声明：将“自动化测试通过”“人工观察通过”“阻塞”“未执行”分开记录。

修改安装、Surface、Bundle 或生命周期代码时，还应打包并安装到隔离 Profile：

```sh
npm pack
dsh plugin --profile <test-profile> add ./dsh-automation-center-<version>.tgz
dsh --profile <test-profile> --dump-config
```

不要用开发目录的成功加载代替 `.tgz` 安装验收。

## Pull Request 流程

1. 从最新 `main` 创建功能分支，禁止直接提交到 `main`。
2. 保持改动单一、可回滚，并说明用户可见行为和非目标。
3. 新行为必须带测试；修复应尽量先加入能复现问题的测试。
4. 更新 `CHANGELOG.md` 的 `Unreleased` 或目标版本章节。
5. 运行 `pnpm check`；兼容性改动附上隔离 Profile 的安装证据。
6. 在 PR 清单中如实标记已验证、阻塞和未执行项。

维护者可能要求补充原版 DSH、Desktop 或特定错误路径的实机证据。CI 通过是合并前提，但不等同于全部验收通过。

## 设计约束

- 优先复用 DSH/Cordis 的 Service、Slot 与生命周期，不使用 DOM 注入复制 Sidebar。
- 保持 Automation Engine 与 UI Surface 解耦；Session 标签和全局中心必须共享同一领域层。
- 无人值守执行应最小权限、失败关闭，并保留可审计的 Result Session。
- 不得把 Prompt、Token、环境变量或宿主私密路径写入 RPC、日志或公开报告。

提交代码即表示你同意以本项目的 [MIT License](LICENSE) 发布该贡献。

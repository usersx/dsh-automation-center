# DSH Automation Center

中文 | [English](README.md)

DSH Automation Center 是面向 DeepSeek Harness 的全局自动化任务中心。它的入口位于左侧栏“新会话”正下方、“工作区”正上方，与“新会话”同属一级入口。

点击“自动化”后，中央区域切换为 Automation Center。用户可以在这里创建、管理、立即运行和查看自动化任务。每次运行都会创建一个全新的 DSH Session；Session 是本次运行的结果和审计记录，不是自动化的管理入口。

## 当前状态

项目目前处于 **Pre-alpha 规格阶段**，已经确定：

- 产品入口和页面层级。
- 完整 P0 验收标准。
- DSH 上游扩展点方案。
- 调度、执行、权限、迁移和回滚边界。
- 分阶段实施路线。

当前仓库还不是可以安装的 DSH Bundle。目标 DSH 源码尚未提供以下通用扩展点：

- `sidebar.primary.action`
- `shell.page`

本项目不会使用 DOM 注入，也不会复制或覆盖整个 Sidebar。只有在上游扩展点可用、P0 验收全部通过后，才会增加正式安装命令和发布可安装制品。

## 文档

- [验收标准](docs/acceptance-criteria.zh-CN.md)
- [技术方案](docs/technical-design.zh-CN.md)
- [实施路线](ROADMAP.md)

## 本地检查

当前检查不需要安装第三方依赖：

```sh
npm run check
```

## 许可证

[MIT](LICENSE)

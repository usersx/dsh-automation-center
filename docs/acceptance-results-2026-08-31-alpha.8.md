# DSH Automation Center Alpha.8 验收结果（2026-08-31）

## 当前结论

- **状态：Alpha.8 本地 Tested，发布证据待 CI/Release/npm 回读。** 不把本文件中的能力写成 Alpha.7 已发布能力。
- **Node 24 源码门：PASS。** 版本与文档冻结后，typecheck、build、107/107 tests、repository check 与 `git diff --check` 全部通过。
- **P0 cleanup ownership：PASS（自动化测试）。** Host/service cleanup 失败可重试；Git review 在 side effect 前持久 owner，restart 可完成 discard，对已经应用的同一 patch 可只释放 worktree。
- **Secret-safe Automation wire：PASS（本插件边界）。** 未知内部 RPC/Command Receipt 异常不返回 sentinel；插件 Config 不声明 secret schema role。
- **宿主级负向：NOT RUN。** DSH complex Settings schema、真实 same/narrower/wider sandbox、idle-dispose/refollow 仍需独立 Host E2E。
- **DSH `0.1.2-alpha.2`：PASS（失败链路）/ Partial（最终包层）。** 官方源码 Node 24 build PASS；代码候选包在 fresh Web Profile 完成 Host/Client、Settings/Definition、direct/worktree `MISSING_CREDENTIAL`、真实 Result Session/Attention、ghost `sessionId=null` 与 keep readback。最终 `0.1.0-alpha.8` tgz 又在第二个 fresh Profile 完成安装/config/version readback；最终 Client bundle 与 E2E 候选包一致，Host 只多了 patch capture 后恢复 index 的修正并由新增单测覆盖。最终包未重复整套浏览器 E2E，真实模型成功 Run 未运行。

## 已验证不变量

| 不变量 | 状态 | 证据 |
|---|---|---|
| cleanup owner 只在 settle 成功后 released | PASS | cleanup 首次失败恢复为 owned；并发调用共享同一 promise；成功后幂等 |
| service.dispose 可重试 | PASS | storage close 首次失败后第二次真正 close；中途不伪装 disposed |
| review side effect 前持久 settling | PASS | service 先写 Run review cleanup，再 apply/remove；失败写 unknown Attention |
| interrupted accept 可对账 | PASS | source diff digest 等于持久 patchSha256 时跳过重复 apply，只释放 worktree |
| interrupted discard 可对账 | PASS | worktree 已不存在时 prune/cleanup 幂等，重启写 released |
| source drift fail closed | PASS | HEAD 或 source diff identity 不匹配时拒绝 accept |
| stable identity 不含 prompt/secret | PASS | 仅含 automationId、definitionRevision、occurrenceKey、workspaceId；每个 lifecycle sequence 一致 |
| sandbox policy 固定 | PASS（guard） | same/narrower/wider 与空 justification 均被要求去掉 override 后重试 |
| raw internal error 不过 wire | PASS | RPC 与 Command Receipt sentinel 不出现在序列化响应 |
| review setup 不产生幽灵 Session | PASS | dirty source fail closed，Run `sessionId=null`，snapshot 不提供打开入口 |
| alpha.2 direct 失败链路 | PASS（浏览器） | fresh Profile 中创建/立即运行到 `MISSING_CREDENTIAL`；真实 Result Session 可打开，Attention readback scope 正确 |
| alpha.2 worktree 失败链路 | PASS（浏览器+存储） | clean source 创建 detached worktree；`No changes`、accept/keep/discard 可见；keep 落盘为 `review.status=kept` |
| 最终 Alpha.8 打包身份 | PASS（安装/config） | tgz SHA-256 `603026a313624314fd4b3bb452c8b13b2e04e5ee625fd6075d6cec0909e3108f`；fresh Profile readback version `0.1.0-alpha.8`；supply-chain policy gate PASS |

## 未运行，不能宣传为通过

- DSH `redactSecrets` 对 union/intersection/tuple/transform/lazy/default/error text 的 fail-closed 矩阵。
- DSH alpha.2 真实 bash/pwsh same/narrower/wider sandbox 工具调用。
- Result Session `idle dispose → old follow terminal → relist/refollow → latest seq`。
- Windows/Linux 原生 Desktop GUI 与真实进程强杀。
- Alpha.8 PR/main CI、GitHub Release 资产/attestation 与 npm registry publication/readback；Alpha.7 的 Trusted Publisher 最终 PUT 曾因包权限返回 E404。

# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and use semantic versioning.

## [Unreleased]

## [0.1.0-alpha.7] - 2026-08-30

### Added

- Derived scheduler health with expected/admitted/claimed timestamps, queue wait, last durable progress, overdue and stalled states.
- Machine-readable `Outcome` / `Attention`, bounded attempts, durable side-effect uncertainty, and a scoped `automation_report_outcome` tool.
- Monotonic lifecycle events with run identity/revision/sequence plus a redacted effective actor, permission, preset and tool snapshot.
- Isolated Git worktree review mode with clean-base enforcement and explicit accept, keep and discard actions.
- Conditional local notifications when browser notification permission is already granted; the UI never prompts automatically.

### Changed

- Validate package installation against stock DSH `0.1.2-alpha.1` in addition to rc.8 and rc.2.
- Restrict the model-visible tool catalog to the effective unattended allowlist instead of exposing tools that would later be denied.
- Bound cancellation cleanup independently from the Agent turn deadline and classify incomplete cleanup as an uncertain effect.
- Validate the complete legacy migration plan before the first destination write and expose a source fingerprint/count summary.

### Fixed

- Keep imported legacy definitions deleted across Host restarts by reusing durable delete Receipts as tombstones.
- Declare `@deepseek-ai/schemastery` as an explicit runtime dependency so alpha.1 Profile composition can import the Host bundle.
- Preserve actionable `REQUEST_EXTENSION` and `STREAM_CLOSED` classifications instead of folding them into a generic executor error.
- Keep Result Session navigation, Workspace attachment and Attention readback scope-consistent.

### Changed

- Validate stock compatibility against both the minimum supported DSH `0.1.0-rc.8` and the current `0.1.1-rc.2` in CI.
- Record the public alpha.6 Release, npm checksums and the exact rc.2 install/activation smoke without overstating unrun Desktop or Agent-run cases.
- Clarify that alpha.6 has a GitHub/Sigstore build attestation but its bootstrap npm publication did not produce observed npm registry provenance.

## [0.1.0-alpha.6] - 2026-08-23

### Added

- Explicit per-automation model policy: inherit the live DSH default or pin an exact provider, model and optional reasoning effort in Web and Agent Tools.
- Native `settings.section` Automation Center for stock DSH rc.8, available without opening a Session; the Conversation tab remains a shortcut.
- Durable command receipts with request IDs, replay detection, revisions and `committed | rejected | unknown` outcomes for every mutation.
- Run supervisor phases (`claim`, `setup`, `executing`, `settling`, `delivery`), leases, heartbeats and conservative interrupted-run recovery.
- Structured target/model preflight health in snapshots and an effective-model record on each Run.

### Changed

- The run deadline now covers preflight, setup, Agent execution, settling and delivery instead of only the Agent turn.
- Client mutations perform a post-commit authoritative read; an unknown outcome also triggers reconciliation before the uncertainty is shown.
- Expanded the bilingual contribution workflow and Bug form with reproducibility, isolated-profile verification and sanitized diagnostics.

### Fixed

- A missing Workspace, Agent preset or selected model is shown as blocked before Run admission rather than failing after Session creation.
- Settings panels now reflow against the Automation Center slot width, so edit and run actions remain visible even when the browser viewport itself is wide.
- The editor resolves the latest automation revision while background snapshots refresh, avoiding stale edit state during long-running Settings sessions.

## [0.1.0-alpha.5] - 2026-08-20

### Added

- Stock DSH `0.1.0-rc.8` compatibility through the native `conversation.view` extension point.
- Capability-based Surface Adapter that selects global Shell mode when `sidebar.primary.action` and `shell.page` are available.
- Cross-platform CI plus a stock rc.8 isolated-profile installation gate.
- Trusted npm publishing, npm provenance, SPDX SBOM, SHA-256 checksum and GitHub/Sigstore build attestation workflow.
- Dependabot, contribution guide, security policy, Bug form and pull-request template.

### Changed

- Shell Page Patch is now optional. It enhances information architecture but is no longer an installation prerequisite.
- README defaults to Chinese, links to the English version, and includes both short and fixed-version install commands.

### Fixed

- Stock Conversation mode now reserves the live composer height so the Session input cannot cover automation actions.

### Security

- CI and release actions are pinned to immutable commit SHAs.
- Release publishing uses GitHub OIDC instead of a long-lived npm token.

## [0.1.0-alpha.4] - 2026-08-20

### Fixed

- Result Session titles now use the automation task name rather than the Workspace/project name.
- The global sidebar action uses the same shell-owned button chrome and center line as New Session.
- Pointer activation no longer leaves an unwanted selected background.

## [0.1.0-alpha.3] - 2026-08-20

### Added

- First npm pre-release of the global Automation Center and fresh-session execution engine.

[Unreleased]: https://github.com/usersx/dsh-automation-center/compare/v0.1.0-alpha.7...HEAD
[0.1.0-alpha.7]: https://github.com/usersx/dsh-automation-center/compare/v0.1.0-alpha.6...v0.1.0-alpha.7
[0.1.0-alpha.6]: https://github.com/usersx/dsh-automation-center/compare/v0.1.0-alpha.5...v0.1.0-alpha.6
[0.1.0-alpha.5]: https://github.com/usersx/dsh-automation-center/compare/v0.1.0-alpha.4...v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/usersx/dsh-automation-center/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.3

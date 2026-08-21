# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and use semantic versioning.

## [Unreleased]

### Changed

- Expanded the bilingual contribution workflow with reproducibility, isolated-profile verification, evidence, and data-safety requirements.
- Expanded the Bug form to capture installation source, runtime, Surface, Workspace, legacy-plugin, regression, and sanitized diagnostic context.

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

[Unreleased]: https://github.com/usersx/dsh-automation-center/compare/v0.1.0-alpha.5...HEAD
[0.1.0-alpha.5]: https://github.com/usersx/dsh-automation-center/compare/v0.1.0-alpha.4...v0.1.0-alpha.5
[0.1.0-alpha.4]: https://github.com/usersx/dsh-automation-center/compare/v0.1.0-alpha.3...v0.1.0-alpha.4
[0.1.0-alpha.3]: https://github.com/usersx/dsh-automation-center/releases/tag/v0.1.0-alpha.3

# DSH Automation Center

[中文](README.md) | English

[![CI](https://github.com/usersx/dsh-automation-center/actions/workflows/ci.yml/badge.svg)](https://github.com/usersx/dsh-automation-center/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dsh-automation-center.svg)](https://www.npmjs.com/package/dsh-automation-center)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> The hero is project artwork, not a product screenshot. Every functional screenshot uses the original official DeepSeek skin on DSH `0.1.0-rc.8`.

![DeepSeek whale girl orchestrating automations](https://raw.githubusercontent.com/usersx/dsh-automation-center/main/docs/assets/deepseek-whale-girl-automation.png)

DSH Automation Center adds scheduled, auditable Agent runs to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Every occurrence creates a fresh root Agent and Result Session in the selected Workspace. The center owns definitions, schedules, permissions and run history; the Result Session retains the complete output and trajectory.

The same package selects the deepest native surface available, without DOM injection or Sidebar replacement:

- **Stock compatibility mode:** unmodified DSH `0.1.0-rc.8` registers an **Automation** Conversation tab. No Shell Page Patch is required.
- **Global center mode:** when DSH exposes `sidebar.primary.action` and `shell.page`, the plugin automatically moves to a root action below **New Session** and above **Workspaces**.

> Current version: `0.1.0-alpha.5`. Compatibility validation is not a security audit.

## Install from npm

```sh
dsh plugin --profile web add dsh-automation-center@latest
```

Desktop profile:

```sh
dsh plugin --profile desktop add dsh-automation-center@latest
```

Use a fixed version for reproducible installs:

```sh
dsh plugin --profile web add dsh-automation-center@0.1.0-alpha.5
```

Fully quit and reopen DSH after installation. Use Node.js `^22.19.0` or `>=24.0.0`. Remove or disable `@dsh-external/dsh-automation`; when both schedulers are present, this plugin reports `AUTOMATION_PLUGIN_CONFLICT` instead of scheduling twice.

## Capabilities

- Cross-workspace overview, filtering, statistics and recent runs.
- One-time, fixed-interval, daily and weekly schedules with explicit IANA time zones.
- Create, edit, pause, resume, delete, run-now and cancel flows.
- A fresh root Agent and Session for every occurrence; chat sessions are never reused.
- Result Session titles derived from the automation task rather than the project.
- Read-only and workspace-write unattended policies.
- Idempotent creation, overlap protection, deterministic claims, bounded misfire handling and restart recovery.
- Durable history, summaries, Result Session links and structured error codes.
- Read-only migration from legacy `dsh_automation` v1 data.

## Original DeepSeek UI

Every functional screenshot uses the original DeepSeek skin.

### Stock rc.8 compatibility mode (dark)

Unmodified rc.8 exposes Automation beside Conversation and Trajectory. The screenshot also shows a task card, a structured failed run and clearance above the Session composer.

![Automation Conversation tab on the stock rc.8 dark skin](https://raw.githubusercontent.com/usersx/dsh-automation-center/main/docs/assets/stock-rc8-conversation-mode-dark.png)

The following three screenshots show **global center mode** when both Shell slots are available.

### Root action aligned with New Session

<p align="center">
  <img src="https://raw.githubusercontent.com/usersx/dsh-automation-center/main/docs/assets/sidebar-expanded-fixed.png" alt="Automation in the original expanded DeepSeek sidebar" width="68%">
  <img src="https://raw.githubusercontent.com/usersx/dsh-automation-center/main/docs/assets/sidebar-collapsed-fixed.png" alt="Automation in the original collapsed DeepSeek sidebar" width="18%">
</p>

### Global center

![Automation Center in the original DeepSeek skin](https://raw.githubusercontent.com/usersx/dsh-automation-center/main/docs/assets/automation-center-empty.png)

### Create an automation

![Create form in the original DeepSeek skin](https://raw.githubusercontent.com/usersx/dsh-automation-center/main/docs/assets/create-form.png)

## Architecture

```text
DSH Surface Adapter
  ├─ stock rc.8: conversation.view
  └─ enhanced: sidebar.primary.action + shell.page
                         │
                         ▼
Automation Center ──RPC──▶ AutomationEngine ──▶ Definitions / Runs
                                        │
                                        ▼
                              Fresh Agent + Session
                                        │
                                        ▼
                              Result Session + audit
```

The Host-side `AutomationEngine` is the deep module. Both Client adapters, loopback RPC, scheduler and Agent tools share its `snapshot` / `dispatch` boundary instead of accessing storage directly.

## Compatibility

| Target | Install | Surface | Status |
|---|---|---|---|
| stock DSH `0.1.0-rc.8` / Web | no patch | Conversation tab | isolated runtime observed pass; see the acceptance record |
| stock DSH `0.1.0-rc.8` / Desktop | no patch | Conversation tab | rc.8 Desktop re-validation pending |
| DSH exposing both Shell slots / Web | same package | global root page | observed pass |
| native Windows / Linux Desktop | — | selected from target capability | not yet observed |

Stock rc.8 has no `sidebar.primary.action` or `shell.page`, so a plugin cannot add a true root action through public APIs. This project deliberately avoids a brittle DOM-injection imitation. Once the generic slots land upstream, the same npm package enables global center mode automatically.

See the exact [acceptance results](docs/acceptance-results-2026-08-20.md), including blocked and unrun cases.

## Safety boundaries

- Management RPC accepts trusted loopback connections only.
- UI input accepts registered Workspace IDs, never arbitrary host paths.
- Automation Agents cannot create more automations or wait for interactive approval.
- Unattended tools are allowlisted and background-process escape is rejected.
- Restart does not blindly replay an interrupted run that may already have side effects.
- Logs and RPC errors must not expose prompts, tokens, environment variables or credentials.
- Cancellation cannot roll back completed side effects.

## Development and release evidence

```sh
pnpm install
pnpm check
```

CI runs typecheck, tests, build and repository validation on Linux, macOS and Windows, then installs the tarball into an isolated unmodified DSH rc.8 profile. Releases include a fixed tarball, SHA-256, SPDX SBOM, GitHub/Sigstore build attestation and npm provenance through Trusted Publishing.

## Documentation

- [Acceptance criteria (Chinese)](https://github.com/usersx/dsh-automation-center/blob/main/docs/acceptance-criteria.zh-CN.md)
- [Acceptance results](https://github.com/usersx/dsh-automation-center/blob/main/docs/acceptance-results-2026-08-20.md)
- [Technical design (Chinese)](https://github.com/usersx/dsh-automation-center/blob/main/docs/technical-design.zh-CN.md)
- [Release process](https://github.com/usersx/dsh-automation-center/blob/main/docs/releasing.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)
- [Roadmap](ROADMAP.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Known limitations

- Stock rc.8 can only host the Session-scoped tab; a root action requires the two generic upstream slots.
- The first release has no distributed scheduler, remote workers or cloud credential vault.
- Cancellation cannot undo file changes or external calls that already occurred.
- This remains an Alpha; stable release gates are defined in the acceptance documents.

## License

[MIT](LICENSE)

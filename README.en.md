# DSH Automation Center

[中文](README.md) | English

[![npm version](https://img.shields.io/npm/v/dsh-automation-center.svg)](https://www.npmjs.com/package/dsh-automation-center)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> The hero is project artwork, not a product screenshot. Every functional screenshot below was captured from the original official DeepSeek skin on DSH `0.1.0-rc.8`.

![DeepSeek whale girl orchestrating automations](docs/assets/deepseek-whale-girl-automation.png)

DSH Automation Center is a global automation workspace for [DeepSeek Harness](https://github.com/usersx/deepseek-harness). **Automations** is a root action directly below **New Session** and above **Workspaces**. It opens a complete center page without requiring the user to enter a Session first.

Every occurrence creates a fresh root Agent and Result Session in the selected Workspace. Automation Center owns definitions, schedules, permissions and run history; the Result Session owns the complete output and audit trail, and is titled from the automation task rather than the project name.

> Current version: `0.1.0-alpha.3`. It targets DSH `0.1.0-rc.8` and requires the companion Shell Slot Patch. Compatibility validation is not a security audit.

## Install from npm (recommended)

```sh
dsh plugin --profile web add dsh-automation-center@latest
```

Desktop profile:

```sh
dsh plugin --profile desktop add dsh-automation-center@latest
```

Fully quit and reopen DSH after installation so the Host bundle mounts.

Prerequisites:

1. Build DSH from [`agent/automation-shell-pages-rc8`](https://github.com/usersx/deepseek-harness/tree/agent/automation-shell-pages-rc8).
2. Remove or disable the original `@dsh-external/dsh-automation`.
3. Use Node.js `^22.19.0` or `>=24.0.0`.

## Why a global center

A Session-level automation tab creates an information-architecture mismatch: users must enter one Session to manage work that executes in another new Session. Automation Center moves management to the global shell:

- visible without opening a Session;
- cross-workspace definitions, schedules, recent runs and failure attention;
- a complete root page instead of a Conversation tab or modal;
- one independent, auditable Result Session per run;
- shell-owned entry chrome aligned with New Session across expanded and collapsed layouts.

## Capabilities

- One-time, fixed-interval, daily and weekly schedules with explicit IANA time zones.
- Create, edit, pause, resume, delete, run-now and cancel flows.
- Fresh root Agent and Session for every occurrence; chat sessions are never reused.
- Result Session titles pinned to the automation task name.
- Read-only and workspace-write unattended permission modes.
- Idempotent creation, overlap protection, bounded misfire handling and restart recovery.
- Durable history, summaries, Result Session links and structured error codes.
- Read-only migration from legacy `dsh_automation` v1 data.
- Explicit `AUTOMATION_PLUGIN_CONFLICT` protection against two active schedulers.

## Original DeepSeek UI

### Root entry aligned with New Session

<p align="center">
  <img src="docs/assets/sidebar-expanded-fixed.png" alt="Automation in the original expanded DeepSeek sidebar" width="68%">
  <img src="docs/assets/sidebar-collapsed-fixed.png" alt="Automation in the original collapsed DeepSeek sidebar" width="18%">
</p>

### Global center

![Automation Center in the original DeepSeek skin](docs/assets/automation-center-empty.png)

### Create an automation

![Create form in the original DeepSeek skin](docs/assets/create-form.png)

## How it works

```text
Root sidebar action
        │
        ▼
Automation Center ──RPC──▶ AutomationEngine ──▶ Definitions / Runs
                                        │
                           schedule, run-now or recovery
                                        │
                                        ▼
                              Fresh Agent + Session
                                        │
                         task title, policy and Workspace
                                        │
                                        ▼
                              Result Session + audit
```

The Host-side `AutomationEngine` is the deep module. The Client, loopback RPC, scheduler and Agent tools call its `snapshot` / `dispatch` boundary instead of accessing storage directly.

## Compatibility

Unmodified upstream DSH `0.1.0-rc.8` does not yet expose the two generic Client slots required by a true root page:

- `sidebar.primary.action`
- `shell.page`

Use the [rc.8 Shell Patch branch](https://github.com/usersx/deepseek-harness/tree/agent/automation-shell-pages-rc8). The plugin never injects DOM nodes or replaces the Sidebar. It fails explicitly with `DSH_AUTOMATION_INCOMPATIBLE` when either extension point is absent.

| Target | Status |
|---|---|
| DSH `0.1.0-rc.8` + Shell Patch / Web / official skin | observed pass |
| unmodified upstream DSH `0.1.0-rc.8` | incompatible: two slots absent |
| native macOS Desktop + rc.8 Patch | not yet re-observed |
| native Windows / Linux Desktop | not yet observed |

See the exact [acceptance results](docs/acceptance-results-2026-08-20.md), including unrun cases.

## Configuration

| Option | Default | Meaning |
|---|---:|---|
| `maxConcurrentRuns` | `2` | global running-run limit, 1–32 |
| `runTimeoutMinutes` | `60` | default run timeout, 1–1440 minutes |
| `misfireGraceMinutes` | `15` | bounded catch-up window after Host downtime |
| `historyLimit` | `200` | retained Runs per automation |
| `archiveRunSessions` | `false` | archive completed Result Sessions while retaining Run audit rows |

## Safety boundaries

- Management RPC accepts trusted loopback connections only.
- UI input accepts registered Workspace IDs, never arbitrary host paths.
- Automation Agents cannot create more automations or wait for interactive approval.
- Unattended tools are allowlisted; background-process escape is rejected.
- Restart does not blindly replay an interrupted run that may already have side effects.
- Logs and RPC errors must not expose prompts, tokens, environment variables or credentials.
- Cancellation cannot roll back completed side effects.

## Development and validation

```sh
pnpm install
pnpm check
```

Current observed results: 67 / 67 plugin tests and 216 / 216 companion DSH Layout / Sidebar / Workspace tests. On the rc.8 official skin, both expanded actions measure 252 × 38 with a 0px content-center offset; the Automation background remains identical to New Session after a pointer click.

## Documentation

- [Acceptance criteria (Chinese)](docs/acceptance-criteria.zh-CN.md)
- [Acceptance results](docs/acceptance-results-2026-08-20.md)
- [Technical design (Chinese)](docs/technical-design.zh-CN.md)
- [Roadmap](ROADMAP.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Source installation

```sh
git clone https://github.com/usersx/dsh-automation-center.git
cd dsh-automation-center
pnpm install
pnpm check
npm pack
dsh plugin --profile web add ./dsh-automation-center-0.1.0-alpha.3.tgz
```

## Known limitations

- The rc.8 Shell Patch is currently required.
- The first release has no distributed scheduler, remote workers or cloud credential vault.
- Cancellation cannot undo file changes or external calls that already occurred.
- This remains an Alpha; stable release gates are defined in the acceptance documents.

## License

[MIT](LICENSE)

# DSH Automation Center

[中文](README.md) | English

[![CI](https://github.com/usersx/dsh-automation-center/actions/workflows/ci.yml/badge.svg)](https://github.com/usersx/dsh-automation-center/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dsh-automation-center.svg)](https://www.npmjs.com/package/dsh-automation-center)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> The hero is project artwork, not a product screenshot. Every functional screenshot uses the original official DeepSeek skin on DSH `0.1.0-rc.8`.

![DeepSeek whale girl orchestrating automations](https://raw.githubusercontent.com/usersx/dsh-automation-center/main/docs/assets/deepseek-whale-girl-automation.png)

DSH Automation Center adds scheduled, auditable Agent runs to [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). Every occurrence creates a fresh root Agent and Result Session in the selected Workspace. The center owns definitions, schedules, permissions and run history; the Result Session retains the complete output and trajectory.

The same package selects the deepest native surface available, without DOM injection or Sidebar replacement:

- **Stock compatibility mode:** unmodified DSH from `0.1.0-rc.8` through the current `0.1.2-alpha.2` exposes a global **Settings → Automations** section that works without a Session; the **Automation** Conversation tab remains a shortcut. No Shell Page Patch is required.
- **Global center mode:** when DSH exposes `sidebar.primary.action` and `shell.page`, the plugin automatically moves to a root action below **New Session** and above **Workspaces**.

> Current version: `0.1.0-alpha.8`. Compatibility validation is not a security audit.

## Install Alpha.8 from GitHub Releases

Download [dsh-automation-center-0.1.0-alpha.8.tgz](https://github.com/usersx/dsh-automation-center/releases/download/v0.1.0-alpha.8/dsh-automation-center-0.1.0-alpha.8.tgz), then install it from the download directory.

```sh
dsh plugin --profile web add ./dsh-automation-center-0.1.0-alpha.8.tgz
```

Desktop profile:

```sh
dsh plugin --profile desktop add ./dsh-automation-center-0.1.0-alpha.8.tgz
```

The Release also provides a [SHA-256 file](https://github.com/usersx/dsh-automation-center/releases/download/v0.1.0-alpha.8/dsh-automation-center-0.1.0-alpha.8.tgz.sha256), [SPDX SBOM](https://github.com/usersx/dsh-automation-center/releases/download/v0.1.0-alpha.8/dsh-automation-center-0.1.0-alpha.8.spdx.json), and GitHub/Sigstore build attestation. npm publication is complete only after fixed-version, integrity, and provenance registry readback; a GitHub Release or workflow approval is not sufficient evidence.

Fully quit and reopen DSH after installation. Use Node.js `^22.19.0` or `>=24.0.0`. Remove or disable `@dsh-external/dsh-automation`; when both schedulers are present, this plugin reports `AUTOMATION_PLUGIN_CONFLICT` instead of scheduling twice.

## Capabilities

- Cross-workspace overview, filtering, statistics and recent runs.
- One-time, fixed-interval, daily and weekly schedules with explicit IANA time zones.
- Create, edit, pause, resume, delete, run-now and cancel flows.
- A fresh root Agent and Session for every occurrence; chat sessions are never reused.
- Result Session titles derived from the automation task rather than the project.
- Read-only and workspace-write unattended policies.
- Per-automation model policy: inherit the live DSH default, or pin provider, model and reasoning effort; every Run records the effective model.
- Workspace, preset and model preflight exposes blocked definitions before a useless Session is created.
- Idempotent commands, overlap protection, deterministic claims, bounded misfire handling and conservative restart recovery.
- Supervisor phases, lease heartbeats and a whole-job deadline covering preflight through delivery.
- Derived expected/admitted/claimed/queue/progress health plus structured Outcome/Attention, attempts and side-effect uncertainty.
- Optional isolated Git worktree review with clean-base enforcement, patch hash/stat, and accept/keep/discard actions.
- Lifecycle events carry runId/revision/sequence; the model sees only tools allowed by the effective unattended policy.
- Every Run exposes a stable identity derived from Definition revision, occurrence, and Workspace scope rather than list position or a dynamic node name.
- Host, storage, and Git review cleanup retain an owner until asynchronous settling completes; interrupted accept/discard actions reconcile after restart.
- Durable write receipts with request ID, revision and `committed | rejected | unknown` outcomes, followed by an authoritative Client read.
- Durable history, summaries, Result Session links, effective model and structured error codes.
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
  ├─ stock 0.1.0-rc.8 → 0.1.2-alpha.2: settings.section + conversation.view shortcut
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

The Host-side `AutomationEngine` is the deep module. Both Client adapters, authenticated RPC, scheduler and Agent tools share its `snapshot` / `dispatch` boundary instead of accessing storage directly.

## Compatibility

| Target | Install | Surface | Status |
|---|---|---|---|
| stock DSH `0.1.0-rc.8` / Web | no patch | global Settings section + Conversation shortcut | alpha.6 full Web end-to-end pass |
| stock DSH `0.1.1-rc.2` / Web | no patch | global Settings section + Conversation shortcut | fixed npm install, Host/Client activation, no-Workspace empty state and browser-console checks pass; full Agent Run not repeated |
| stock DSH `0.1.2-alpha.1` / Web | no patch | global Settings section + Conversation shortcut | Alpha.7 local tarball install, Host/Client, create/run, failed terminal, Result Session and Attention readback pass; successful real-model Run awaits final acceptance |
| stock DSH `0.1.2-alpha.2` / Web | no patch | global Settings section + Conversation shortcut | Alpha.8 candidate install, Host/Client, Definition, direct/worktree failure paths, Result Session, Attention, and ghost-Session negative pass; successful real-model Run not run |
| macOS DSH Desktop `2.0.3` (bundled DSH `0.1.1-rc.2`) | no patch | global Settings section + Conversation shortcut | Alpha.7 final tarball upgrade, successful real-model Run, structured Outcome, Result Session, and three cold starts pass |
| DSH exposing both Shell slots / Web | same package | global root page | observed pass |
| native Windows / Linux Desktop | — | selected from target capability | not yet observed |

As of `0.1.2-alpha.2`, stock DSH still has no `sidebar.primary.action` or `shell.page`, so a plugin cannot add a true Sidebar root action through public APIs. It can still provide global management through the native `settings.section`. This project deliberately avoids a brittle DOM-injection imitation. Once the generic Shell slots land upstream, the same npm package enables Sidebar global-center mode automatically.

See the exact [alpha.8 acceptance results](docs/acceptance-results-2026-08-31-alpha.8.md), including blocked and unrun cases. The alpha.7, alpha.6 and alpha.5 records remain historical observed baselines.

## Safety boundaries

- Management RPC uses rc.8/rc.2 loopback authority and alpha.1/alpha.2 authenticated one-time-token channels; workspace/profile scope remains mandatory.
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

CI runs typecheck, tests, build and repository validation on Linux, macOS and Windows, then installs the tarball into isolated unmodified DSH `0.1.0-rc.8`, `0.1.1-rc.2`, `0.1.2-alpha.1`, and `0.1.2-alpha.2` profiles. The release workflow attaches a fixed tarball, SHA-256, SPDX SBOM, and GitHub/Sigstore build attestation; npm publication is complete only after workflow and registry readback.

## Documentation

- [Acceptance criteria (Chinese)](https://github.com/usersx/dsh-automation-center/blob/main/docs/acceptance-criteria.zh-CN.md)
- [Alpha.8 acceptance results](https://github.com/usersx/dsh-automation-center/blob/main/docs/acceptance-results-2026-08-31-alpha.8.md)
- [Technical design (Chinese)](https://github.com/usersx/dsh-automation-center/blob/main/docs/technical-design.zh-CN.md)
- [Release process](https://github.com/usersx/dsh-automation-center/blob/main/docs/releasing.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.en.md)
- [Security policy](SECURITY.md)
- [Roadmap](ROADMAP.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

## Known limitations

- Stock DSH `0.1.2-alpha.2` provides global management in Settings; a Sidebar root action still requires the two generic upstream slots.
- The `0.1.2-alpha.2` Web Alpha.8 candidate passes install, activation, RPC, direct/worktree failure paths, Result Session, and ghost-Session negative checks; a successful real-model Run was not run. The macOS Desktop 2.0.3 Alpha.7 real-model Run and three cold starts remain historical evidence.
- The first release has no distributed scheduler, remote workers or cloud credential vault.
- Cancellation cannot undo file changes or external calls that already occurred.
- This remains an Alpha; stable release gates are defined in the acceptance documents.
- DSH `0.1.2-alpha.2` cannot yet prove wire-safe redaction for complex secret-bearing Settings schemas. This plugin declares no secret Config fields and hides internal error text, but co-installed complex schemas still require an upstream fail-closed fix and re-validation.

## License

[MIT](LICENSE)

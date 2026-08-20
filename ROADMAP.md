# Roadmap

## Milestone 0 — Specification

- [x] Confirm the global sidebar entry and main-page interaction.
- [x] Define P0 acceptance criteria and release vetoes.
- [x] Define the two-repository architecture.
- [x] Publish the public project repository.

## Milestone 1 — DSH shell extension

- [x] Add `sidebar.primary.action` to the DSH Sidebar contract.
- [x] Add `shell.page` and shell-surface navigation to the root layout.
- [x] Preserve the mounted Conversation while a global page is active.
- [x] Return to Conversation from New Session and Session navigation actions.
- [x] Add GUI and assembled Web tests.

The Shell extension remains an upstream enhancement, not an installation prerequisite. Stock rc.8 uses the Conversation Surface Adapter until the generic slots are available.

## Milestone 2 — Automation engine

- [x] Port and attribute reusable MIT-licensed scheduling logic.
- [x] Implement the versioned automation domain model and repository.
- [x] Implement deterministic occurrence claims and restart recovery.
- [x] Implement fresh Agent/Session execution and unattended policy.
- [x] Add loopback RPC and workspace-scoped Agent tools.

## Milestone 3 — Automation Center client

- [x] Register the global sidebar action and shell page.
- [x] Implement the dashboard, task editor, run history, and attention queue.
- [x] Implement Result Session navigation and return action.
- [x] Cover native, collapsed, custom-theme, and Better Sidebar layouts with shell-owned action chrome.
- [x] Add automatic stock rc.8 fallback through `conversation.view` without DOM injection.

## Milestone 4 — Migration and release

- [x] Import existing `dsh_automation` v1 data without modifying the source domain.
- [x] Detect old/new plugin conflicts before starting a scheduler.
- [ ] Pass all P0 acceptance criteria on DSH Web and DSH Desktop.
- [x] Publish the first installable pre-release bundle.
- [x] Add cross-platform CI, fixed-version installation, SBOM, provenance and artifact attestation workflows.
- [ ] Complete stock rc.8 Desktop and remaining destructive/error-path observations.
- [ ] Submit the generic Shell slots upstream and list the plugin in community directories.

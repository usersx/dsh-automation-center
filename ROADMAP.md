# Roadmap

## Milestone 0 — Specification

- [x] Confirm the global sidebar entry and main-page interaction.
- [x] Define P0 acceptance criteria and release vetoes.
- [x] Define the two-repository architecture.
- [ ] Publish the public project repository.

## Milestone 1 — DSH shell extension

- [ ] Add `sidebar.primary.action` to the DSH Sidebar contract.
- [ ] Add `shell.page` and shell-surface navigation to the root layout.
- [ ] Preserve the mounted Conversation while a global page is active.
- [ ] Return to Conversation from New Session and Session navigation actions.
- [ ] Add GUI and assembled Web tests.

## Milestone 2 — Automation engine

- [ ] Port and attribute reusable MIT-licensed scheduling logic.
- [ ] Implement the versioned automation domain model and repository.
- [ ] Implement deterministic occurrence claims and restart recovery.
- [ ] Implement fresh Agent/Session execution and unattended policy.
- [ ] Add loopback RPC and workspace-scoped Agent tools.

## Milestone 3 — Automation Center client

- [ ] Register the global sidebar action and shell page.
- [ ] Implement the dashboard, task editor, run history, and review queue.
- [ ] Implement Result Session navigation and return action.
- [ ] Cover native, collapsed, narrow, dark, and Better Sidebar layouts.

## Milestone 4 — Migration and release

- [ ] Import existing `dsh_automation` v1 data without modifying the source domain.
- [ ] Detect old/new plugin conflicts before starting a scheduler.
- [ ] Pass all P0 acceptance criteria on DSH Web and DSH Desktop.
- [ ] Publish the first installable pre-release bundle.

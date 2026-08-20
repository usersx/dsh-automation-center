## Outcome

Describe the user-visible result.

## Compatibility

- [ ] Stock DSH `0.1.0-rc.8` Conversation mode remains loadable.
- [ ] Native Shell mode remains loadable when `sidebar.primary.action` and `shell.page` are present.
- [ ] Legacy `@dsh-external/dsh-automation` conflict behavior is unchanged or intentionally migrated.

## Verification

- [ ] `pnpm check`
- [ ] Packed-bundle install into an isolated profile
- [ ] Relevant acceptance IDs and observed/unrun status updated

## Safety

- [ ] Logs, screenshots, fixtures, and failure messages contain no tokens, prompts, private Home paths, or credentials.
- [ ] New unattended capabilities have an explicit permission boundary and fail closed.

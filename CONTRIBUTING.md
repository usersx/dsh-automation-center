# Contributing

Thank you for improving DSH Automation Center. Chinese and English reports are both welcome.

## Before opening an issue

1. Search existing issues.
2. Record the exact plugin version, DSH version/distribution, OS and selected surface.
3. Reproduce with the original DeepSeek skin and with unrelated plugins disabled when possible.
4. Remove prompts, tokens, credentials, Home paths and private Workspace content from logs and screenshots.

Use the Bug form for defects. Use a private GitHub security advisory for vulnerabilities or credential exposure.

## Development

Requirements: Node.js `^22.19.0` or `>=24.0.0`, and pnpm `10.32.1`.

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` must pass type checking, build, tests and repository-contract validation. Changes to Surface selection need tests for both stock `conversation.view` and global Shell mode.

## Pull requests

- Keep changes narrowly scoped and explain the user-visible behavior.
- Add or update tests before changing release claims.
- Distinguish automated, observed, blocked and unrun evidence.
- Do not add DOM injection or replace the DSH Sidebar to emulate missing upstream slots.
- Do not log prompts, environment variables, access tokens or private host paths.
- Update `CHANGELOG.md` under an unreleased or target-version section.

Maintainers may request an isolated-profile installation receipt before merging a compatibility change.

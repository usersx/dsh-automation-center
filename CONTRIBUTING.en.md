<p align="center">
  <a href="CONTRIBUTING.md">简体中文</a> · <strong>English</strong>
</p>

# Contributing

Thank you for improving DSH Automation Center. Issues and pull requests are welcome in Chinese or English.

## Choose the right channel

- Reproducible defects, UI regressions, or compatibility failures: use the [Bug report](https://github.com/usersx/dsh-automation-center/issues/new?template=bug.yml).
- New behavior or product changes: use the [Feature proposal](https://github.com/usersx/dsh-automation-center/issues/new?template=feature.yml) and reference the relevant [acceptance criteria](docs/acceptance-criteria.zh-CN.md).
- Vulnerabilities, credential exposure, or permission-boundary bypasses: use [GitHub Private Vulnerability Reporting](https://github.com/usersx/dsh-automation-center/security/advisories/new), never a public issue.
- Usage questions: check the [README](README.en.md), known limitations, and existing issues first.

Search existing issues and, when possible, confirm that a defect still reproduces on the latest published version.

## Reproducible bug reports

A useful report includes:

1. Exact plugin version, installation source, and DSH version.
2. Web/Desktop distribution, OS, Node.js/pnpm versions, and profile name.
3. Whether the failure occurs in stock `conversation.view` or global Shell mode with `sidebar.primary.action` / `shell.page`.
4. Whether a Workspace exists and whether legacy `@dsh-external/dsh-automation` is disabled.
5. Minimal steps, expected behavior, actual behavior, and the last known working version.

For scheduled-run defects, include a sanitized timezone, trigger type, timeout, and permission preset. Do not include the task prompt.

Prefer the original DeepSeek skin in screenshots. If a defect is skin-specific, include the original-skin comparison result too.

## Data and log safety

Public issues, fixtures, screenshots, and logs must not contain:

- API tokens, cookies, credentials, environment-variable values, or full request headers;
- private prompts, model output, Workspace contents, or absolute Home paths;
- internal domains, private repository URLs, Session data, or personal information.

Replace sensitive values with `<redacted>`, `<workspace>`, and `<home>`. Use a private security report when evidence cannot be safely sanitized.

## Local development

Use Node.js `^22.19.0` or `>=24.0.0`, and pnpm `10.32.1`.

```sh
pnpm install --frozen-lockfile
pnpm check
```

`pnpm check` runs type checking, build, tests, and repository-contract validation. Do not submit generated `lib/` changes without the corresponding source and tests.

### Verification by change type

- Surface selection: cover both stock `conversation.view` and global Shell mode.
- Scheduler/timezone: cover once, interval, daily, weekly, misfire, and restart recovery.
- Execution/permissions: cover success, model unavailable, permission denied, timeout, cancellation, and Host interruption.
- UI: verify the original light/dark skins, no Workspace, narrow window, and no active Session where relevant.
- Compatibility claims: distinguish automated pass, observed pass, blocked, and unrun evidence.

Changes to installation, Surface, Bundle, or lifecycle behavior also need a packed isolated-profile check:

```sh
npm pack
dsh plugin --profile <test-profile> add ./dsh-automation-center-<version>.tgz
dsh --profile <test-profile> --dump-config
```

A successful development-directory load is not a substitute for installing the `.tgz` artifact.

## Pull request workflow

1. Create a feature branch from the latest `main`; do not commit directly to `main`.
2. Keep the change focused and reversible, and describe user-visible behavior and non-goals.
3. Add tests for new behavior; fixes should include a regression test when practical.
4. Update the `Unreleased` or target-version section in `CHANGELOG.md`.
5. Run `pnpm check`; include isolated-profile evidence for compatibility changes.
6. Mark verified, blocked, and unrun checklist items honestly.

Maintainers may request real-device evidence for stock DSH, Desktop, or specific failure paths. Green CI is a merge prerequisite, not proof that every acceptance path passed.

## Design constraints

- Reuse DSH/Cordis services, slots, and lifecycle seams; do not copy the Sidebar through DOM injection.
- Keep the Automation Engine independent from UI Surfaces; the Session tab and global center share one domain layer.
- Unattended execution must use least privilege, fail closed, and preserve auditable Result Sessions.
- Never write prompts, tokens, environment variables, or private host paths to RPC, logs, or public reports.

By submitting code, you agree to license the contribution under the project's [MIT License](LICENSE).

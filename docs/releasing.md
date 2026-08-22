# Release process

Releases are produced by `.github/workflows/release.yml`; local `npm publish` is not the supported path.

## One-time repository setup

1. In npm package settings, configure a GitHub Actions Trusted Publisher for repository `usersx/dsh-automation-center` and workflow `release.yml`.
2. Protect `main` and require the CI workflow.
3. Enable private vulnerability reporting.

No long-lived `NPM_TOKEN` is required or expected.

## Release checklist

1. Update `package.json`, both READMEs and `CHANGELOG.md` to the same version.
2. Run `pnpm check` on a supported Node version.
3. Confirm the stock rc.8 install job passes on GitHub Actions.
4. Confirm the acceptance record distinguishes automated, observed, blocked and unrun cases.
5. Merge to `main`, then create a GitHub Release whose tag is exactly `v<package version>`.
6. Mark Alpha/Beta/RC releases as pre-releases; stable versions are normal releases.

The workflow re-runs checks, packs one tarball, generates a checksum and SPDX JSON SBOM, attests the tarball with GitHub/Sigstore, publishes to npm with provenance, and attaches the evidence to the GitHub Release.

## Verification

```sh
npm view dsh-automation-center@0.1.0-alpha.6 version dist.integrity dist.tarball
gh release view v0.1.0-alpha.6 --repo usersx/dsh-automation-center
```

The fixed-version install command is the reproducible recommendation. `@latest` is a convenience alias and can change over time.

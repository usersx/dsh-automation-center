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
3. Confirm the stock DSH install matrix passes for the minimum supported tag (`dsh-v0.1.0-rc.8`), the last RC (`dsh-v0.1.1-rc.2`), and the current latest tag (`dsh-v0.1.2-alpha.2`); retain alpha.1 as a regression row while it remains in CI.
4. Confirm the acceptance record distinguishes automated, observed, blocked and unrun cases.
5. Merge to `main`, then create a GitHub Release whose tag is exactly `v<package version>`.
6. Mark Alpha/Beta/RC releases as pre-releases; stable versions are normal releases.

The workflow re-runs checks, packs one tarball, generates a checksum and SPDX JSON SBOM, attests the tarball with GitHub/Sigstore, publishes to npm with provenance once the Trusted Publisher is configured, and attaches the evidence to the GitHub Release. Alpha.6 was the package bootstrap release and was first published through an authenticated npm CLI; its GitHub attestation must not be described as npm registry provenance.

## Verification

```sh
npm view dsh-automation-center@0.1.0-alpha.8 version dist.integrity dist.tarball --json
npm view dsh-automation-center@0.1.0-alpha.8 dist.attestations --json
gh release view v0.1.0-alpha.8 --repo usersx/dsh-automation-center
```

The fixed-version install command is the reproducible recommendation. `@latest` is a convenience alias and can change over time.

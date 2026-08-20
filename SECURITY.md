# Security Policy

## Supported versions

Only the latest published pre-release or stable version receives security fixes while the project remains in Alpha.

## Reporting a vulnerability

Please use [GitHub private vulnerability reporting](https://github.com/usersx/dsh-automation-center/security/advisories/new). Do not open a public issue for credential exposure, path traversal, authorization bypass, arbitrary command execution or sandbox escape.

Include the affected plugin and DSH versions, platform, minimal reproduction, impact and any suggested mitigation. Remove real secrets and private Workspace data.

## Security boundaries

- Compatibility validation is not a security audit.
- The plugin runs inside the local DSH Host and inherits its operating-system identity.
- Workspace-write automations can modify files and invoke permitted tools.
- Cancellation prevents future work but cannot roll back completed external side effects.
- The management interface is intended for trusted loopback clients only.

Published artifacts are expected to include npm provenance, a GitHub/Sigstore build attestation, SHA-256 checksum and SPDX SBOM. Verify evidence against the matching GitHub Release before installation when supply-chain integrity matters.

# DSH Automation Center

[中文](README.zh.md) | English

DSH Automation Center is a planned global automation workspace for DeepSeek Harness. It is designed to appear directly below **New Session** and above **Workspaces** in the left sidebar. Opening it switches the main content area to an Automation Center where users can create, manage, run, and review scheduled coding tasks.

Each run starts in a fresh DSH Session. The Session is the run result and audit trail, not the place where automations are managed.

## Project status

This repository is currently in the **pre-alpha specification phase**. It contains the accepted product requirements, technical design, release gates, and implementation roadmap. It is not yet an installable DSH bundle.

Implementation depends on two generic DSH client extension points that are not currently available in the target source tree:

- `sidebar.primary.action`
- `shell.page`

The project will not use DOM injection or replace the complete Sidebar. Installation instructions will be added only after the upstream shell extension is available and the P0 acceptance suite passes.

## Documents

- [Acceptance criteria (Chinese)](docs/acceptance-criteria.zh-CN.md)
- [Technical design (Chinese)](docs/technical-design.zh-CN.md)
- [Roadmap](ROADMAP.md)

## Development

The repository currently has no third-party runtime dependencies. Validate the specification repository with:

```sh
npm run check
```

## License

[MIT](LICENSE)

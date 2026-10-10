# Versioning and releases

The toolkit is maintained in the public `ahzs645/geo-toolkit` repository under
the MIT license. The package keeps `private: true` until registry publication
is configured. CI verifies artifacts without publishing them.

## Supported surface

`API.md` identifies the supported entry points. Fine-grained implementation
paths retained for PG Maps compatibility are provisional. Keep existing paths
working during this extraction; migrate host imports before removing them.

Before 1.0, a minor version can change a supported API or its observable
behavior. Patch releases preserve signatures and documented semantics. Record
changes to scoring, missing values, classification boundaries, scene behavior,
responsive defaults and peer requirements even when TypeScript still compiles.
At 1.0, follow semantic versioning: breaking changes require a major version.

## Release verification

From this repository, run:

```sh
npm run check
npm run lint
npm run format:check
npm run test
npm run example:build
npm run watch:check
npm run example:test
npm run nested:test
npm run pack:check -- --browser
```

Also run the host's affected compatibility/browser tests and TypeScript build.
The toolkit workflow exercises package and independent-consumer checks without
scraper data. The packed consumer resolves real compiled exports outside the
repository, rather than relying on application aliases.

Keep the existing MIT license and contributor attribution in each artifact.
Third-party datasets, services, attribution and permissions remain the host's
responsibility; the toolkit license does not relicense them.

## Consumer updates

PG Maps consumes this repository as a pinned Git submodule at
`packages/geo-toolkit`, retaining its npm workspace link and compatibility tests.
Commit and push changes here first, then update and validate the host pointer.
Updating this repository alone does not update deployed websites.

For other consumers, `npm pack` produces a tarball containing compiled exports,
CSS and documentation. Install that artifact until a registry release is available.

Before a registry release, remove `private`, configure the package scope, choose
a version, record behavior changes and run the checks above against the exact
artifact. No registry credentials or automated publication are included here.

# Geographic toolkit

This public repository is the source of truth for `@pgmaps/geo-toolkit`.

- Keep source free of PG Maps imports, aliases, environment variables and datasets.
- Keep calculation normalization separate from display classification; preserve source resolution, missing values and uncertainty.
- Each workspace owns its theme, events, responsive layout and card state.
- Read API.md before changing exports and RELEASING.md before changing versions.
- Run npm run check, npm run lint, npm run format:check, npm test and npm run example:build for relevant changes.
- Build with npm run build or run npm run watch before testing compiled exports.
- Use the independent example and packed consumer to verify package boundaries.
- PG Maps pins this repository as a submodule. Commit and push toolkit changes first, then update the host pointer.

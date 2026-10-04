# Starculator

Free, no-login Star Citizen cargo tools. The flagship is a mission-driven **3D cargo planner**: pick a ship, see its exact cargo grids as 1.25 m cells, add the containers from your hauling contracts and get a load plan with fill level and loading order.

Ship data comes from game files published by the Star Citizen Wiki team ([scunpacked-data](https://github.com/StarCitizenWiki/scunpacked-data)), ingested at build time and versioned per game build.

## Develop

```sh
pnpm install
pnpm dev          # http://localhost:5173
pnpm check        # svelte-check
pnpm lint         # prettier + eslint
pnpm test:unit    # vitest (node + browser projects)
pnpm build        # static site in build/ (every /cargo/<ship>/ page is prerendered)
pnpm preview      # serves build/ on http://localhost:4173
```

Requires Node ≥ 22.17 and pnpm 10. Playwright's Chromium is needed for the browser test project (`npx playwright install chromium`).

### Ship data

The ship and cargo-grid data under `src/lib/data/generated/` is committed and produced by

```sh
node scripts/ingest-ships.ts            # pinned scunpacked-data commit, cached in node_modules/.cache
node scripts/ingest-ships.ts --sha <commit> --version <game build> --date <iso date>
```

The script validates every grid (1.25 m multiples, grid SCU sums equal the ship's cargo), folds variants with identical holds under one hull, applies the hand-maintained corrections in `src/lib/data/overrides.json`, and writes `meta.json`, `index.json`, `variants.json` and one file per ship. Run `pnpm vitest run src/lib/data` afterwards: the tests assert the invariants the app relies on.

### Screenshots

`node scripts/screenshot.mjs <url> <out.png> [--width 1440|390 --height 900|844 --full --wait ms]` renders a page in Chromium (software WebGL, so the 3D hold works headless). The prototype screenshots in `docs/screenshots/` were taken this way.

## How it works

- **Data** (`src/lib/data`): typed contracts in `types.ts`, generated JSON, container table and overrides.
- **Packer** (`src/lib/packer`): a dependency-free lattice packer (first-fit decreasing over 1.25 m cells, gravity, per-grid container sizes, door-aware depth scoring, unload-order grouping, seeded restarts) that runs in a Web Worker in the browser.
- **Hold viewer** (`src/lib/three`): Threlte scene with the cargo grids as translucent volumes, containers as instanced boxes, a perspective and an orthographic top view. Grid positions inside a ship are not in the game data, so multi-grid ships are laid out schematically until curated offsets exist.
- **State** (`src/lib/state`): a runes `Plan` store per ship, a compact URL codec (`?g=Covalex:32x4,16x2;Red Wind:8x6&v=top`), IndexedDB persistence (Dexie) and JSON export/import.
- **UI** (`src/lib/components`, `src/routes`): the "freight deck after hours" shell from `docs/design.md`.

## Stack

SvelteKit 3 · Svelte 5 · TypeScript 6 · Vite 8 · Tailwind 4 · Threlte 8 / Three.js r186 · Dexie · adapter-static.

## Docs

- [Project plan](docs/PLAN.md)
- [Design brief](docs/design.md)
- [Research](docs/research/)

## License

MIT. This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of companies. Star Citizen®, Roberts Space Industries® and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC.

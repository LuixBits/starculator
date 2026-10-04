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
pnpm build        # static site in build/
pnpm preview
```

Requires Node ≥ 22.17 and pnpm 10. Playwright's Chromium is needed for the browser test project (`npx playwright install chromium`).

## Stack

SvelteKit 3 · Svelte 5 · TypeScript 6 · Vite 8 · Tailwind 4 · Threlte 8 / Three.js r186 · Dexie · adapter-static.

## Docs

- [Project plan](docs/PLAN.md)
- [Design brief](docs/design.md)
- [Research](docs/research/)

## License

MIT. This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of companies. Star Citizen®, Roberts Space Industries® and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC.

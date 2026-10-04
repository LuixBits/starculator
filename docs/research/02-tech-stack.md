# Research: Svelte / Threlte tech stack for the rebuild

> Research snapshot taken 2026-10-04. All versions were read from the npm registry (dist-tags + publish dates) or from the projects' GitHub source. Several documentation sites (svelte.dev, threlte.xyz, developers.cloudflare.com, threejs.org) were blocked by the research sandbox; their content was read from the corresponding GitHub repositories instead. A throwaway `sv create` scaffold was run to confirm what the CLI produces today.

**Headline:** SvelteKit 3.0.0 shipped on 2026-10-01 together with `sv` 1.1, adapter-static 4, adapter-node 6 and adapter-cloudflare 8. It requires Vite 8, TypeScript 6 (not 7), Svelte ≥ 5.57.1 and Node ≥ 22.17, moves all config into `vite.config.ts` and replaces `$lib` with `#lib`. The ecosystem is still catching up (PWA plugin, Storybook CSF, runed peer ranges). Threlte 8 + Three r186 are solid and have a WebGPU path. For packing, write a small custom cell-grid packer: no JS library models gravity, per-grid max container size or multi-grid ships.

## 1. Recommended stack

| Layer | Package | Version verified (npm, date) | Why |
|---|---|---|---|
| Framework | `svelte` | 5.57.1 (2026-09-18) | Runes stable; required ≥ 5.57.1 by Kit 3 |
| App framework | `@sveltejs/kit` | 3.0.0 (2026-10-01) | Config in vite.config, `#lib`, better service-worker/env APIs. 2.x latest is 2.70.3 (2026-08-18) if we prefer to wait |
| Vite plugin | `@sveltejs/vite-plugin-svelte` | 7.3.1 | Required by Kit 3 |
| Bundler | `vite` | 8.3.2 (2026-10-01) | Rolldown-based; Kit 3 needs ≥ 8.0.12 |
| Scaffold | `sv` | 1.1.0 (2026-10-04) | `npx sv create` scaffolds Kit 3; `sv migrate sveltekit-3` exists |
| Language | `typescript` | **6.0.3** (pin `^6.0.3`; npm `latest` is 7.0.2) | Kit 3 peer `^6`; svelte-check peer `^5 ‖ ^6`; typescript-eslint `< 6.1`. TS 7 (Go port) breaks svelte-check without an experimental flag |
| Runtime | Node | 24.x LTS (maintenance from 2026-10-20); 26.x becomes LTS 2026-10-28 | Kit 3 needs ≥ 22.17 |
| Adapter (v1) | `@sveltejs/adapter-static` | 4.0.0 | Prerender everything → nginx or Cloudflare static |
| Adapter (later) | `@sveltejs/adapter-cloudflare` / `adapter-node` | 8.0.0 / 6.0.0 | Workers static assets or Docker |
| 3D | `three` + `@types/three` | 0.186.1 / 0.186.0 | r186; `three/webgpu`, `three/tsl` exports present |
| 3D for Svelte | `@threlte/core` | 8.6.1 (peers svelte ≥ 5, three ≥ 0.172) | Svelte-5-native; `@threlte/core/webgpu` entry since 8.6.0 |
| 3D helpers | `@threlte/extras` | 9.22.0 | InstancedMesh/Instance, OrbitControls, CameraControls, TransformControls, Gizmo, HTML, Grid, Edges, GLTF, interactivity |
| Styling | `tailwindcss` + `@tailwindcss/vite` | 4.3.3 | CSS-first `@theme` config; `sv add tailwindcss` |
| Components | `shadcn-svelte` + `bits-ui` | 1.7.0 / 2.19.5 | Runes-native, Tailwind v4, copy-paste ownership; Kit 3 support issue closed 2026-09-01 |
| Icons | `@lucide/svelte` | 1.52.0 | `lucide-svelte` is deprecated |
| Tables | `@tanstack/svelte-table` | 9.2.5 | First runes-native adapter |
| Charts | `layerchart` | 2.5.1 | shadcn-svelte `chart` is built on it |
| Forms | `sveltekit-superforms` + `formsnap` | 2.31.0 / 2.0.1 | Works client-only for a static site |
| State persistence | `runed` (PersistedState) or `svelte-persisted-state` | 0.37.1 / 1.4.1 | runes-based; the latter also does IndexedDB |
| IndexedDB | `dexie` or `idb-keyval` | 4.4.6 / 6.3.0 | Dexie for structured loadouts/missions |
| Unit tests | `vitest` | 5.0.3 (sv pins `^4.1.8`) | Browser mode via `@vitest/browser-playwright` + `vitest-browser-svelte` 3.1.0 |
| E2E | `@playwright/test` | 1.63.0 | E2E only; Svelte component testing removed in 1.59 |
| Type check | `svelte-check` | 4.7.6 | Understands Kit 3 flattened config |
| Lint/format | `eslint` 10.12, `eslint-plugin-svelte` 3.23, `typescript-eslint` 8.71, `prettier` 3.9.9, `prettier-plugin-svelte` 4.1.1 | current | Flat config from `sv add eslint prettier` |
| PWA | SvelteKit native `src/service-worker/` | — | `@vite-pwa/sveltekit` 1.1.0 still peers Kit ^1 ‖ ^2 only |
| Package manager | `pnpm` | 12.9.1 | Cheap path to workspaces later |

**Scaffold command (verified by running it):**

```sh
npx sv@1.1.0 create starculator --template minimal --types ts \
  --add prettier eslint vitest="usages:unit,component" playwright="demo:no" \
  tailwindcss sveltekit-adapter="adapter:static"
```

This produced `@sveltejs/kit ^3.0.0`, `vite ^8.3.0`, `typescript ^6.0.3`, `svelte ^5.57.1`, `vitest ^4.1.8`, `eslint ^10.4.1`, `tailwindcss ^4.3.0`, a `package.json` `"imports": {"#lib": "./src/lib/index.js", "#lib/*": "./src/lib/*"}`, **no `svelte.config.js`**, a `tsconfig.json` extending `$app/tsconfig`, and `vite.config.ts` with `sveltekit({ compilerOptions, adapter })`. The vitest add-on configures two projects: `client` (browser/chromium, `*.svelte.test.ts`) and `server` (node).

## 2. SvelteKit 3 + Svelte 5

**Runes** are stable since Svelte 5.0; `sv` forces runes mode project-wide. `$app/stores` is removed in Kit 3 → use `$app/state`. Async Svelte (`await` in components) and remote functions are still experimental. Svelte 6 has no announced date.

**Kit 3 breaking changes that matter here** (from `documentation/docs/60-appendix/35-migrating-to-sveltekit-3.md`):

- Config moves to `sveltekit({...})` in `vite.config.ts`; `svelte.config.js` is not read.
- `$lib` → `#lib` (Node subpath imports); imports need file extensions.
- `$service-worker` removed → `$app/service-worker`, `$app/manifest`, `$app/env`; the service worker lives in `src/service-worker/index.ts`.
- `$app/paths` `base`/`assets` removed → `asset()` / `resolve()`.
- `invalidateAll` → `refreshAll`; `page.url` readonly.
- Node ≥ 22.17, TS ≥ 6, Vite ≥ 8.0.12.

**SvelteKit (adapter-static) vs plain Vite + Svelte SPA:** SvelteKit is recommended. File routing for many tools (`/cargo`, `/trade`, `/mining`), prerendering for instant first paint and SEO per tool landing page, first-class service worker, `+server.ts` BFF later without re-platforming, `sv` tooling. Cost: stay SSR-aware. Threlte's `<Canvas>` is SSR-safe by construction (its scene subtree only renders after `bind:this`), so prerendering tool pages works. Pattern: adapter-static with `export const prerender = true` globally and a `fallback: '200.html'` only for truly dynamic routes.

## 3. Threlte

- **Versions:** `@threlte/core` 8.6.1, `@threlte/extras` 9.22.0, `@threlte/rapier` 3.5.1, `@threlte/xr` 1.6.1, `@threlte/studio` 0.4.4, `@threlte/flex` 2.2.2, `@threlte/gltf` 3.1.0, `@threlte/test` 2.1.0. Threlte 8 is the Svelte 5 rewrite (callback props, reworked plugin API).
- **Three.js compat:** three 0.186.1 works (extras 9.22.0 fixed types for r183+). Caveat: Threlte's own monorepo still pins three ^0.185, Kit ^2.37, Vite 7, TS 5.9, so **Vite 8 / Kit 3 / TS 6 is not exercised upstream yet**; peer ranges allow it and no open issues were found.
- **Instancing:** `<InstancedMesh limit={N}>` with a geometry + material and child `<Instance position color onclick>`; `id` prop for multiple pools. Interactivity events carry `instanceId`. Fine for hundreds to a few thousand boxes; beyond that use a raw `THREE.InstancedMesh` via `<T is={mesh}>` and write matrices in `useTask`.
- **Controls:** `<OrbitControls>`, `<CameraControls>` (better touch), `<TrackballControls>`; `<Gizmo>` for snap-to-axis views.
- **Transform / drag:** `<TransformControls>` exists; **no built-in drag-and-drop**. Implement with the `interactivity()` plugin: pointerdown on a box → raycast onto a plane on pointermove → snap to the 1.25 m lattice → validate with the packer → pointerup. Set `touch-action: none` on the canvas wrapper.
- **Useful extras:** `<Grid cellSize={1.25} sectionSize={2.5}>` (exactly the SCU lattice), `<Edges>`, `<HTML>` overlays, `<Bounds>`, `<PerfMonitor>`, `<Suspense>`, `<GLTF>` / `useGltf()`.
- **Canvas props:** `renderMode` default `'on-demand'` (good for tablets), `dpr` clamp, `toneMapping` default AgX.
- **SSR gotchas:** `<Canvas>` is SSR-safe; one `<Canvas>` per page (avoid too many WebGL contexts); WebGPU needs `build.target: 'esnext'`; Threlte had an `{#each}` regression in 8.4.0 (closed 2026-03), so pin exact versions.
- **Alternatives:** raw Three.js (imperative; can be embedded via `<T is>`), Babylon.js (heavier, no Svelte binding), svelte-cubed (dead). Threlte is the only maintained Svelte-native option.

## 4. 3D bin packing: custom cell-grid packer

**Library survey**

| Library | Version | Notes |
|---|---|---|
| `binpackingjs` | 4.1.0 (2026-05), MIT, TS | Pivot-based 3D packing, rotations, max weight; rectangular bins only; **no gravity/support**, no per-bin max item size, no multi-compartment |
| `@0xdoublesharp/bin-packing-wasm` | 0.4.0 (2026-09), MIT, Rust→WASM | 29 algorithms (Extreme Points, Guillotine, layer building, DBLF, FFD/BFD, GRASP, local search); **no gravity/stability, rectangular bins only** |
| `3d-bin-packing`, `packme`, `bin-packing-3d` | 2017–2023 | abandoned or toys |

**Why custom:** the problem is a discrete lattice problem, not continuous 3D bin packing. Every dimension is a multiple of 1.25 m (verified across all 320 ships), there are only 7 item shapes, boxes must rest on the floor or other boxes, each grid has a `MaxSize`, ships have up to 25 separate grids, and loading order should respect the door/ramp. No library models any of that, and a grid of a few hundred cells is tiny enough for brute-force scanning. Keep a library only as an optional cross-check.

**Container shapes in cells (x, y, z × 1.25 m):** 1 SCU (1,1,1); 2 (2,1,1); 4 (2,2,1); 8 (2,2,2); 16 (2,4,2); 24 (2,6,2); 32 (2,8,2).

**Algorithm (First-Fit Decreasing + deepest-bottom-left corner placement with support test, per lattice):**

```ts
type Cell = { x: number; y: number; z: number };           // integer lattice coords
type Grid = { id: string; size: Cell; maxBox: Cell; minBox: Cell;
              occupied: Uint8Array;                         // size.x*size.y*size.z
              door?: 'px'|'nx'|'py'|'ny'; mask?: Uint8Array }; // mask supports L-shapes
type Shape = { scu: 1|2|4|8|16|24|32; dims: Cell };
type Item  = { id: string; shape: Shape; group?: string; uprightOnly?: boolean };
type Placement = { itemId: string; gridId: string; at: Cell; dims: Cell };

function pack(grids: Grid[], items: Item[], opts = { support: 1.0, allowRotations: true }) {
  // 1. Biggest first (FFD), stable by user order; same-SCU boxes stay grouped
  items.sort((a, b) => b.shape.scu - a.shape.scu);
  for (const item of items) {
    let best;
    for (const g of grids) {                                // 2. grid preference: user order, else largest first
      for (const dims of orientations(item, g)) {           // axis-aligned permutations filtered by min/maxBox
        for (const at of candidatePositions(g, dims)) {     // 3. corner points: floor cells + tops of placed boxes
          if (!fits(g, at, dims)) continue;                 // inside size, mask == 1, no overlap
          if (supportFraction(g, at, dims) < opts.support) continue;   // 4. gravity
          const score = [ at.z,                             // lowest first
                          distanceFromDoor(g, at, dims),    // deepest-from-door first (load back to front)
                          -contactArea(g, at, dims),        // compactness
                          at.y, at.x ];                     // deterministic tiebreak
          if (!best || lexLess(score, best.score)) best = { score, p: { itemId: item.id, gridId: g.id, at, dims } };
        }
      }
      if (best && opts.firstFit) break;
    }
    if (best) { mark(grids, best.p); placed.push(best.p); } else unplaced.push(item);
  }
  return { placed, unplaced, fill: grids.map(g => occupiedCells(g) / usableCells(g)) };
}
// Cost ≈ items × grids × orientations(≤6) × cells(≤500) × fits(≤32) ≈ 1e6–1e7 ops for a few hundred boxes.
// supportFraction = (# base cells at z-1 that are floor or occupied) / (dims.x*dims.y).
```

Design notes: one lattice per `CargoGrid` plus an optional mask; a hand-authored door face per grid for the popular haulers; 3–8 randomised restarts (or group-swap local search) keep the best by (unplaced, fill), still well under 100 ms in a Web Worker; keep the packer a pure, dependency-free TS module with Vitest fixtures (Titan, Cutlass, Caterpillar, Hull C); convert lattice placements to metres only at the render boundary. Literature: Crainic, Perboli & Tadei, "Extreme Point-Based Heuristics for Three-Dimensional Bin Packing" (INFORMS JoC 2008).

## 5. UI / styling

- **Tailwind 4.3.3** via `@tailwindcss/vite`. CSS-first `@theme` suits a dark sci-fi palette.
- **shadcn-svelte 1.7.0** on **Bits UI 2.19.5**: Svelte 5 + Tailwind v4 native, copy-paste components you own; best fit for forms, tables (TanStack v9), dialogs, command palette, sheets, tooltips. Caveat: set aliases to `#lib/...` during `init` on Kit 3.
- Alternatives: Skeleton 5 (good theme engine, fewer dashboard primitives), Melt UI (legacy package stale; the rewrite `melt` 0.44 is young), daisyUI (fights custom styling, no headless a11y).
- Icons `@lucide/svelte`; charts LayerChart; data grids TanStack Table v9.

## 6. State, persistence and the backend question

- Runes-based `.svelte.ts` modules exporting `$state`. Persist with `runed` `PersistedState` (expect a harmless peer warning on Kit 3 until bumped) or `svelte-persisted-state`. For structured data (fleet, missions, saved packings) use **Dexie** with versioned schemas. Version saved JSON (`schemaVersion`) from day one.
- **Backend for v1: not needed.** Packing, ship data and trade math run client-side; ship data ships as build-time JSON. Add JSON import/export for portability.
- Later backend options, ranked for a solo dev: (1) SvelteKit `+server.ts` on **Cloudflare Workers** with KV or D1 (free tier: 100k requests/day, static assets free; D1 free 5 GB total). (2) **PocketBase** 0.40 (single Go binary, SQLite, auth, realtime) in the existing Docker stack. (3) Supabase (free projects pause after 7 days of inactivity). (4) Keep Symfony/Postgres only if PHP is wanted.

## 7. Deployment

| Option | How | Pros | Cons |
|---|---|---|---|
| **A. adapter-static behind existing nginx + Cloudflare Tunnel** | `prerender = true` in root layout; copy `build/` into `nginx/html`; `try_files $uri $uri.html $uri/ /200.html` | Zero infra change; Cloudflare already caches | Home-server uptime; manual build/copy; no server routes |
| B. adapter-node in Docker | `node:24-alpine`, behind the tunnel | Enables `+server.ts`, SSR, cron | Another always-on container; still home-hosted |
| **C. adapter-cloudflare → Workers static assets** | `sv add sveltekit-adapter="adapter:cloudflare+cfTarget:workers"`, `wrangler deploy` or Workers Builds git integration | Free tier generous, edge, no home server, KV/D1 adjacent; Cloudflare says "start new projects with Workers" | adapter 8 removed platform emulation; 10 ms CPU on free; no Durable Objects via adapter |

**Build-time vs runtime data:** ship/grid data changes only per game patch → ingest at build (`scripts/ingest-ships.ts` pulls `ships.json` from scunpacked-data, trims to a few hundred KB, writes versioned JSON, committed for reproducible builds). Volatile data (UEX prices) → runtime fetch, later proxied through a Worker to hide the token and respect UEX's 12 h cache TTL.

## 8. Monorepo

**No monorepo now.** One SvelteKit app:

```
src/lib/packer/        pure TS lattice packer + Vitest fixtures
src/lib/data/          generated ship JSON + types + overrides
src/lib/components/    shadcn-svelte + app components
src/lib/three/         Threlte scene components
src/routes/(tools)/cargo, /trade, /mining …
scripts/ingest-ships.ts
```

Use pnpm from day one so converting to a workspace later is a folder move plus `pnpm-workspace.yaml`. Add Turborepo only with ≥ 2 apps/packages with slow independent builds. Trigger to split: a separately deployed service (Worker cron ingesting UEX data, Discord bot) that imports the same types/packer.

## 9. Testing / quality

- Vitest 5.0.3 current; `sv add vitest` pins `^4.1.8` (Storybook addon-vitest targets 4). Component tests in a real browser via `vitest-browser-svelte`. Packer = plain node tests.
- Playwright 1.63 for E2E only; Svelte component testing was removed in 1.59.
- svelte-check 4.7.6 works with TS 6. ESLint 10 flat config + eslint-plugin-svelte 3.23 + typescript-eslint 8.71; Prettier 3.9.9 + plugin-svelte 4.1.1 + plugin-tailwindcss.
- Storybook 10.6.1 works but has an open Kit 3 config issue (#36491); optional for a solo dev.

## 10. PWA / offline

- `@vite-pwa/sveltekit` 1.1.0 is not updated for Kit 3. **Kit 3's native route is enough for v1:** `src/service-worker/index.ts` is auto-registered; `$app/manifest` gives the asset lists; the docs ship a precache + network-first template. Add a hand-written `static/manifest.webmanifest` and icons → installable second-screen app, fully offline since all data is static.
- Second-screen tips: `renderMode="on-demand"`, `dpr={[1, 2]}`, `touch-action: none`, `CameraControls` for touch.

## 11. Performance

- Hundreds of boxes: one `<InstancedMesh>` per container size (7 pools) → ≤ 7 draw calls; `<Edges>` only on the selected box. Thousands (Hull C as 4,608 1-SCU boxes): raw `THREE.InstancedMesh` + `useTask`.
- Three r186: `WebGPURenderer` auto-falls back to WebGL2; `Clock` deprecated → `Timer`; `PCFSoftShadowMap` removed for WebGPU.
- WebGPU availability (caniuse, Oct 2026): ~86% of users; macOS Safari only on Tahoe (26); Firefox only Windows + Apple-silicon macOS 26; Linux hardware-dependent. WebGL2 fallback stays necessary.
- Threlte WebGPU: `@threlte/core/webgpu` + `@threlte/extras/webgpu`; InstancedMesh, GLTF, interactivity, Grid, HTML work; `<Outlines>`, `<Text>`, `<Sky>`, `<ContactShadows>`, `<PerfMonitor>` still throw. **Ship WebGL for v1**, keep WebGPU behind a flag.

## 12. Risks / unknowns

1. **SvelteKit 3 is 3 days old.** Expect peer warnings and small breakages for 1–3 months (`@vite-pwa/sveltekit`, `runed`, Storybook CSF, shadcn alias quirks). Mitigation: pin exact versions, or start on Kit 2.70.3 and run `sv migrate sveltekit-3` later.
2. **TypeScript 7 is npm `latest`.** `npm i -D typescript` without a range breaks svelte-check / typescript-eslint / Kit 3 peers. Pin `^6.0.3`.
3. **Threlte on Vite 8 / Kit 3 / TS 6 / three 0.186** is allowed by peers but not exercised upstream. Pin exact, upgrade deliberately, keep `three` / `@types/three` in lockstep.
4. **Vitest 4 vs 5:** either is fine; don't mix 5 with `@storybook/addon-vitest` 10.6.
5. **Node LTS transition:** use `node:24` now, move to 26 after 2026-10-28.
6. **Game-data licensing/stability:** scunpacked-data has no LICENSE; grids change per patch. Version the ingested JSON and show the game version in the UI.
7. **Gravity/support semantics in-game** unverified; model as a configurable support threshold.
8. **Door/ramp faces are not in the data**; hand-author per ship.
9. **WebGPU extras gaps**; stay on WebGL for v1.
10. **Home-server availability vs free Cloudflare Workers**; the adapter swap is one line.
11. **Playwright component testing for Svelte is gone**; use Vitest browser mode.

## Key URLs

SvelteKit 3 migration: https://github.com/sveltejs/kit/blob/main/documentation/docs/60-appendix/35-migrating-to-sveltekit-3.md · Kit 3 announcement: https://github.com/sveltejs/svelte.dev/blob/main/apps/svelte.dev/content/blog/2026-10-01-sveltekit-3-is-here.md · sv docs: https://github.com/sveltejs/cli/tree/main/documentation/docs · Threlte: https://github.com/threlte/threlte · Three.js migration guide: https://github.com/mrdoob/three.js/wiki/Migration-Guide · binpackingjs: https://github.com/olragon/binpackingjs · bin-packing (Rust/WASM): https://github.com/doublesharp/bin-packing · Extreme Points paper: https://pubsonline.informs.org/doi/10.1287/ijoc.1070.0250 · shadcn-svelte: https://github.com/huntabyte/shadcn-svelte · Cloudflare docs source: https://github.com/cloudflare/cloudflare-docs · vite-pwa sveltekit: https://github.com/vite-pwa/sveltekit · Storybook Kit 3 issue: https://github.com/storybookjs/storybook/issues/36491 · caniuse WebGPU: https://github.com/Fyrd/caniuse/blob/main/features-json/webgpu.json · Node release schedule: https://github.com/nodejs/Release/blob/main/schedule.json

# Starculator v2: project plan (draft for review)

**Status:** DRAFT, 2026-10-04. Nothing has been deleted or scaffolded yet. This document is the proposal to accept, change or reject. Supporting research lives in `docs/research/`:

- [00 Current repo audit](research/00-current-repo-audit.md)
- [01 Cargo-grid data sources](research/01-data-sources.md)
- [02 Tech stack](research/02-tech-stack.md)
- [03 Competitors and feature landscape](research/03-competitors.md)

---

## 1. The proposal in one page

**What we build:** a free, no-login, ad-free Star Citizen web app at `starculator.space` whose flagship is a **mission-driven 3D cargo planner**: pick a ship, see its exact cargo grids as 1.25 m cells in 3D, add the containers from the hauling contracts you accepted, and get an automatic, unload-order-aware load plan with fill level and a per-stop checklist. Around it, a small family of hauling-focused tools that share the same ship data: a "which ship fits this job" finder, ship cargo comparison, container decomposition for free-shopping missions, freight-elevator staging, and later trade-route profit using real leftover grid space and UEX prices.

**What we delete:** everything currently in the repo (Vue frontend, abandoned SvelteKit 2.7 skeleton, Symfony backend, committed `vendor/` and `node_modules/`, build scripts). None of it contains product logic. See the audit.

**Stack:** one SvelteKit 3 app (Svelte 5 runes, TypeScript 6, Vite 8, Tailwind 4, shadcn-svelte / Bits UI), Threlte 8 on Three.js r186 for the 3D hold, a custom lattice packer in a Web Worker, ship data ingested at build time from the Star Citizen Wiki's `scunpacked-data` GitHub repo, state in the browser (runes + Dexie), shareable URLs. **No backend and no monorepo for v1.** Static deployment, either on your existing nginx + Cloudflare Tunnel or on Cloudflare Workers static assets (free).

**Why this can win in a crowded niche:** about ten cargo tools already exist, several with 3D. Most hand-draw their grids and lag patches, hide auto-packing behind "expert modes" or Windows downloads, and none offers a polished tablet second-screen experience. We differentiate on exact version-tracked geometry from game data, mission-first workflow, mobile/PWA, and shareable, local-first use.

**Biggest risks:** grid *positions* inside a ship are not in any dataset (needs curation for the popular haulers); some per-grid max-box-size values in the game data are wrong (needs an override file); SvelteKit 3 is three days old (pin versions); the game data is CIG's and has no explicit license (fan-site disclaimer, no meshes).

**Decisions I need from you:** listed in §9.

---

## 2. Research findings that shape the plan

### 2.1 The data is better than expected

The Star Citizen Wiki team publishes extracted game data to GitHub (`StarCitizenWiki/scunpacked-data`, one commit per game build, latest 4.10.1-LIVE on 2026-09-22). For every vehicle it lists `CargoGrids[]` with exact X/Y/Z in metres, SCU, and min/max permitted container size. My own validation of the current snapshot:

| Check | Result |
|---|---|
| Vehicles | 320 (270 spaceships); 145 spaceships with cargo, **all** have grids |
| Grids | 528 total; up to 25 per ship (Idris-P), 14 on the Caterpillar, 16 on the Hull C |
| Dimensions that are not a 1.25 m multiple | **0** |
| Ships where grid SCU sums ≠ ship cargo total | **0** |

So "a hold is a union of axis-aligned 1.25 m cell boxes" holds for every ship, which makes the packer a small discrete problem rather than general 3D bin packing. Irregular holds (Caterpillar module + walkway + ladder, Zeus main + two side grids) are already split into rectangular grids by CIG.

Two gaps: (1) **no grid offsets/rotations** inside the ship, so a correct 3D layout of multi-grid ships needs a curated placement layer (FleetYards maintains hand-curated offsets in its GPL API, usable as a seed); (2) **`MaxSize` is wrong or missing for some ships** (Ironclad main bays claim 1-SCU max, Nomad has none, Cutlass Black looks too restrictive), so we keep a per-ship override file and cross-check against FleetYards and the wiki.

Other sources: the SC Wiki API serves the same data live (useful for a "new game version available" check; its `max_scu_box` field is buggy, compute fit ourselves); UEX API 2.0 gives prices, terminals, rentals, fuel (no grids; bearer token, generous quota); FleetYards gives an independent extraction plus offsets. Mission *templates* (giver, SCU ranges, max container size, reputation rank) exist in the game data and the wiki API; the *actual* boxes of an accepted contract exist in no API, so the user enters them (or, later, OCR / Game.log import).

### 2.2 The competition is crowded but beatable

Direct 3D cargo competitors: sc-hauling.tools (full OCR → route → 3D pack → checklist → co-op; packer behind "Expert mode"), Schaulers (manual 3D hold builder, heavy gamification), fleetyards.net (3D fit viewer inside a huge fleet site), sc-cargo.space (3D viewer + finder, no missions), SC Toolbox and HAULER OPS (Windows downloads), Arkaines' sc-cargo-optimizer (open-source Three.js LIFO packer with good scoring ideas). Static image/PDF grid guides lag patches badly. Regolith and starship42 both shut down in the last year, Regolith citing patch churn, which argues for an automated data pipeline over hand-maintained content. Community norms: free, Ko-fi/Patreon, no ads, no login.

### 2.3 The stack is fresh but coherent

SvelteKit 3.0.0 shipped 2026-10-01 (needs TypeScript 6, Vite 8, Node ≥ 22.17; `$lib` becomes `#lib`; config moves into `vite.config.ts`). Threlte 8.6 / extras 9.22 are Svelte-5-native and allow three 0.186, but Threlte's own monorepo does not yet exercise Vite 8 / Kit 3, so we pin exact versions. No JS packing library models gravity, per-grid max size or multi-grid ships, so the packer is custom. The PWA plugin is not Kit-3-ready, but Kit 3's native service worker is enough.

---

## 3. Product vision and positioning

**Audience:** solo and small-group haulers in Star Citizen 4.x who want to know, before they fly, whether a set of contracts fits a ship and how to load it so that the first drop-off is reachable.

**Principles**

1. Exact and current: geometry comes from game data per build, with a visible "data from game version X" badge and changelog.
2. Mission-first: the default flow is contracts → packing → per-stop plan, not a capacity calculator.
3. Works at the desk and next to the game: desktop first, but a tablet/phone PWA with large touch targets and offline support is a core use case, not an afterthought.
4. Local-first, no account, shareable: state lives in the browser and in the URL; export/import JSON; optional sync only if a backend ever appears.
5. Calm UI: dark sci-fi dashboard, few screens, no gamification, no ads. "This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of companies" in the footer.

**What we deliberately do not copy:** expert-mode gating, hand-built holds, paid OCR credits, Windows-only clients, static grid images, account walls, mega-navigation.

---

## 4. Tool portfolio and phases

Effort: S = a session or two, M = a few sessions, L = a sustained multi-session feature.

### Phase 0: reset and foundation (S)

- Delete the old code; keep only the deployment ideas in the rewritten README.
- `sv create` a SvelteKit 3 project (TypeScript, Tailwind 4, ESLint, Prettier, Vitest, Playwright, adapter-static), pnpm, pinned versions.
- Repo hygiene: proper `.gitignore`, `.env.example`, `config.example.yml`, GitHub Actions for lint/typecheck/test/build.
- Data pipeline v1: `scripts/ingest-ships.ts` pulls `ships.json` from a pinned scunpacked-data commit, validates (sum of grids == cargo, 1.25 m multiples), trims to what the UI needs, groups variants, applies `overrides.json`, writes `src/lib/data/ships.json` plus a `meta.json` with game version and commit SHA. Committed, so builds are reproducible.

### Phase 1: Cargo Planner MVP (L)

The one feature that must be excellent before anything else ships.

- Ship picker (search, manufacturer filter, cargo total, grid count, max box size), fuzzy search, URL-addressable (`/cargo/drake-caterpillar`).
- 3D hold view (Threlte, WebGL): each grid as a translucent box of 1.25 m cells on a `<Grid>`, ship bounding box for scale, orbit/touch controls, orthographic top-down toggle, grid labels. Multi-grid ships are auto-laid-out side by side until curated offsets exist.
- Container entry: counts per size (1/2/4/8/16/24/32 SCU), optional label/colour per group (one group per contract or commodity).
- Auto-pack: the lattice packer (biggest first, lowest-then-deepest corner placement, full support, per-grid min/max size, orientation rules) in a Web Worker; results rendered as instanced boxes coloured per group; fill % per grid and total; list of what does not fit and why.
- Manual adjustment: select a box, move it between valid cells (snap to lattice, validated), lock boxes, re-pack the rest.
- Share and persist: state encoded in the URL (`?ship=…&boxes=32x4,8x2`), autosave in the browser, JSON export/import.
- Provenance badge: game version and data date; link to report a wrong grid.
- Tests: packer unit tests on fixtures (Titan, Cutlass Black, Caterpillar, C2, Hull C), component tests for the entry form, one Playwright happy path.

### Phase 2: Mission workflow (M–L)

- Mission tracker: add contracts (giver, type, pickups, drop-offs, boxes, payout, max box size), status, 10-mission cap awareness, hauling reputation tier reference.
- Unload-order-aware packing: boxes for the first drop-off nearest the door, colour per destination, "blocked by" warnings; per-grid door face comes from a curated file for the top ~30 haulers.
- Per-stop load/unload checklist, big-touch mode, QR hand-off from desktop to tablet, PWA install + offline (Kit 3 native service worker).
- Container decomposition for free-shopping missions: given SCU and max box size, what to buy and whether it fits.
- Ship finder: given a container set, which ships fit it (and which you own, via an optional imported fleet list).
- Ship comparison by cargo (grid dims, max box, SCU, external vs internal grids).

### Phase 3: Economy data (M)

- UEX API 2.0 integration at runtime: commodity prices, terminals (freight elevator and max container size), vehicle buy/rent prices and locations. Add to the ship finder ("rentable at …").
- Trade-route profit using the *actual* leftover grid space and allowed box sizes after the mission cargo is placed.
- Freight-elevator staging planner (S/M/L/XL elevator grids).
- Fuel and quantum range estimate per ship (newly relevant after the 4.10.1 fuel rebalance).
- If UEX requires a token for reads, this is the trigger for the first thin server route (see §5.6).

### Phase 4: Extensions (as appetite allows)

- OCR import of mobiGlas contract screenshots, in-browser (Tesseract.js), no upload.
- Fleet/convoy manifest split across ships; later, live co-op sessions (needs a backend).
- Optional local Game.log companion that pushes mission events to the plan.
- Curated 3D placement for all ships; optional simplified hull silhouettes (never game meshes).
- Mining loadout and salvage calculators (the old navbar's "Mining Loadout" idea), localisation (DE first).

---

## 5. Architecture

### 5.1 Shape of the codebase

```
starculator/
├─ src/
│  ├─ lib/
│  │  ├─ data/            ships.json, meta.json, overrides.json, containers.ts, types.ts
│  │  ├─ packer/          pure TS lattice packer (no DOM), worker.ts, fixtures/, *.test.ts
│  │  ├─ three/           Threlte scene: Hold.svelte, GridBox.svelte, BoxInstances.svelte, Controls.svelte
│  │  ├─ state/           runes stores (.svelte.ts): plan, missions, settings; url-codec.ts; db.ts (Dexie)
│  │  ├─ components/      shadcn-svelte ui/ + app components
│  │  └─ api/             uex.ts, scwiki.ts (runtime fetchers, typed, cached)
│  ├─ routes/
│  │  ├─ +layout.svelte   shell, nav, footer disclaimer, version badge
│  │  ├─ +page.svelte     landing / tool index
│  │  ├─ cargo/[ship]/    the planner
│  │  ├─ missions/        tracker
│  │  ├─ finder/          which ship fits
│  │  ├─ compare/         ship comparison
│  │  └─ about/           data provenance, credits, changelog
│  └─ service-worker/     precache + offline
├─ scripts/ingest-ships.ts
├─ static/                manifest.webmanifest, icons
├─ .github/workflows/ci.yml
└─ docs/                  this plan, research, ADRs
```

### 5.2 Data pipeline

Build-time, deterministic, committed output. Source of truth is a pinned commit of `StarCitizenWiki/scunpacked-data`; the pipeline validates, normalises (cells = metres / 1.25, variant grouping, allowed box sizes computed from min/max size with our own correct box table), merges `overrides.json` (hand fixes: max sizes, door faces, grid offsets, hidden variants), and emits a compact JSON plus `meta.json` (game build, SHA, date). A scheduled GitHub Action opens a PR when the upstream repo has a new commit, so a new game patch is a review-and-merge, not hand-measuring. Runtime cross-check against the SC Wiki API is optional and off by default.

### 5.3 Packer

Pure TypeScript, dependency-free, runs in a Web Worker. Inputs: grids (size in cells, mask, min/max box, door face), items (shape, group, order constraints). Algorithm: biggest-first ordering, candidate corner points, lowest-then-deepest-from-door scoring, full-support test, per-grid orientation filtering, a few randomised restarts, deterministic tiebreaks. Output: placements in lattice coordinates, unplaced items with reasons, fill per grid. Metres only at the render boundary. Phase 2 adds delivery-order constraints (first drop nearest the door, no blocking). Target: under 100 ms for a few hundred boxes; sub-second for Hull C-scale loads.

### 5.4 3D rendering

Threlte 8 on WebGL (WebGPU behind a flag). One `<Canvas>` per page, `renderMode="on-demand"`, `dpr` capped for tablets. One `<InstancedMesh>` pool per container size (7 draw calls) coloured per group, `<Edges>` on the selection, `<Grid cellSize={1.25}>` floor, `<HTML>` labels, `CameraControls` for touch, orthographic toggle. Drag-to-move via the interactivity plugin with lattice snapping and packer validation. No game meshes are shipped; the hull is a wireframe bounding box from the ship's length/width/height.

### 5.5 State and persistence

Runes-based stores in `.svelte.ts` modules. The current plan is encoded into the URL for sharing; Dexie (IndexedDB) holds saved plans, missions and settings with a `schemaVersion`; JSON import/export. No accounts.

### 5.6 Backend: none now, a clear path later

v1 is fully static. Triggers for a backend: UEX requiring a token for reads (thin proxy with caching), shared live sessions, or cross-device sync. First step would be SvelteKit `+server.ts` routes deployed with `adapter-cloudflare` on Workers (KV/D1 free tiers); the alternative is PocketBase in your Docker stack if you prefer the home server. The Symfony backend is not kept.

### 5.7 Monorepo

Not now. A single SvelteKit app with pnpm. Converting to a pnpm workspace (`apps/web`, `packages/packer`, `packages/sc-data`) later is a folder move. The trigger is a second deployable (a Worker cron, a Discord bot) that imports the packer or data types.

---

## 6. Stack summary

| Layer | Choice | Pinned version (2026-10-04) |
|---|---|---|
| App | SvelteKit 3 + Svelte 5 + TypeScript 6 + Vite 8 | kit 3.0.0, svelte 5.57.1, typescript 6.0.3, vite 8.3.2 |
| Styling / UI | Tailwind 4, shadcn-svelte on Bits UI, @lucide/svelte, TanStack Table 9, LayerChart | 4.3.3, 1.7.0 / 2.19.5, 1.52.0, 9.2.5, 2.5.1 |
| 3D | Threlte core + extras on Three.js | 8.6.1 / 9.22.0 on 0.186.1 |
| State | runes + runed PersistedState + Dexie | 0.37.1, 4.4.6 |
| Tests | Vitest (browser mode for components), Playwright E2E, svelte-check | 4.1.x (sv default) or 5.0.3, 1.63.0, 4.7.6 |
| Lint / format | ESLint 10 flat + eslint-plugin-svelte, Prettier 3 + svelte + tailwind plugins | 10.12 / 3.23, 3.9.9 / 4.1.1 |
| Package manager / runtime | pnpm, Node 24 LTS (26 after 2026-10-28) | 12.9 |
| Deploy | adapter-static (v1); adapter-cloudflare when a server appears | 4.0.0 / 8.0.0 |

Scaffold command (verified to work today):

```sh
npx sv@1.1.0 create starculator --template minimal --types ts \
  --add prettier eslint vitest="usages:unit,component" playwright="demo:no" \
  tailwindcss sveltekit-adapter="adapter:static"
```

---

## 7. Deployment

| Option | Recommendation |
|---|---|
| **A. Keep nginx + Cloudflare Tunnel on your home server** | Lowest change. Static `build/` copied into nginx, `try_files … /200.html`. Keep `dev.starculator.space` for preview builds. Depends on home-server uptime. |
| **C. Cloudflare Workers static assets** (recommended for the public site) | Free, edge-cached, zero uptime burden, git-integrated builds, and the same Cloudflare account you already use for the tunnel. The adapter swap is one line, and KV/D1 are there when a backend appears. |

Suggested: develop on A (you already have it), publish production on C, or go straight to C and retire the tunnel for the website while keeping it for code-server. Your call (§9).

---

## 8. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Grid positions not in data | Multi-grid ships render as abstract side-by-side boxes until curated | Auto-layout in MVP; curate the top ~30 haulers in Phase 2 (seed from FleetYards offsets with credit); make it clear in the UI which ships are "schematic" |
| Wrong `MaxSize` in game data (Ironclad, Nomad, Cutlass Black…) | Packer rejects boxes that fit in-game | `overrides.json` + cross-check with FleetYards/wiki + user report link; pipeline fails loudly on unknown shapes |
| Game data licensing (no explicit permission) | Takedown risk, low given a decade of tolerated community tools | Numbers only, no meshes/textures; fan-site disclaimer; credit the wiki; keep the ingest pipeline so removal of any one source is survivable |
| SvelteKit 3 is three days old | Peer warnings, small breakages | Pin exact versions; TS pinned to 6.x; fallback: start on Kit 2.70 and run `sv migrate sveltekit-3` later |
| Threlte on Vite 8 / Kit 3 untested upstream | Build or HMR glitches | Pin exact; smoke test in Phase 0 before writing features |
| In-game placement rules (overhang, rotation, 1 cm sub-grid) unverified | Packer too strict or too lenient | Configurable support threshold; validate in-game with a few ships; document assumptions |
| Patch churn (4.10.2 due in weeks) | Stale data kills trust (Regolith lesson) | Automated upstream watcher + PR; version badge; changelog |
| Solo-dev sustainability | Scope creep | Phase 1 is the only must-have; everything else is optional and independent |

---

## 9. Decisions I need from you

1. **Delete everything and start fresh** on this branch, as described in Phase 0? (Recommended: yes.)
2. **SvelteKit 3 now** with pinned versions, or SvelteKit 2.70 and migrate later? (Recommended: Kit 3; the migration tool exists if we need to retreat.)
3. **Hosting:** home server via nginx + Cloudflare Tunnel, Cloudflare Workers, or both (dev at home, prod on Workers)? (Recommended: Workers for production.)
4. **Open source** the repo (MIT or AGPL) or keep it private? Open source is unusual among the polished tools and helps trust and longevity. (Recommended: MIT, after the reset.)
5. **Scope of Phase 1:** is the Cargo Planner MVP as described the right first milestone, or do you want the mission tracker inside the MVP?
6. **Naming:** keep "Starculator" as the site name? Tool names in this plan are descriptive placeholders.
7. **Curation effort:** are you willing to hand-place grids and door faces for the ~30 most-used haulers (a few evenings in total, with in-game checking)? Without it, multi-grid ships stay schematic.

---

## 10. Milestones

| # | Milestone | Done when |
|---|---|---|
| M0 | Reset + scaffold + CI + data pipeline | `pnpm build` produces a static site with a ship list from real 4.10.1 data; CI green |
| M1 | Hold viewer | Any ship's grids render in 3D with correct cell counts; URL-addressable |
| M2 | Packer + entry form | Containers auto-pack with fill %, unplaced list; packer tests pass on fixtures |
| M3 | MVP release | Manual adjust, share URL, save/export, provenance badge, PWA basics; deployed to `starculator.space` |
| M4 | Mission workflow | Tracker, unload-order packing, per-stop checklist, ship finder, comparison |
| M5 | Economy | UEX prices, trade profit on leftover space, elevator staging, fuel range |

---

## 11. Immediate next steps on approval

1. Phase 0 on this branch: delete old code, scaffold, pin versions, CI, README rewrite.
2. Ingest pipeline with validation and the first `overrides.json` (Ironclad, Nomad, Cutlass Black).
3. Hold viewer for one ship (Caterpillar is the best stress test: 14 grids, 3 variants), then generalise.
4. Packer with fixture tests, then wire into the UI.

For the implementation sessions, the research sandbox will need these hosts allowed in the environment's network policy if we want live API checks: `raw.githubusercontent.com` (already works), `api.star-citizen.wiki`, `api.uexcorp.space`, `api.fleetyards.net`.

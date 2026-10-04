# Research: Star Citizen cargo-grid data sources

> Research snapshot taken 2026-10-04 (Star Citizen 4.10.1 era). The research sandbox's network policy blocked every Star Citizen host (api.star-citizen.wiki, uexcorp.space, api.fleetyards.net, starcitizen.tools, RSI, erkul.games). Only GitHub and web search were reachable. Verification levels:
>
> - **Verified with real fetched data:** `StarCitizenWiki/scunpacked-data` (raw GitHub). `ships.json` (41.7 MB, 320 vehicles) and the per-ship JSON for five ships plus a contract file were downloaded. Samples below are genuine.
> - **Verified from server source code, not live responses:** SC Wiki API (`StarCitizenWiki/API`), FleetYards (`fleetyards/fleetyards`), ScDataDumper (`octfx/ScDataDumper`). Field names are exact; response envelopes were not seen.
> - **From search snippets / third-party client code only:** UEX API field list, Erkul ToS, wiki pages, Fankit FAQ. Treat as "very likely", not confirmed.

## 1. Comparison table

| Source                                                                                            | Coverage                                                                                                      | Cargo-grid detail                                                                                                                                                                            | Auth                                               | License / ToS                                                                                                             | Maintained?                                                                                                     |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **scunpacked-data** ([repo](https://github.com/StarCitizenWiki/scunpacked-data), branch `master`) | 320 vehicles (incl. variants, ground vehicles), items, ~5,120 contract templates, blueprints, starmap, labels | **Yes, per grid:** `CargoGrids[]` with X/Y/Z metres, SCU, MinSize/MaxSize, open/external flags, plus hardpoint→grid mapping. **No grid positions/offsets.**                                  | None                                               | No LICENSE file; content is CIG game data (see §9). Wiki API README: "verify licensing independently for commercial use." | **Yes.** One commit per game build: 4.10.1-LIVE.12660092 (2026-09-22), 4.10.0, 4.9.0, 4.8.x. Maintainer: octfx. |
| **SC Wiki API** (`api.star-citizen.wiki/api`)                                                     | Same game data (it imports scunpacked-data) + ship matrix, missions, items, commodities; version-scoped       | **Yes:** `cargo_grids[]` (width/height/length, scu, min_size/max_size, min/max_scu_box, open/external) + `cargo_limits`. No offsets.                                                         | None for game data                                 | Code MIT; wiki text CC BY-SA 4.0                                                                                          | **Yes** (repo updated 2026-09-25). Search throttled 60/min/IP                                                   |
| **UEX API 2.0** (`api.uexcorp.space/2.0`)                                                         | ~280 vehicles, commodities, terminals, prices, routes, items, marketplace, player contracts                   | **No grid dimensions.** Only `scu`, `container_sizes` (CSV of supported box sizes), ship L/W/H, `is_cargo`, `is_loading_dock`. Terminals carry `max_container_size`, `has_freight_elevator`. | Bearer token (public GETs likely open, unverified) | [Terms](https://uexcorp.space/about/terms): API "work in progress", may change/terminate, data "estimated… no warranty"   | **Yes** (4.10.1). Quota 172,800/day (120/min); vehicles cache TTL 12 h                                          |
| **FleetYards API** (`api.fleetyards.net/v1`)                                                      | All ship-matrix ships + in-game models, loaners, prices (via UEX), images, holo 3D                            | **Yes:** `cargo_holds[]` {name, dimensions{x,y,z}, capacity, max_container_size, limits.min, **offset{x,y,z}, rotation** (hand-curated)}. Independent extraction from game files.            | None for reads                                     | Code GPLv3; data is CIG game data + RSI holoviewer models                                                                 | **Yes** (loader PR merged 2026-10-03; offsets added 2026-03)                                                    |
| **Erkul.games**                                                                                   | Ship/component stats per patch                                                                                | **No public API**; ToS forbids scraping                                                                                                                                                      | n/a                                                | "not a public API: automated access, scraping… not authorized"                                                            | Yes                                                                                                             |
| **starcitizen.tools** wiki                                                                        | Ship pages with cargo-grid tables                                                                             | Textual, same game data                                                                                                                                                                      | None                                               | CC BY-SA 4.0                                                                                                              | Yes                                                                                                             |
| sc-cargo.space / ratjack.net / sg-cargo-grid.pages.dev                                            | Visual grid layouts incl. off-grid areas                                                                      | Visual only; no data download                                                                                                                                                                | n/a                                                | Unstated                                                                                                                  | Mixed; ratjack labelled 4.4.0                                                                                   |
| richardthombs/scunpacked, scunpacked.com                                                          | Legacy extractor                                                                                              | Historic                                                                                                                                                                                     | —                                                  | GPL-3.0                                                                                                                   | **Archived May 2023**                                                                                           |
| starship42.com                                                                                    | 3D models                                                                                                     | —                                                                                                                                                                                            | —                                                  | —                                                                                                                         | **Retired 2025-10-22**                                                                                          |

## 2. scunpacked-data: the primary candidate (real data)

**URLs**

- Index: `https://raw.githubusercontent.com/StarCitizenWiki/scunpacked-data/master/ships.json` (41.7 MB, JSON array of 320 vehicles)
- Per ship: `.../master/ships/<classname_lowercase>.json`, e.g. `ships/drak_caterpillar.json` (224 KB), `ships/rsi_constellation_andromeda.json`, `ships/crus_starlifter_c2.json`, `ships/misc_hull_c.json`, `ships/rsi_zeus_cl.json`
- Per cargo-grid item: `items/drak_caterpillar_cargogrid_nose.json`
- Contracts: `contracts/<uuid>.json` (~5,120 files, no index)
- Other indexes: `items.json`, `ship-items.json`, `fps-items.json`, `manufacturers.json`, `labels.json`, `trade_locations.json`, `starmap.json`, `blueprints.json`. No README, LICENSE or version file. **The game build is only in the commit message** (e.g. "4.10.1-LIVE.12660092"), so pin a commit SHA at build time. Branch is `master`.

**Top-level ship keys:** `UUID, ClassName, Name, Description, Career, Role, Manufacturer, Size, Length, Width, Height, Crew, Insurance, IsVehicle, IsGravlev, IsSpaceship, Mass, Cargo, CargoGrids, CargoSizeLimits, Stowage, InventoryContainers, Health, FlightCharacteristics, Propulsion, QuantumTravel, Systems …`

**Sample: Caterpillar (`Cargo: 576`, 14 grids)**

```json
"CargoGrids": [
 {"UUID":"e1d2072e-…","Class":"DRAK_Caterpillar_CargoInventory_Nose","SCU":60,"Capacity":60,"CapacityName":"SCU",
  "X":6.25,"Y":5,"Z":3.75,"MinSize":{"X":1.25,"Y":1.25,"Z":1.25},"MaxSize":{"X":5,"Y":5,"Z":2.5},
  "IsOpenContainer":true,"IsExternalContainer":true,"IsClosedContainer":false},
 {"Class":"DRAK_Caterpillar_CargoInventory_Nose_Access","SCU":20,"X":6.25,"Y":2.5,"Z":2.5,"MaxSize":{"X":5,"Y":2.5,"Z":2.5}},
 {"Class":"DRAK_Caterpillar_CargoInventory_Module","SCU":96,"X":5,"Y":7.5,"Z":5,"MaxSize":{"X":2.5,"Y":7.5,"Z":2.5}},
 {"Class":"DRAK_Caterpillar_CargoInventory_Module_Walkway","SCU":8,"X":5,"Y":1.25,"Z":2.5,"MaxSize":{"X":2.5,"Y":1.25,"Z":1.25}},
 {"Class":"DRAK_Caterpillar_CargoInventory_Module_Ladder","SCU":20,"X":1.25,"Y":6.25,"Z":5,"MaxSize":{"X":1.25,"Y":2.5,"Z":1.25}},
 … (Module + Walkway + Ladder repeated for modules 02–04)
],
"Systems": {"CargoGrids": {"Ports": [
  {"PortId":"loadout.89","HardpointName":"hardpoint_cargogrid_nose","Type":"CargoGrid","ClassName":"DRAK_Caterpillar_CargoGrid_Nose"},
  {"PortId":"loadout.90","HardpointName":"hardpoint_cargogrid_module_01","Type":"CargoGrid","ClassName":"DRAK_Caterpillar_CargoGrid_Module"}, … ]}}
```

Check: 60 + 20 + 4 × (96 + 8 + 20) = 576 ✓. Matches the wiki's "4 modules × 124 SCU (max 24-SCU box) + front bay 80 SCU (max 16-SCU box)": MaxSize 2.5 × 7.5 × 2.5 is a 24-SCU box; 5 × 5 × 2.5 fits a 16-SCU box.

**Other four ships (fetched):**

- **Constellation Andromeda** (Cargo 96): one grid `RSI_Constellation_CargoGrid_Main` X5 Y10 Z3.75 = 96 SCU, MaxSize 2.5 × 10 × 2.5, external = false.
- **C2 Hercules** (Cargo 696): `CRUS_Starlifter_CargoGrid_Large_C2` X10 Y18.75 Z5 = 480 SCU, MaxSize 10 × 10 × 2.5; `…_Small_C2` X7.5 Y11.25 Z5 = 216 SCU.
- **Hull C** (Cargo 4608): 8 × `MISC_Hull_C_CargoGrid` X10 Y10 Z7.5 = 384 SCU + 8 × `…_Outer` X5 Y10 Z7.5 = 192 SCU; **MinSize = MaxSize = 2.5 × 10 × 2.5** (32-SCU containers only, matching in-game behaviour), all external.
- **Zeus Mk II CL** (Cargo 128): `RSI_Zeus_CargoGrid_Cargo_Main` X6.25 Y10 Z3.75 = 120 SCU, MaxSize X2.5 Y2.5 **Z10**; `…_Left` / `…_Right` X2.5 Y1.25 Z2.5 = 4 SCU each.

**Raw item representation** (`items/drak_caterpillar_cargogrid_nose.json` → `Raw.Entity.Components`):

```json
"SCItemInventoryContainerComponentParams":{"inventoryContainer":{
   "interiorDimensions":{"x":6.25,"y":5,"z":3.75},
   "inventoryType":{"InventoryOpenContainerType":{"isExternalContainer":1,
      "gridCellSize":{"InventoryContainerGridCellSizeCentimeters":{"centimeters":1}},
      "minPermittedItemSize":{"x":1.25,"y":1.25,"z":1.25},"maxPermittedItemSize":{"x":5,"y":5,"z":2.5},
      "gridPosOffset":{"x":0,"y":0,"z":0}}}}}
```

**Observations that matter for the tool**

- Every grid is an axis-aligned box with dimensions in multiples of 1.25 m. "Irregular" holds are modelled by CIG as **several rectangular grids** (Caterpillar module = Module + Walkway + Ladder; Zeus = Main + Left + Right). A hold is a union of boxes.
- **No position or rotation of a grid inside the ship** is exported. Relative placement must come from the p4k (hardpoint transforms), from FleetYards' curated `offset`/`rotation`, or from manual curation.
- `MinSize`/`MaxSize` are per-axis in a grid-local frame that does not always match the interior axes (Zeus Main: interior 10 m is Y, MaxSize 10 m is Z). The SC Wiki API sidesteps this by sorting dimensions before comparing with box shapes.
- `CargoSizeLimits` was `[]` for all five ships.
- `gridCellSize = 1 cm` is present; whether physical placement snaps at 1 cm or 1.25 m cannot be determined from data alone.

## 3. How extraction works

- Pipeline: `Data.p4k` → [unp4k](https://github.com/dolkensp/unp4k) or [StarBreaker](https://github.com/diogotr7/StarBreaker) (Rust) → XML/DCB → [octfx/ScDataDumper](https://github.com/octfx/ScDataDumper) (PHP CLI) → committed to `scunpacked-data` → imported by the SC Wiki API. `richardthombs/scunpacked` and `ExterraGroup/scdatatools` are archived.
- ScDataDumper code (commit 534bbae): `CargoGrid.php` maps `Width = dimensions.x`, `Height = dimensions.z`, `Depth = dimensions.y`, `Capacity = x·y·z / 1.953125` (1.25³ m³ per SCU). `CargoGridResolver` walks loadout entries with `AttachDef.Type === 'CargoGrid'` and has sibling-variant detection to stop e.g. `DRAK_Cutter_CargoGrid_2SCU` leaking into the 4-SCU variant.
- A hosted JSON dump to ingest at build time: **yes**, scunpacked-data raw GitHub.

## 4. SC Wiki API: exact schema (from source)

- Base `https://api.star-citizen.wiki/api`. Swagger: https://docs.star-citizen.wiki. OpenAPI: `GET /api/openapi`. Quickstart: https://api.star-citizen.wiki/developers.
- Routes: `GET /api/vehicles`, `GET /api/vehicles/{vehicle}` (name, slug, class name or uuid), `/api/vehicles/filters`, `/api/ground-vehicles`, `/api/items…`, `/api/vehicle-items`, `/api/missions`, `/api/missions/{mission}`, `/api/game-versions`, `/api/game-versions/default`, `/api/shipmatrix/vehicles`. The `/v2/` and `/v3/` prefixes hit the same controller (v2 names ports `hardpoints`); prefer the unversioned route.
- Params: `version` (game build to scope to), `include`, `page[number]`, `page[size]`, `sort` (e.g. `-cargo_capacity`), `filter[name]`, `filter[class_name]`, `filter[manufacturer]`, `filter[cargo_capacity]`. A third-party integrator measured `page[size]=200` at 10.4 MB per page.
- Rate limits: search 60/min/IP; image search 10/min; nothing else throttled. Auth only on `/api/user` and image search.
- Vehicle resource: `uuid, name, class_name, slug, manufacturer, length, beam, height, size_class, mass_*, cargo_capacity, ore_capacity, cargo_grids[], cargo_limits{min, min_scu_box, max, max_scu_box}, max_scu_box, vehicle_inventory, inventory_containers[], crew, health, shield, speed, fuel, quantum, ports …`
- `cargo_grids[]` item: `uuid, width (x), height (z), length (y), volume, scu, unit, open, external, closed, min_size{x,y,z}, max_size{x,y,z}, min_scu_box, max_scu_box`.
- **Bug found in `app/Support/ScuBox.php`:** its box table models the 32-SCU box as 2.5 × 5 × 5 (real: 10 × 2.5 × 2.5) and has **no 24-SCU box**. So `max_scu_box` is wrong for 32-only grids (Hull C would report 16). Compute box fit yourself from `min_size`/`max_size`.

## 5. UEX API 2.0 (from docs snippets and client code)

- Docs: https://uexcorp.space/api/documentation/ ; vehicles: https://uexcorp.space/api/documentation/id/vehicles/. Format `https://api.uexcorp.space/2.0/{resource}/`.
- `/vehicles` fields: `id, id_company, name, name_full, slug, uuid, scu, crew, mass, width, height, length, fuel_quantum, fuel_hydrogen, container_sizes (CSV), is_cargo, is_loading_dock, is_spaceship, is_ground_vehicle, … url_store, pad_type, game_version, date_modified`. `uuid` matches the wiki/game UUID (~31% of rows have empty uuid). **No cargo-grid dimensions.**
- Cargo-adjacent: `/terminals` (`max_container_size, has_freight_elevator, has_loading_dock`), `/commodities_prices` (rows carry `container_sizes`), `/commodities_routes`, `/items_prices`, `/planets`, `/fuel_prices`, `/vehicles_rentals_prices`, `/contracts` (looks like the **player-posted** board, not in-game templates).
- Auth: Bearer token via "My Apps"; 172,800 req/day. Public build scripts fetch `/2.0/vehicles` without a token (unverified).

## 6. FleetYards (from source)

- API: `https://api.fleetyards.net/v1/models` (summary) and `/v1/models/{slug}` (detail). GPLv3, Rails + Vue 2.
- Game data comes from **their own exporter** (S3 raw store, version folders like `4.10.0-live.12519617`), not scunpacked-data. Prices/terminals via UEX.
- `cargo_holds[]`: `name, dimensions{x,y,z}, capacity, max_container_size{size, dimensions}, limits{min}, offset{x,y,z}, rotation`. Offsets and rotation are **admin-curated placements** (migrations 2026-03-08), re-attached by hold name across builds. A server-side greedy "cargo finder" exists; public endpoint unverified.
- Container constants (`SCU_DIMENSIONS = 1.25`): 32 = 8×2×2 cells, 24 = 6×2×2, 16 = 4×2×2, 8 = 2×2×2, 4 = 2×2×1, 2 = 2×1×1, 1 = 1×1×1.
- 3D: holo models come from the RSI Holoviewer (exterior silhouettes only). Also a public missions catalogue endpoint (PR #5128).

## 7. Cargo box facts (cross-verified)

- **1 SCU = 1.25 × 1.25 × 1.25 m** (1 m³ payload + walls); 1.953125 m³. All grid dimensions are multiples of 1.25 m, so 1.25 m cells hold in practice.
- Containers (L × W × H, cells): **1** 1.25³ (1×1×1); **2** 2.5×1.25×1.25 (2×1×1); **4** 2.5×2.5×1.25 (2×2×1); **8** 2.5³ (2×2×2); **16** 5×2.5×2.5 (4×2×2); **24** 7.5×2.5×2.5 (6×2×2); **32** 10×2.5×2.5 (8×2×2). A 1/8-SCU box (0.625³) exists for personal items.
- Per-grid constraints come from `MinSize`/`MaxSize` (Hull C: 32 only; Caterpillar modules ≤ 24; nose ≤ 16; Zeus side grids ≤ 4). Prefer these over UEX `container_sizes`.
- Tractor limits (wiki snippets): TruHold attachment 8 SCU (16 with two beams), MaxLift 16 SCU (32 paired), ATLS 32 SCU.
- **Placement rules (support, overhang, rotation) could not be verified from primary sources.** `maxPermittedItemSize` is per-axis, implying orientation constraints exist per grid. Treat "boxes axis-aligned, snapped to 1.25 m, fully supported" as a product assumption to validate in-game.

## 8. Mission / hauling data

- **Templates exist in game data:** scunpacked-data `contracts/<uuid>.json`. Sample: `MissionType.Name "Hauling - Stellar"`, `MissionGiver "Red Wind Linehaul"`, `DisplayTitle "Experienced Hauler Needed for Direct Large Shipment"`, `LocationPools{PickupLocationBP, DropoffLocationBP → ResolvedLocations[]}`, `MissionTokens{ReputationRank, CargoGradeToken, MissionMaxSCUSize:["32 SCU"]}`, **`HaulingOrders:[{Kind:"Resource", Name:"Waste", MaxContainerSize:32, MinScu:400, MaxScu:600}]`**, `MinStanding`, `RankIndex`, `TimeToComplete`.
- SC Wiki API `GET /api/missions` exposes `hauling_orders, mission_giver, mission_type, rank_index, reward_min/max, time_to_complete_minutes, star_systems, min_standing`.
- **Concrete accepted contracts** (the exact box counts for a given run) are not available from any API. Community tools parse `Game.log` (Starlogger), OCR the contract screen (sc-haulerhelper), or crowd-source. Contract tiers from the wiki: XS ≤ 10 SCU in 1-SCU boxes; S ≤ 24 SCU, max 4-SCU; M 126–600 SCU, max 8/16-SCU; L > 600 SCU in 32-SCU. **Templates from data; actual loads entered manually (or log-parsed).**

## 9. 3D models: legal and practical

- **(a) Extracted game meshes:** EULA prohibits reverse engineering; Fankit FAQ gives no permission to redistribute 3D content. No takedowns against data tools were found (unp4k, StarBreaker, erkul, wiki, myfleet.gg operate openly) but there is no explicit permission. Highest risk; avoid redistributing meshes.
- **(b) Procedural boxes from grid dimensions:** zero legal risk; fully supported by the data. The missing piece is relative grid placement: FleetYards `offset`/`rotation` (curated numbers), own curation per ship, or hardpoint transforms extracted at build time without redistributing meshes.
- **(c) Community low-poly models with permissive licenses:** none found with cargo interiors.
- **(d) Fankit assets:** personal/non-commercial use; fan sites must display "This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of companies." Not detailed enough for interiors.
- What others use: myfleet.gg, fleet-viewer.com, FleetYards → RSI Holoviewer `.ctm` models scraped from the RSI website. Exterior silhouettes only.

## 10. Recommendation

**Primary:** `StarCitizenWiki/scunpacked-data` (`master`), ingested at build time from raw GitHub, pinned to a commit SHA whose message carries the game build. Read `ships/<class>.json` → `Name, ClassName, UUID, Length/Width/Height, Cargo, CargoGrids[] (X, Y, Z, SCU, MinSize, MaxSize, IsExternalContainer, Class), Systems.CargoGrids.Ports[]`. Derive cells = dim / 1.25; derive allowed box sizes per grid from MinSize/MaxSize with a correct box table (do not trust the wiki API's `max_scu_box`). Group grids by hardpoint (module_01 = Module + Walkway + Ladder).

**Fallback / cross-check:** SC Wiki API `GET /api/vehicles/{name}?version=<build>` (same data, live JSON, adds `cargo_limits`) for a runtime "newer version available" path and to diff against the snapshot. Second cross-check: FleetYards `/v1/models/{slug}.cargo_holds` (independent extraction; the only source with hold offsets/rotation). Sanity: UEX `scu` + `container_sizes`.

**Hand-curated layer (unavoidable):** grid positions and orientation within the ship, ramp/door access side, loading-order heuristics, and off-grid areas (Vulture, C1, Starlancer, Corsair pads).

## 11. Open risks

1. **Grid placement is not in the data.** 3D rendering of multi-grid holds needs curation or p4k hardpoint extraction.
2. **Axis semantics of MinSize/MaxSize vs interior X/Y/Z are undocumented and inconsistent** (Zeus Main).
3. **SC Wiki API `ScuBox` table is wrong for 32 SCU and lacks 24 SCU.**
4. **Licensing:** scunpacked-data has no LICENSE; it is CIG game data. Add the fan-site disclaimer; avoid shipping meshes.
5. **Update lag / breakage:** scunpacked-data lags patches by days; schema changes between builds. Pin SHAs and validate (sum of grid SCU == `Cargo`).
6. **Variant explosion:** 320 vehicles including Wikelo/pirate variants and ground vehicles; grids usually identical across variants but not always.
7. **UEX `/contracts` is likely not in-game missions**; concrete loads need manual entry or Game.log parsing.
8. **Placement/stacking rules unverified**; `gridCellSize = 1 cm` hints placement may be finer than 1.25 m.
9. **Reference sites may be stale** and expose no API/license.
10. **Live responses not fetched** from the SC Wiki API, UEX, FleetYards. Confirm envelopes (`data`, `links`, `meta`) once from an unblocked network.

## Key URLs

- https://github.com/StarCitizenWiki/scunpacked-data · https://github.com/octfx/ScDataDumper · https://github.com/StarCitizenWiki/API · https://docs.star-citizen.wiki · https://api.star-citizen.wiki/developers
- https://uexcorp.space/api/documentation/ · https://uexcorp.space/about/terms
- https://api.fleetyards.net/v1/ · https://github.com/fleetyards/fleetyards
- https://erkul.games/about · https://starcitizen.tools/Cargo · https://starcitizen.tools/Standard_Cargo_Unit · https://starcitizen.tools/Hauling
- https://github.com/dolkensp/unp4k · https://github.com/diogotr7/StarBreaker · https://github.com/VeeLume/sc-holotable
- https://support.robertsspaceindustries.com/hc/en-us/articles/360006895793-Star-Citizen-Fankit-and-Fandom-FAQ · https://robertsspaceindustries.com/en/fankit

## 12. Own validation of the scunpacked-data snapshot (run 2026-10-04 on `ships.json`, 4.10.1-LIVE)

A script over all 320 vehicles in the fetched index produced:

| Check                                             | Result                                                                  |
| ------------------------------------------------- | ----------------------------------------------------------------------- |
| Vehicles in index                                 | 320 (270 spaceships, 38 ground/other, rest suits/misc)                  |
| Vehicles with `CargoGrids`                        | 149 (528 grids total)                                                   |
| Spaceships with `Cargo > 0`                       | 145, **all** of them have grids                                         |
| Grids per ship                                    | 1: 66 · 2: 41 · 3: 10 · 4–7: 15 · 9–16: 12 · 21–25: 5 (max 25, Idris-P) |
| Grid dimensions that are not a multiple of 1.25 m | **0**                                                                   |
| Ships where Σ grid SCU ≠ `Cargo`                  | **0**                                                                   |

So the "hold = union of 1.25 m cell boxes" model holds for every ship in the current build, and the data is internally consistent.

**Data-quality problems found in `MaxSize` (allowed box size per grid):**

- **Drake Ironclad:** four main bays of 360/720 SCU report `MaxSize 1.25 × 1.25 × 1.25` (1-SCU boxes only), which contradicts in-game use (32-SCU boxes). The Ironclad's main deck is an open-floor grid, so CIG may encode its limit elsewhere.
- **Drake Cutlass Black:** main 40-SCU grid reports `MaxSize 2.5 × 1.25 × 1.25` (2-SCU boxes), which also looks too restrictive.
- **C.O. Nomad:** `MaxSize` is missing entirely.
- **Polaris / Starlancer MAX:** `MaxSize 2.5 × 2.5 × 10` where the 10 m axis is the grid's Z (height), another instance of the axis-frame inconsistency noted in §2.

Consequence for the plan: treat `MaxSize` as a hint, cross-check against FleetYards `max_container_size` and the wiki's per-ship tables, and keep a small **hand-curated override file** (per ClassName) for ships where the game data is wrong or missing. The grid _dimensions_ themselves look trustworthy.

**Naming:** `Name` includes the manufacturer prefix (e.g. "MISC Hull A", "Drake Cutlass Black"); variants are separate entries (`DRAK_Caterpillar`, `DRAK_Caterpillar_Boarded`, `DRAK_Caterpillar_Pirate`; "Teach's Special", "PYAM Exec", "Collector" editions). The tool should group variants under a base ship and dedupe identical grid sets.

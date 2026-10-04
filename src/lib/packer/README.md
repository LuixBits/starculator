# Lattice packer

Pure, dependency-free TypeScript. Packs Star Citizen cargo containers into a
ship's cargo grids, where every grid is a lattice of 1.25 m cells
(`CELL_M`) and every container is an axis-aligned block of whole cells
(`CONTAINER_CELLS` in `../data/types.ts`). Runs in a Web Worker in the browser
and synchronously everywhere else.

```ts
import { pack, expandCounts, createPackerClient } from '#lib/packer/index.ts';

const items = [...expandCounts({ 32: 4, 8: 6 }, 'covalex'), ...expandCounts({ 16: 3 }, 'red-wind')];
const groups = [
	{ id: 'covalex', label: 'Covalex drop', colorIndex: 0, unloadOrder: 0 }, // unloaded first
	{ id: 'red-wind', label: 'Red Wind', colorIndex: 1, unloadOrder: 1 }
];
const result = pack(ship.grids, items, groups, { support: 1, restarts: 4, seed: 1 });

// in the UI: off the main thread when possible
const client = createPackerClient();
const result2 = await client.pack(ship.grids, items, groups);
```

## Conventions

- **Coordinates** are grid-local integer cells: x = width (port–starboard),
  y = depth (fore–aft), z = height (up). `Placement.at` is the minimum
  corner, `Placement.dims` the oriented size. Metres appear only in
  `cellsToMeters` / `metersToCells`.
- **Door.** `grid.door` names the face cargo enters through. When it is
  `null` the packer assumes `DEFAULT_DOOR = '-y'`, the face at y = 0. The
  _depth_ of a box is the distance in cells from the door face to the box's
  nearest face (`depthFromDoor`), so depth 0 touches the door.
- **Orientation.** `allowRotation` (default true) permits every distinct axis
  permutation of a container (`containerOrientations`); off, only the
  canonical shape with x as the long axis is used. A box only enters grids
  whose `allowedSizes` include its SCU, and only in orientations that fit.
- **Gravity.** A box must rest on the floor or on other boxes:
  `supportFraction >= options.support` (default 1 = fully supported; 0.75
  allows a quarter overhang; 0 allows floating).
- **Loading order.** `Placement.order` is the loading sequence, 0 first in.
  Locked placements come first. Items are loaded group by group in
  descending `unloadOrder` (the group unloaded last goes in first), biggest
  SCU first within a group (First-Fit Decreasing), then caller order. Items
  whose group is not in `groups` get rank +∞ and are loaded first.
- **Grids** are visited in `options.gridOrder`, then the rest by capacity,
  largest first (`orderGrids`). The first grid with a valid position takes the
  box (first fit); within that grid the best-scoring position wins.
- **Locks.** `options.locked` placements are applied before anything else and
  never moved. A lock that cannot be honoured (unknown grid or item, dims
  that are not an orientation of the item's SCU, out of bounds, overlapping
  another lock) is dropped and its item is packed normally. Locks are not
  checked against `allowedSizes` or support; use `validatePlacement` in the
  UI for that.
- **Capacity.** `capacityScu` and `fills[].totalCells` are cell counts
  (1 cell = 1 SCU), which equal the published SCU for every current ship.

## Algorithm

One pass:

1. Build an occupancy lattice (`Uint8Array`, x-fastest) per grid and apply
   the locks.
2. For each item in loading order, for each grid in visiting order, for each
   permitted orientation, scan every position whose box lies in bounds,
   whose cells are free and whose base is supported. Grids are at most a few
   hundred cells, so the scan is exhaustive (it subsumes corner points) and
   costs O(items × grids × orientations × cells × box cells); 300 mixed boxes
   into a C2 take a few milliseconds for five passes.
3. Score each candidate lexicographically and keep the minimum:
   1. `z` (lowest first; "layer" strategy) or depth key (column strategy),
   2. depth key: `-depth` for groups that should sit deep, `+depth` for the
      group unloaded first (the lowest `unloadOrder` among the items, only
      when at least two ranks are present),
   3. `-contact`, the number of cell faces touching walls, floor, ceiling or
      other boxes (compactness),
   4. a deterministic tiebreak (x, y, orientation index) in pass 0, a seeded
      random number in restart passes.
4. An item with no position anywhere is unplaced with a reason computed per
   SCU: `size-not-allowed` when no grid allows it, `too-large-for-any-grid`
   when no allowing grid fits it in any permitted orientation, else
   `no-space`.

Restarts: pass 0 is the canonical deterministic heuristic. Each of
`options.restarts` (default 4, max 64) further passes alternates the column
strategy (depth before height) with the layer strategy and adds seeded noise
(`seed`, default 1) to the contact term and the tiebreak. The best pass wins
by fewest unplaced, then most SCU placed, then lowest stack; ties keep the
earlier pass, so restarts never make a result worse. Everything is
deterministic for a given seed.

## Files

| File                                          | Role                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------ |
| `pack.ts`                                     | `pack()`, options resolution, grid ordering, the pass runner                   |
| `lattice.ts`                                  | `Lattice`: occupancy, bounds, free, support, contact, fill                     |
| `geometry.ts`                                 | cells ↔ metres, orientations, door convention, depth                           |
| `helpers.ts`                                  | `expandCounts`, `validatePlacement`, `validatePlan`, `gridCapacityByContainer` |
| `random.ts`                                   | mulberry32 PRNG (`createRng`, `shuffle`)                                       |
| `protocol.ts`                                 | worker message types and `handlePackRequest`                                   |
| `packer.worker.ts`                            | module worker entry                                                            |
| `client.ts`                                   | `createPackerClient()`: lazy worker, sync fallback without `Worker`            |
| `index.ts`                                    | public exports                                                                 |
| `fixtures.ts`, `test-helpers.ts`, `*.test.ts` | inline ship fixtures, independent invariant checker, Vitest suites (node)      |

Run the tests with `pnpm vitest run src/lib/packer`.

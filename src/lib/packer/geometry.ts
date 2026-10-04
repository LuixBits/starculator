/**
 * Lattice geometry helpers shared by the packer, the validator and the UI.
 *
 * Everything here works in integer lattice cells (see `CellVec` in
 * `../data/types.ts`): x = width, y = depth, z = height (up). Metres only
 * appear in `cellsToMeters` / `metersToCells`, which the render layer uses.
 */
import { CELL_M, CONTAINER_CELLS, CONTAINER_SIZES } from '../data/types.ts';
import type { CargoGrid, CellVec, ContainerSize, DoorFace, Vec3 } from '../data/types.ts';

/**
 * Door convention: when a grid has no curated `door`, cargo is assumed to enter
 * through the face at y = 0 ('-y'). "Depth" of a box is the distance in cells
 * from the door face to the box's nearest face, so a box touching the door has
 * depth 0 and the deepest possible box has depth cells.<axis> - dims.<axis>.
 */
export const DEFAULT_DOOR: DoorFace = '-y';

export function doorOf(grid: Pick<CargoGrid, 'door'>): DoorFace {
	return grid.door ?? DEFAULT_DOOR;
}

export function cellsToMeters(cells: CellVec): Vec3 {
	return { x: cells.x * CELL_M, y: cells.y * CELL_M, z: cells.z * CELL_M };
}

/** Rounds to the nearest cell; every published grid is an exact multiple of CELL_M. */
export function metersToCells(meters: Vec3): CellVec {
	return {
		x: Math.round(meters.x / CELL_M),
		y: Math.round(meters.y / CELL_M),
		z: Math.round(meters.z / CELL_M)
	};
}

export function volumeOf(dims: CellVec): number {
	return dims.x * dims.y * dims.z;
}

export function sameCells(a: CellVec, b: CellVec): boolean {
	return a.x === b.x && a.y === b.y && a.z === b.z;
}

export function fitsWithin(dims: CellVec, cells: CellVec): boolean {
	return dims.x <= cells.x && dims.y <= cells.y && dims.z <= cells.z;
}

/**
 * All distinct axis-aligned orientations of a box, canonical orientation first.
 * The order is fixed so tiebreaks stay deterministic:
 * (x,y,z) (y,x,z) (x,z,y) (z,x,y) (y,z,x) (z,y,x), duplicates removed.
 */
export function orientationsOf(dims: CellVec): CellVec[] {
	const { x, y, z } = dims;
	const all: CellVec[] = [
		{ x, y, z },
		{ x: y, y: x, z },
		{ x, y: z, z: y },
		{ x: z, y: x, z: y },
		{ x: y, y: z, z: x },
		{ x: z, y, z: x }
	];
	const out: CellVec[] = [];
	for (const o of all) if (!out.some((p) => sameCells(p, o))) out.push(o);
	return out;
}

const orientationCache = new Map<string, readonly CellVec[]>();

/** Orientations a container of `scu` may take; only the canonical one when rotation is off. */
export function containerOrientations(
	scu: ContainerSize,
	allowRotation = true
): readonly CellVec[] {
	const key = `${scu}:${allowRotation ? 'r' : 'f'}`;
	let cached = orientationCache.get(key);
	if (!cached) {
		const canonical = CONTAINER_CELLS[scu];
		cached = allowRotation ? orientationsOf(canonical) : [{ ...canonical }];
		orientationCache.set(key, cached);
	}
	return cached;
}

/** The container size whose canonical footprint `dims` is a permutation of, or null. */
export function scuOfDims(dims: CellVec): ContainerSize | null {
	const sorted = [dims.x, dims.y, dims.z].sort((a, b) => a - b);
	for (const scu of CONTAINER_SIZES) {
		const c = CONTAINER_CELLS[scu];
		const cs = [c.x, c.y, c.z].sort((a, b) => a - b);
		if (cs[0] === sorted[0] && cs[1] === sorted[1] && cs[2] === sorted[2]) return scu;
	}
	return null;
}

/** True when `dims` is the canonical (unrotated) footprint of a container. */
export function isCanonicalDims(dims: CellVec): boolean {
	const scu = scuOfDims(dims);
	return scu !== null && sameCells(dims, CONTAINER_CELLS[scu]);
}

/**
 * Distance in cells from the door face to the nearest face of a box at `at`
 * with oriented size `dims` inside a grid of `cells`.
 */
export function depthFromDoor(cells: CellVec, door: DoorFace, at: CellVec, dims: CellVec): number {
	switch (door) {
		case '-y':
			return at.y;
		case '+y':
			return cells.y - (at.y + dims.y);
		case '-x':
			return at.x;
		case '+x':
			return cells.x - (at.x + dims.x);
	}
}

/** Largest possible depth for a box of `dims` in a grid of `cells`, on the door axis. */
export function maxDepth(cells: CellVec, door: DoorFace, dims: CellVec): number {
	return door === '-y' || door === '+y' ? cells.y - dims.y : cells.x - dims.x;
}

export function isIntegerVec(v: CellVec): boolean {
	return Number.isInteger(v.x) && Number.isInteger(v.y) && Number.isInteger(v.z);
}

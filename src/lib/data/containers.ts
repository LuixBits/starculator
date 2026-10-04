/**
 * Container geometry and the "which box fits this grid" rule.
 *
 * The game publishes MinSize/MaxSize per grid in a grid-local axis frame that
 * does not always match the interior X/Y/Z (Zeus Mk II CL: interior 10 m is Y,
 * MaxSize 10 m is Z). Comparing sorted dimensions sidesteps that: a box fits
 * when, after sorting both triples descending, every component of the box is
 * within the corresponding component of the limit. The packer decides the
 * actual orientation later.
 */

import {
	CELL_M,
	CONTAINER_CELLS,
	CONTAINER_SIZES,
	type CellVec,
	type ContainerSize,
	type Vec3
} from './types.ts';

const EPS = 1e-6;

export type SortedDims = readonly [number, number, number];

/** Container footprint in metres; x is the long axis. */
export function containerMeters(size: ContainerSize): Vec3 {
	return cellsToMeters(CONTAINER_CELLS[size]);
}

export function cellsToMeters(cells: CellVec): Vec3 {
	return { x: cells.x * CELL_M, y: cells.y * CELL_M, z: cells.z * CELL_M };
}

/** The three dimensions sorted descending (longest first). */
export function sortedDims(v: Vec3 | CellVec): SortedDims {
	const dims = [v.x, v.y, v.z].sort((a, b) => b - a);
	return [dims[0], dims[1], dims[2]];
}

/** True when `inner` fits within `outer` under some axis permutation. */
export function fitsWithin(inner: Vec3, outer: Vec3): boolean {
	const a = sortedDims(inner);
	const b = sortedDims(outer);
	return a.every((d, i) => d <= b[i] + EPS);
}

/**
 * A published size limit is usable when every component is positive. The game
 * ships both missing limits (C.O. Nomad) and 0×0×0 limits (Greycat UTV).
 */
export function isUsableBox(box: Vec3 | null | undefined): box is Vec3 {
	return box !== null && box !== undefined && box.x > EPS && box.y > EPS && box.z > EPS;
}

/** Container sizes whose footprint fits inside a grid of the given cells, ignoring published limits. */
export function sizesFittingGrid(cells: CellVec): ContainerSize[] {
	const grid = cellsToMeters(cells);
	return CONTAINER_SIZES.filter((size) => fitsWithin(containerMeters(size), grid));
}

/**
 * Container sizes a grid accepts: the box must fit the grid itself, fit within
 * MaxSize (when usable) and be at least MinSize (when usable), all compared by
 * sorted dimensions.
 */
export function allowedSizesFor(
	cells: CellVec,
	minBox: Vec3 | null,
	maxBox: Vec3 | null
): ContainerSize[] {
	return sizesFittingGrid(cells).filter((size) => {
		const box = containerMeters(size);
		if (isUsableBox(maxBox) && !fitsWithin(box, maxBox)) return false;
		if (isUsableBox(minBox) && !fitsWithin(minBox, box)) return false;
		return true;
	});
}

export function maxContainerOf(sizes: readonly ContainerSize[]): ContainerSize | null {
	let max: ContainerSize | null = null;
	for (const size of sizes) if (max === null || size > max) max = size;
	return max;
}

export function isContainerSize(value: unknown): value is ContainerSize {
	return typeof value === 'number' && (CONTAINER_SIZES as readonly number[]).includes(value);
}

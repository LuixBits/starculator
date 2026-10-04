/**
 * Lattice space → Three.js world space.
 *
 *   data x (width)  → three  x
 *   data z (height) → three  y   (Three is y-up)
 *   data y (depth)  → three -z   (so a '-y' door faces the default camera)
 *
 * All world values are metres; one lattice cell is CELL_M metres.
 */
import { CELL_M } from '../data/types.ts';
import type { CellVec, DoorFace } from '../data/types.ts';

/** `[x, y, z]` in Three.js world metres. */
export type WorldTuple = [number, number, number];

/** A point in lattice cells. Unlike CellVec it may be fractional (centres, centring shifts). */
export interface CellPoint {
	x: number;
	y: number;
	z: number;
}

export interface WorldBox {
	center: WorldTuple;
	/** Extent along three x, y, z. */
	size: WorldTuple;
}

export interface WorldBounds {
	min: WorldTuple;
	max: WorldTuple;
}

export function cellToWorld(p: CellPoint): WorldTuple {
	// `0 - …` instead of unary minus so a zero depth maps to +0, not -0.
	return [p.x * CELL_M, p.z * CELL_M, 0 - p.y * CELL_M];
}

/** Sizes have no sign, so only the axes swap. */
export function cellSizeToWorld(d: CellPoint): WorldTuple {
	return [d.x * CELL_M, d.z * CELL_M, d.y * CELL_M];
}

/** World box for a lattice box given its minimum corner and extent. */
export function cellBoxToWorld(min: CellPoint, dims: CellPoint): WorldBox {
	return {
		center: cellToWorld({
			x: min.x + dims.x / 2,
			y: min.y + dims.y / 2,
			z: min.z + dims.z / 2
		}),
		size: cellSizeToWorld(dims)
	};
}

/** Axis-aligned bounds; the depth axis flips sign, so min/max swap on three z. */
export function cellBoundsToWorld(min: CellPoint, max: CellPoint): WorldBounds {
	const a = cellToWorld(min);
	const b = cellToWorld(max);
	return {
		min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
		max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])]
	};
}

export function boundsCenter(b: WorldBounds): WorldTuple {
	return [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
}

export function boundsSize(b: WorldBounds): WorldTuple {
	return [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
}

/** Half the diagonal: the radius of the bounding sphere. */
export function boundsRadius(b: WorldBounds): number {
	const [w, h, d] = boundsSize(b);
	return Math.hypot(w, h, d) / 2;
}

/**
 * Where a door marker goes, in the grid's local Three frame (origin at the
 * grid's minimum corner, grid spanning x∈[0, W], y∈[0, H], z∈[-D, 0]).
 */
export interface DoorEdge {
	/** Midpoint of the door edge on the floor, local three x/z. */
	center: [number, number];
	/** Edge length in metres. */
	length: number;
	/** Length in cells (for repeating chevrons). */
	cells: number;
	/**
	 * Rotation about three y that maps a strip built along local x with arrows
	 * pointing to local -z onto this edge, arrows pointing into the grid.
	 */
	rotationY: number;
	/** Unit direction into the grid, local three x/z. */
	inward: [number, number];
}

export function doorEdge(cells: CellVec, face: DoorFace): DoorEdge {
	const w = cells.x * CELL_M;
	const d = cells.y * CELL_M;
	switch (face) {
		case '-y':
			return { center: [w / 2, 0], length: w, cells: cells.x, rotationY: 0, inward: [0, -1] };
		case '+y':
			return { center: [w / 2, -d], length: w, cells: cells.x, rotationY: Math.PI, inward: [0, 1] };
		case '-x':
			return {
				center: [0, -d / 2],
				length: d,
				cells: cells.y,
				rotationY: -Math.PI / 2,
				inward: [1, 0]
			};
		case '+x':
			return {
				center: [w, -d / 2],
				length: d,
				cells: cells.y,
				rotationY: Math.PI / 2,
				inward: [-1, 0]
			};
	}
}

/**
 * Helpers the UI needs around the packer: turning count fields into items,
 * validating manual moves, and per-grid capacity by container size.
 */
import { CONTAINER_CELLS, CONTAINER_SIZES } from '../data/types.ts';
import type { CargoGrid, ContainerSize, PackItem, Placement } from '../data/types.ts';
import { isCanonicalDims, isIntegerVec, scuOfDims } from './geometry.ts';
import { Lattice } from './lattice.ts';
import { DEFAULT_PACK_OPTIONS, pack } from './pack.ts';

/**
 * Expands "n boxes of each size" into packer items for one group. Ids are
 * `${group}-${scu}scu-${n}` (1-based), largest size first. Non-finite,
 * negative or fractional counts are floored to whole boxes (or ignored).
 */
export function expandCounts(
	counts: Partial<Record<ContainerSize, number>>,
	group: string
): PackItem[] {
	const items: PackItem[] = [];
	const sizes = [...CONTAINER_SIZES].sort((a, b) => b - a);
	for (const scu of sizes) {
		const raw = counts[scu];
		const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.floor(raw) : 0;
		for (let i = 1; i <= n; i++) {
			items.push({ id: `${group}-${scu}scu-${i}`, scu, group, label: `${scu} SCU` });
		}
	}
	return items;
}

export type PlacementProblemCode =
	| 'unknown-grid'
	| 'invalid-dims'
	| 'rotation-not-allowed'
	| 'size-not-allowed'
	| 'out-of-bounds'
	| 'overlap'
	| 'unsupported';

export interface PlacementProblem {
	code: PlacementProblemCode;
	message: string;
	/** Item ids this placement collides with (only for 'overlap'). */
	collidesWith?: string[];
}

export interface PlacementValidation {
	ok: boolean;
	problems: PlacementProblem[];
	/** Fraction of the base resting on floor or boxes (0 when the box is out of bounds). */
	supportFraction: number;
}

export interface ValidateOptions {
	/** Required support fraction, default 1. */
	support?: number;
	/** When false, only the canonical container orientation is valid. Default true. */
	allowRotation?: boolean;
}

/**
 * Checks a single candidate placement (a manual move) against the grids and
 * the other placements. The existing placement of the same `itemId` is
 * ignored, so moving a box never collides with itself. Checks: grid exists,
 * dims are a container shape (and canonical if rotation is off), the size is
 * allowed in that grid, bounds, overlap and support.
 */
export function validatePlacement(
	grids: readonly CargoGrid[],
	placements: readonly Placement[],
	candidate: Placement,
	options: ValidateOptions = {}
): PlacementValidation {
	const problems: PlacementProblem[] = [];
	const minSupport = Math.min(1, Math.max(0, options.support ?? DEFAULT_PACK_OPTIONS.support));
	const allowRotation = options.allowRotation ?? DEFAULT_PACK_OPTIONS.allowRotation;

	const grid = grids.find((g) => g.id === candidate.gridId);
	if (!grid) {
		problems.push({ code: 'unknown-grid', message: `No grid "${candidate.gridId}".` });
		return { ok: false, problems, supportFraction: 0 };
	}

	const scu = isIntegerVec(candidate.dims) ? scuOfDims(candidate.dims) : null;
	if (scu === null) {
		problems.push({
			code: 'invalid-dims',
			message: `${candidate.dims.x}×${candidate.dims.y}×${candidate.dims.z} is not a container shape.`
		});
		return { ok: false, problems, supportFraction: 0 };
	}
	if (!allowRotation && !isCanonicalDims(candidate.dims)) {
		problems.push({ code: 'rotation-not-allowed', message: 'Rotation is disabled.' });
	}
	if (!grid.allowedSizes.includes(scu)) {
		problems.push({
			code: 'size-not-allowed',
			message: `${scu} SCU containers are not allowed in ${grid.name}.`
		});
	}

	const lattice = new Lattice(grid.cells);
	if (!isIntegerVec(candidate.at) || !lattice.inBounds(candidate.at, candidate.dims)) {
		problems.push({ code: 'out-of-bounds', message: 'The box leaves the grid.' });
		return { ok: false, problems, supportFraction: 0 };
	}

	const collidesWith: string[] = [];
	for (const p of placements) {
		if (p.gridId !== grid.id || p.itemId === candidate.itemId) continue;
		if (!lattice.inBounds(p.at, p.dims)) continue;
		if (boxesOverlap(p, candidate)) collidesWith.push(p.itemId);
		lattice.fill(p.at, p.dims, 1);
	}
	if (collidesWith.length > 0) {
		problems.push({
			code: 'overlap',
			message: `Overlaps ${collidesWith.length} other box${collidesWith.length === 1 ? '' : 'es'}.`,
			collidesWith
		});
	}

	// Measure support on a lattice without the overlapping boxes' cells inside
	// the candidate: cells under the box are what matters.
	const supportFraction = lattice.supportFraction(candidate.at, candidate.dims);
	if (supportFraction + 1e-9 < minSupport) {
		problems.push({
			code: 'unsupported',
			message: `Only ${Math.round(supportFraction * 100)}% of the base is supported.`
		});
	}

	return { ok: problems.length === 0, problems, supportFraction };
}

function boxesOverlap(a: Placement, b: Placement): boolean {
	return (
		a.at.x < b.at.x + b.dims.x &&
		b.at.x < a.at.x + a.dims.x &&
		a.at.y < b.at.y + b.dims.y &&
		b.at.y < a.at.y + a.dims.y &&
		a.at.z < b.at.z + b.dims.z &&
		b.at.z < a.at.z + a.dims.z
	);
}

/**
 * Validates every placement of a plan against all the others, e.g. after a
 * manual move pulled a box out from under a stack. Returns only the failures.
 */
export function validatePlan(
	grids: readonly CargoGrid[],
	placements: readonly Placement[],
	options: ValidateOptions = {}
): Map<string, PlacementValidation> {
	const failures = new Map<string, PlacementValidation>();
	for (const p of placements) {
		const v = validatePlacement(grids, placements, p, options);
		if (!v.ok) failures.set(p.itemId, v);
	}
	return failures;
}

/**
 * How many containers of each size the grid takes when loaded with that size
 * alone (greedy single pass of the packer, no restarts). Sizes the grid does
 * not allow give 0.
 */
export function gridCapacityByContainer(
	grid: CargoGrid,
	options: Pick<ValidateOptions, 'allowRotation' | 'support'> = {}
): Record<ContainerSize, number> {
	const result = {} as Record<ContainerSize, number>;
	const cells = grid.cells.x * grid.cells.y * grid.cells.z;
	for (const scu of CONTAINER_SIZES) {
		if (!grid.allowedSizes.includes(scu)) {
			result[scu] = 0;
			continue;
		}
		const count = Math.floor(cells / scu);
		const items: PackItem[] = [];
		for (let i = 0; i < count; i++) items.push({ id: `cap-${scu}-${i}`, scu, group: 'cap' });
		const packed = pack([grid], items, [], {
			restarts: 0,
			allowRotation: options.allowRotation,
			support: options.support
		});
		result[scu] = packed.placed.length;
	}
	return result;
}

/** Cells of the canonical footprint, for UIs that draw stencil icons. */
export function containerDims(scu: ContainerSize) {
	return CONTAINER_CELLS[scu];
}

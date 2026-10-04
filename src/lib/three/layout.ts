/**
 * Where each cargo grid sits in lattice space.
 *
 * Curated data: when every grid carries an `offset`, grids are placed exactly
 * there (relative to the ship origin). Otherwise the hold is schematic: grids
 * line up left → right, grouped by bay, with a 1-cell gap inside a bay and a
 * 2-cell gap between bays, all front faces ('-y' side) aligned and the whole
 * arrangement centred on the origin. Everything here is in cells; space.ts
 * converts to metres.
 */
import type { CargoGrid } from '../data/types.ts';
import type { CellPoint } from './space.ts';

export interface GridPlacement {
	grid: CargoGrid;
	/** Minimum corner in cells. Fractional after centring. */
	origin: CellPoint;
}

export interface BayLayout {
	/** CargoGrid.bay, or the grid id for grids without a bay. */
	key: string;
	label: string;
	gridIds: string[];
	min: CellPoint;
	max: CellPoint;
}

export interface HoldLayout {
	grids: GridPlacement[];
	byId: ReadonlyMap<string, GridPlacement>;
	bays: BayLayout[];
	/** Bounds of all grids in cells. Zero-sized when there are no grids. */
	min: CellPoint;
	max: CellPoint;
	/** True when positions came from curated offsets rather than auto-layout. */
	curated: boolean;
}

export const BAY_GAP_CELLS = 2;
export const GRID_GAP_CELLS = 1;

const ZERO: CellPoint = { x: 0, y: 0, z: 0 };

export function layoutGrids(grids: readonly CargoGrid[]): HoldLayout {
	const curated = grids.length > 0 && grids.every((g) => g.offset !== null);
	const placements = curated ? placeCurated(grids) : placeSchematic(grids);
	const bounds = boundsOf(placements);
	return {
		grids: placements,
		byId: new Map(placements.map((p) => [p.grid.id, p])),
		bays: groupBays(placements),
		min: bounds.min,
		max: bounds.max,
		curated
	};
}

function placeCurated(grids: readonly CargoGrid[]): GridPlacement[] {
	return grids.map((grid) => ({ grid, origin: { ...(grid.offset ?? ZERO) } }));
}

function bayKey(grid: CargoGrid): string {
	return grid.bay ?? grid.id;
}

function placeSchematic(grids: readonly CargoGrid[]): GridPlacement[] {
	const placements: GridPlacement[] = [];
	let cursor = 0;
	let previousBay: string | null = null;
	for (const grid of grids) {
		const key = bayKey(grid);
		if (previousBay !== null) {
			cursor += key === previousBay ? GRID_GAP_CELLS : BAY_GAP_CELLS;
		}
		placements.push({ grid, origin: { x: cursor, y: 0, z: 0 } });
		cursor += grid.cells.x;
		previousBay = key;
	}
	const depth = Math.max(0, ...placements.map((p) => p.grid.cells.y));
	const shiftX = cursor / 2;
	const shiftY = depth / 2;
	for (const p of placements) {
		p.origin.x -= shiftX;
		p.origin.y -= shiftY;
	}
	return placements;
}

function boundsOf(placements: readonly GridPlacement[]): { min: CellPoint; max: CellPoint } {
	if (placements.length === 0) return { min: { ...ZERO }, max: { ...ZERO } };
	const min = { x: Infinity, y: Infinity, z: Infinity };
	const max = { x: -Infinity, y: -Infinity, z: -Infinity };
	for (const { grid, origin } of placements) {
		min.x = Math.min(min.x, origin.x);
		min.y = Math.min(min.y, origin.y);
		min.z = Math.min(min.z, origin.z);
		max.x = Math.max(max.x, origin.x + grid.cells.x);
		max.y = Math.max(max.y, origin.y + grid.cells.y);
		max.z = Math.max(max.z, origin.z + grid.cells.z);
	}
	return { min, max };
}

/** "module-1" → "Module 1"; a grid without a bay is labelled by its name. */
function bayLabel(key: string, first: CargoGrid): string {
	if (first.bay === null) return first.name;
	const words = key.replace(/[-_]+/g, ' ').trim();
	return words.charAt(0).toUpperCase() + words.slice(1);
}

function groupBays(placements: readonly GridPlacement[]): BayLayout[] {
	const bays = new Map<string, GridPlacement[]>();
	for (const p of placements) {
		const key = bayKey(p.grid);
		const list = bays.get(key);
		if (list) list.push(p);
		else bays.set(key, [p]);
	}
	return [...bays.entries()].map(([key, members]) => {
		const { min, max } = boundsOf(members);
		return {
			key,
			label: bayLabel(key, members[0].grid),
			gridIds: members.map((m) => m.grid.id),
			min,
			max
		};
	});
}

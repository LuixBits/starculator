/**
 * Where each cargo grid sits in lattice space.
 *
 * Curated data: when every grid carries an `offset`, grids are placed exactly
 * there (relative to the ship origin). Otherwise the hold is schematic: grids
 * line up left → right, grouped by bay, with a 1-cell gap inside a bay and a
 * 2-cell gap between bays, all front faces ('-y' side) aligned. Once a row
 * would exceed MAX_ROW_CELLS, the next bay starts a new row behind it (3 cells
 * further from the door), so big ships read as a block instead of a 150 m
 * line. Rows are centred on x and the whole arrangement on y. Everything here
 * is in cells; space.ts converts to metres.
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
export const ROW_GAP_CELLS = 3;
/** A schematic row never grows wider than this (50 m); rows are then balanced below it. */
export const MAX_ROW_CELLS = 40;

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

/** Consecutive grids with the same bay key, in input order. */
function bayRuns(grids: readonly CargoGrid[]): CargoGrid[][] {
	const runs: CargoGrid[][] = [];
	let previous: string | null = null;
	for (const grid of grids) {
		const key = bayKey(grid);
		if (key === previous) runs[runs.length - 1].push(grid);
		else runs.push([grid]);
		previous = key;
	}
	return runs;
}

function bayWidth(bay: readonly CargoGrid[]): number {
	return bay.reduce((sum, g) => sum + g.cells.x, 0) + GRID_GAP_CELLS * (bay.length - 1);
}

/** Greedily fills rows of at most `limit` cells; a bay wider than that gets its own row. */
function fillRows(bays: readonly CargoGrid[][], limit: number): CargoGrid[][][] {
	const rows: CargoGrid[][][] = [];
	let width = 0;
	for (const bay of bays) {
		const w = bayWidth(bay);
		const current = rows[rows.length - 1];
		if (current && width + BAY_GAP_CELLS + w <= limit) {
			current.push(bay);
			width += BAY_GAP_CELLS + w;
		} else {
			rows.push([bay]);
			width = w;
		}
	}
	return rows;
}

/**
 * Rows of at most MAX_ROW_CELLS, balanced: the row limit is lowered as far as
 * it goes without adding a row, so a 16-grid Hull does not end in one lonely
 * grid on the last row.
 */
function rowsOf(bays: readonly CargoGrid[][]): CargoGrid[][][] {
	const greedy = fillRows(bays, MAX_ROW_CELLS);
	if (greedy.length < 2) return greedy;
	let best = greedy;
	for (let limit = MAX_ROW_CELLS - 1; limit > 0; limit--) {
		const rows = fillRows(bays, limit);
		if (rows.length > greedy.length) break;
		best = rows;
	}
	return best;
}

function placeSchematic(grids: readonly CargoGrid[]): GridPlacement[] {
	const placements: GridPlacement[] = [];
	let cursorY = 0;
	for (const row of rowsOf(bayRuns(grids))) {
		const rowStart = placements.length;
		let cursorX = 0;
		let depth = 0;
		row.forEach((bay, bayIndex) => {
			if (bayIndex > 0) cursorX += BAY_GAP_CELLS;
			bay.forEach((grid, gridIndex) => {
				if (gridIndex > 0) cursorX += GRID_GAP_CELLS;
				placements.push({ grid, origin: { x: cursorX, y: cursorY, z: 0 } });
				cursorX += grid.cells.x;
				depth = Math.max(depth, grid.cells.y);
			});
		});
		// Centre this row on x.
		const shiftX = cursorX / 2;
		for (let i = rowStart; i < placements.length; i++) placements[i].origin.x -= shiftX;
		cursorY += depth + ROW_GAP_CELLS;
	}
	// Centre the block of rows on y (the door side stays at the front).
	const totalDepth = Math.max(0, cursorY - ROW_GAP_CELLS);
	const shiftY = totalDepth / 2;
	for (const p of placements) p.origin.y -= shiftY;
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

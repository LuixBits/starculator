/**
 * Inline ship fixtures for packer tests, built from the figures in
 * docs/research/01-data-sources.md (scunpacked-data, 4.10.1-LIVE). Not a
 * data file: the real ship data lives in src/lib/data and is generated.
 */
import { CELL_M } from '../data/types.ts';
import type { CargoGrid, CellVec, ContainerSize } from '../data/types.ts';

const ALL_SIZES: ContainerSize[] = [1, 2, 4, 8, 16, 24, 32];

export interface GridSpec {
	id: string;
	cells: CellVec;
	allowedSizes?: ContainerSize[];
	name?: string;
	className?: string;
	external?: boolean;
	bay?: string | null;
	door?: CargoGrid['door'];
}

export function makeGrid(spec: GridSpec): CargoGrid {
	const { cells } = spec;
	return {
		id: spec.id,
		name: spec.name ?? spec.id,
		className: spec.className ?? `FIXTURE_${spec.id}`,
		cells,
		meters: { x: cells.x * CELL_M, y: cells.y * CELL_M, z: cells.z * CELL_M },
		scu: cells.x * cells.y * cells.z,
		minBox: null,
		maxBox: null,
		allowedSizes: spec.allowedSizes ?? ALL_SIZES,
		external: spec.external ?? false,
		hardpoint: null,
		bay: spec.bay ?? null,
		offset: null,
		door: spec.door ?? null
	};
}

/** Aegis Avenger Titan: one 2.5 × 5 × 1.25 m grid, 8 SCU, up to 4-SCU boxes. */
export const titan: CargoGrid[] = [
	makeGrid({ id: 'titan-main', cells: { x: 2, y: 4, z: 1 }, allowedSizes: [1, 2, 4] })
];

/**
 * Drake Cutlass Black: 5 × 6.25 × 2.5 m → 4 × 5 × 2 cells, 40 SCU. The game
 * data claims 2-SCU max, which looks wrong; the fixture allows up to 16.
 */
export const cutlassBlack: CargoGrid[] = [
	makeGrid({ id: 'cutlass-main', cells: { x: 4, y: 5, z: 2 }, allowedSizes: [1, 2, 4, 8, 16] })
];

/** One Drake Caterpillar module bay: module (96 SCU, ≤ 24), walkway (8 SCU), ladder (20 SCU). */
export const caterpillarBay: CargoGrid[] = [
	makeGrid({
		id: 'cat-module-1',
		className: 'DRAK_Caterpillar_CargoInventory_Module',
		cells: { x: 4, y: 6, z: 4 },
		allowedSizes: [1, 2, 4, 8, 16, 24],
		external: true,
		bay: 'module_01'
	}),
	makeGrid({
		id: 'cat-walkway-1',
		className: 'DRAK_Caterpillar_CargoInventory_Module_Walkway',
		cells: { x: 4, y: 1, z: 2 },
		allowedSizes: [1, 2],
		external: true,
		bay: 'module_01'
	}),
	makeGrid({
		id: 'cat-ladder-1',
		className: 'DRAK_Caterpillar_CargoInventory_Module_Ladder',
		cells: { x: 1, y: 5, z: 4 },
		allowedSizes: [1, 2],
		external: true,
		bay: 'module_01'
	})
];

/** Crusader C2 Hercules: large 10 × 18.75 × 5 m (480 SCU) + small 7.5 × 11.25 × 5 m (216 SCU). */
export const c2: CargoGrid[] = [
	makeGrid({
		id: 'c2-large',
		className: 'CRUS_Starlifter_CargoGrid_Large_C2',
		cells: { x: 8, y: 15, z: 4 }
	}),
	makeGrid({
		id: 'c2-small',
		className: 'CRUS_Starlifter_CargoGrid_Small_C2',
		cells: { x: 6, y: 9, z: 4 }
	})
];

/** MISC Hull C: 8 × (8 × 8 × 6 cells) + 8 × (4 × 8 × 6 cells), 32-SCU containers only. */
export const hullC: CargoGrid[] = [
	...Array.from({ length: 8 }, (_, i) =>
		makeGrid({
			id: `hullc-main-${i + 1}`,
			className: 'MISC_Hull_C_CargoGrid',
			cells: { x: 8, y: 8, z: 6 },
			allowedSizes: [32],
			external: true
		})
	),
	...Array.from({ length: 8 }, (_, i) =>
		makeGrid({
			id: `hullc-outer-${i + 1}`,
			className: 'MISC_Hull_C_CargoGrid_Outer',
			cells: { x: 4, y: 8, z: 6 },
			allowedSizes: [32],
			external: true
		})
	)
];

/** RSI Zeus Mk II CL: main 6.25 × 10 × 3.75 m (120 SCU) + two 4-SCU side grids (≤ 4 SCU). */
export const zeusCl: CargoGrid[] = [
	makeGrid({ id: 'zeus-main', cells: { x: 5, y: 8, z: 3 } }),
	makeGrid({ id: 'zeus-left', cells: { x: 2, y: 1, z: 2 }, allowedSizes: [1, 2, 4] }),
	makeGrid({ id: 'zeus-right', cells: { x: 2, y: 1, z: 2 }, allowedSizes: [1, 2, 4] })
];

export const fixtures: Record<string, CargoGrid[]> = {
	titan,
	cutlassBlack,
	caterpillarBay,
	c2,
	hullC,
	zeusCl
};

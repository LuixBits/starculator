/** Minimal CargoGrid factory for the viewer's unit tests. */
import { CELL_M } from '../data/types.ts';
import type { CargoGrid, CellVec, DoorFace } from '../data/types.ts';

export interface TestGridSpec {
	id: string;
	cells: CellVec;
	bay?: string | null;
	offset?: CellVec | null;
	door?: DoorFace | null;
	name?: string;
}

export function grid(spec: TestGridSpec): CargoGrid {
	const { cells } = spec;
	return {
		id: spec.id,
		name: spec.name ?? spec.id,
		className: `TEST_${spec.id}`,
		cells,
		meters: { x: cells.x * CELL_M, y: cells.y * CELL_M, z: cells.z * CELL_M },
		scu: cells.x * cells.y * cells.z,
		minBox: null,
		maxBox: null,
		allowedSizes: [1, 2, 4, 8, 16, 24, 32],
		external: false,
		hardpoint: null,
		bay: spec.bay ?? null,
		offset: spec.offset ?? null,
		door: spec.door ?? null
	};
}

/**
 * Shared data contracts for Starculator.
 *
 * Coordinate convention (data and packer, "lattice space"):
 *   x = width  (port ↔ starboard)
 *   y = depth  (fore ↔ aft, along the ship's length)
 *   z = height (deck ↔ ceiling, up)
 * One lattice cell is one SCU footprint: CELL_M metres on every axis.
 * The 3D viewer converts lattice space to Three.js (y-up) space itself.
 */

export const CELL_M = 1.25;

/** Metres. */
export interface Vec3 {
	x: number;
	y: number;
	z: number;
}

/** Integer lattice cells. */
export interface CellVec {
	x: number;
	y: number;
	z: number;
}

export type ContainerSize = 1 | 2 | 4 | 8 | 16 | 24 | 32;
export const CONTAINER_SIZES: readonly ContainerSize[] = [1, 2, 4, 8, 16, 24, 32];

/**
 * Canonical container footprints in cells. x is the long axis.
 * 1 = 1×1×1, 2 = 2×1×1, 4 = 2×2×1, 8 = 2×2×2, 16 = 4×2×2, 24 = 6×2×2, 32 = 8×2×2.
 * Packers may rotate these to any axis-aligned permutation allowed by the grid.
 */
export const CONTAINER_CELLS: Readonly<Record<ContainerSize, CellVec>> = {
	1: { x: 1, y: 1, z: 1 },
	2: { x: 2, y: 1, z: 1 },
	4: { x: 2, y: 2, z: 1 },
	8: { x: 2, y: 2, z: 2 },
	16: { x: 4, y: 2, z: 2 },
	24: { x: 6, y: 2, z: 2 },
	32: { x: 8, y: 2, z: 2 }
};

/** Side of a grid through which cargo is loaded (ramp, door, open side). */
export type DoorFace = '+x' | '-x' | '+y' | '-y';

/** One rectangular cargo grid (CIG models irregular holds as several of these). */
export interface CargoGrid {
	/** Stable id, unique within the ship (derived from the game class name). */
	id: string;
	/** Human label, e.g. "Module 1 · main", "Nose", "Left side". */
	name: string;
	/** Game class name, e.g. DRAK_Caterpillar_CargoInventory_Module. */
	className: string;
	/** Interior size in cells (metres / CELL_M, exact for every current ship). */
	cells: CellVec;
	/** Interior size in metres as published. */
	meters: Vec3;
	/** Capacity in SCU as published (equals cells.x*y*z for every current ship). */
	scu: number;
	/** Smallest / largest permitted item size in metres, per axis, as published (may be absent or wrong). */
	minBox: Vec3 | null;
	maxBox: Vec3 | null;
	/** Container sizes that fit this grid after overrides, derived from minBox/maxBox and the container table. */
	allowedSizes: ContainerSize[];
	/** True when the grid is open to space / external racks (Hull series, Caterpillar, RAFT). */
	external: boolean;
	/** Hardpoint name the grid is mounted on, e.g. hardpoint_cargogrid_module_01. */
	hardpoint: string | null;
	/** Grouping key for grids that form one physical bay (e.g. "module_01" = module + walkway + ladder). */
	bay: string | null;
	/**
	 * Curated placement of the grid's minimum corner relative to the ship origin, in cells.
	 * null when unknown: the viewer then auto-lays grids out side by side.
	 */
	offset: CellVec | null;
	/** Curated access side. null when unknown. */
	door: DoorFace | null;
}

export interface Manufacturer {
	code: string;
	name: string;
}

export interface Ship {
	/** URL slug, e.g. "drake-caterpillar". */
	slug: string;
	/** Display name without manufacturer, e.g. "Caterpillar". */
	name: string;
	/** Full name as published, e.g. "Drake Caterpillar". */
	fullName: string;
	className: string;
	uuid: string;
	manufacturer: Manufacturer;
	/** Game size class, e.g. "Medium", "Large", "Capital" (as published). */
	size: string;
	role: string | null;
	career: string | null;
	/** Hull dimensions in metres: x = width (beam), y = length, z = height. */
	dimensions: Vec3;
	cargoScu: number;
	grids: CargoGrid[];
	/** Largest container that fits any grid. */
	maxContainer: ContainerSize | null;
	isSpaceship: boolean;
	isGroundVehicle: boolean;
	/** Slug of the base ship when this entry is a variant with identical grids (hidden from the picker). */
	variantOf: string | null;
	/** Slugs of variants folded into this entry. */
	variants: string[];
}

/** Lightweight row for the ship picker; the full Ship is loaded per route. */
export interface ShipIndexEntry {
	slug: string;
	name: string;
	fullName: string;
	manufacturer: Manufacturer;
	size: string;
	role: string | null;
	cargoScu: number;
	gridCount: number;
	maxContainer: ContainerSize | null;
	isGroundVehicle: boolean;
}

export interface DataMeta {
	source: 'scunpacked-data';
	repository: string;
	commit: string;
	/** Game build from the upstream commit message, e.g. "4.10.1-LIVE.12660092". */
	gameVersion: string;
	/** ISO date of the upstream commit. */
	publishedAt: string;
	/** ISO timestamp of the ingest run. */
	ingestedAt: string;
	shipCount: number;
	gridCount: number;
}

/** Hand-maintained corrections applied by the ingest script, keyed by ship class name. */
export interface ShipOverride {
	/** Why this override exists and where it was verified. */
	note: string;
	hide?: boolean;
	grids?: Record<
		string,
		{
			name?: string;
			allowedSizes?: ContainerSize[];
			offset?: CellVec;
			door?: DoorFace;
			bay?: string;
		}
	>;
}

/* ---------- Packer contracts ---------- */

export interface PackItem {
	/** Unique per plan. */
	id: string;
	scu: ContainerSize;
	/** Group key (one per contract / destination); drives colour and loading order. */
	group: string;
	label?: string;
}

export interface PackGroup {
	id: string;
	label: string;
	/** 0-based colour slot; the UI maps it to --crate-N. */
	colorIndex: number;
	/** Lower = unloaded first (nearest the door). */
	unloadOrder: number;
}

export interface Placement {
	itemId: string;
	gridId: string;
	/** Minimum corner in grid-local cells. */
	at: CellVec;
	/** Oriented size in cells. */
	dims: CellVec;
	/** Loading sequence index, 0 = first box in. */
	order: number;
}

export interface UnplacedItem {
	item: PackItem;
	reason: 'no-space' | 'too-large-for-any-grid' | 'size-not-allowed';
}

export interface GridFill {
	gridId: string;
	usedCells: number;
	totalCells: number;
}

export interface PackResult {
	placed: Placement[];
	unplaced: UnplacedItem[];
	fills: GridFill[];
	usedScu: number;
	capacityScu: number;
	/** Milliseconds spent, for the UI badge. */
	elapsedMs: number;
}

export interface PackOptions {
	/** Fraction of a box's base that must rest on floor or other boxes (1 = fully supported). */
	support?: number;
	/** Allow axis-aligned rotations of containers. */
	allowRotation?: boolean;
	/** Preferred grid order (ids); grids not listed come after, largest first. */
	gridOrder?: string[];
	/** Pins: placements that must be kept exactly. */
	locked?: Placement[];
	/** Randomised restarts; 0 = deterministic single pass. */
	restarts?: number;
	seed?: number;
}

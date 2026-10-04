/**
 * Hand-maintained corrections to the game data (see overrides.json).
 *
 * Overrides are keyed by the ClassName of the ship they apply to. The ingest
 * script evaluates `hide` on every raw vehicle before variants are folded and
 * applies `grids` to the folded representatives, so a key must name either a
 * vehicle to hide or a representative ship.
 */

import { isContainerSize, maxContainerOf, sizesFittingGrid } from './containers.ts';
import type { CargoGrid, CellVec, DoorFace, Ship, ShipOverride } from './types.ts';

export type OverrideMap = Readonly<Record<string, ShipOverride>>;

type GridOverride = NonNullable<ShipOverride['grids']>[string];

const DOOR_FACES: readonly DoorFace[] = ['+x', '-x', '+y', '-y'];

export class OverrideError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OverrideError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCellVec(value: unknown): value is CellVec {
	return (
		isRecord(value) &&
		Number.isInteger(value.x) &&
		Number.isInteger(value.y) &&
		Number.isInteger(value.z)
	);
}

function parseGridOverride(shipKey: string, gridId: string, value: unknown): GridOverride {
	if (!isRecord(value)) throw new OverrideError(`${shipKey}.grids.${gridId} must be an object`);
	const out: GridOverride = {};
	for (const [field, raw] of Object.entries(value)) {
		const where = `${shipKey}.grids.${gridId}.${field}`;
		switch (field) {
			case 'name':
			case 'bay':
				if (typeof raw !== 'string' || raw.length === 0)
					throw new OverrideError(`${where} must be a non-empty string`);
				out[field] = raw;
				break;
			case 'allowedSizes':
				if (!Array.isArray(raw) || raw.length === 0 || !raw.every(isContainerSize))
					throw new OverrideError(`${where} must be a non-empty list of container sizes`);
				out.allowedSizes = [...new Set(raw)].sort((a, b) => a - b);
				break;
			case 'offset':
				if (!isCellVec(raw)) throw new OverrideError(`${where} must be integer x/y/z cells`);
				out.offset = { x: raw.x, y: raw.y, z: raw.z };
				break;
			case 'door':
				if (typeof raw !== 'string' || !(DOOR_FACES as readonly string[]).includes(raw))
					throw new OverrideError(`${where} must be one of ${DOOR_FACES.join(', ')}`);
				out.door = raw as DoorFace;
				break;
			default:
				throw new OverrideError(`${where} is not a known grid override field`);
		}
	}
	return out;
}

/** Validates the raw JSON of overrides.json and returns it typed. */
export function parseOverrides(raw: unknown): OverrideMap {
	if (!isRecord(raw))
		throw new OverrideError('overrides.json must be an object keyed by ClassName');
	const out: Record<string, ShipOverride> = {};
	for (const [key, value] of Object.entries(raw)) {
		if (key.startsWith('$')) continue; // "$schema"-style metadata keys
		if (!isRecord(value)) throw new OverrideError(`${key} must be an object`);
		if (typeof value.note !== 'string' || value.note.trim().length === 0)
			throw new OverrideError(`${key} needs a non-empty "note" explaining the override`);
		const entry: ShipOverride = { note: value.note };
		if (value.hide !== undefined) {
			if (typeof value.hide !== 'boolean') throw new OverrideError(`${key}.hide must be boolean`);
			entry.hide = value.hide;
		}
		if (value.grids !== undefined) {
			if (!isRecord(value.grids)) throw new OverrideError(`${key}.grids must be an object`);
			entry.grids = {};
			for (const [gridId, gridValue] of Object.entries(value.grids))
				entry.grids[gridId] = parseGridOverride(key, gridId, gridValue);
		}
		for (const field of Object.keys(value))
			if (!['note', 'hide', 'grids'].includes(field))
				throw new OverrideError(`${key}.${field} is not a known override field`);
		out[key] = entry;
	}
	return out;
}

function applyGridOverride(ship: Ship, grid: CargoGrid, patch: GridOverride): CargoGrid {
	if (patch.allowedSizes) {
		const fitting = sizesFittingGrid(grid.cells);
		const impossible = patch.allowedSizes.filter((size) => !fitting.includes(size));
		if (impossible.length > 0)
			throw new OverrideError(
				`${ship.className}.grids.${grid.id}: ${impossible.join(', ')} SCU does not fit a ${grid.cells.x}×${grid.cells.y}×${grid.cells.z}-cell grid`
			);
	}
	return {
		...grid,
		name: patch.name ?? grid.name,
		allowedSizes: patch.allowedSizes ?? grid.allowedSizes,
		bay: patch.bay ?? grid.bay,
		offset: patch.offset ?? grid.offset,
		door: patch.door ?? grid.door
	};
}

/** Returns a new Ship with the override applied. Throws when it names a grid the ship does not have. */
export function applyOverride(ship: Ship, override: ShipOverride): Ship {
	if (!override.grids) return ship;
	const ids = new Set(ship.grids.map((g) => g.id));
	for (const gridId of Object.keys(override.grids))
		if (!ids.has(gridId))
			throw new OverrideError(
				`${ship.className} has no grid "${gridId}" (has: ${[...ids].join(', ')})`
			);
	const grids = ship.grids.map((grid) => {
		const patch = override.grids?.[grid.id];
		return patch ? applyGridOverride(ship, grid, patch) : grid;
	});
	return {
		...ship,
		grids,
		maxContainer: maxContainerOf(grids.flatMap((g) => g.allowedSizes))
	};
}

export interface ApplyResult {
	ships: Ship[];
	/** ClassNames whose grid overrides were applied. */
	applied: string[];
}

/**
 * Applies every grid override to the matching ship. Every key must match a
 * ship unless it only hides (hidden vehicles were removed before folding).
 */
export function applyOverrides(ships: readonly Ship[], overrides: OverrideMap): ApplyResult {
	const byClass = new Map(ships.map((s) => [s.className, s] as const));
	const applied: string[] = [];
	const result = new Map(byClass);
	for (const [className, override] of Object.entries(overrides)) {
		const ship = byClass.get(className);
		if (!ship) {
			if (override.hide && !override.grids) continue;
			throw new OverrideError(
				`override "${className}" matches no representative ship (folded variant, hidden or renamed?)`
			);
		}
		if (!override.grids) continue;
		result.set(className, applyOverride(ship, override));
		applied.push(className);
	}
	return { ships: ships.map((s) => result.get(s.className) ?? s), applied };
}

/** ClassNames the overrides mark as hidden. */
export function hiddenClassNames(overrides: OverrideMap): Set<string> {
	return new Set(
		Object.entries(overrides)
			.filter(([, o]) => o.hide === true)
			.map(([className]) => className)
	);
}

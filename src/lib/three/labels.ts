/**
 * Label planning for the hold viewer: which name tags to show at which
 * density, how to abbreviate grid names when there are too many to spell
 * out, and where "RAMP" tags go. Pure, so it is unit-tested here and reusable
 * by the legend (abbreviation → full name).
 */
import type { DoorFace } from '../data/types.ts';
import { doorOf } from '../packer/geometry.ts';
import type { HoldLayout } from './layout.ts';
import type { CellPoint } from './space.ts';

/** Up to this many grids every grid gets its full name. */
export const MAX_GRID_TAGS = 8;
/** Up to this many bays (when fewer than grids) every bay gets one tag. */
export const MAX_BAY_TAGS = 10;

/**
 * 'grid': one full-name tag per grid. 'bay': one tag per bay (its highlighted
 * grid's name when one is highlighted). 'compact': one abbreviated tag per
 * grid, so a 16-bay Hull C still tells Main 1 from Outer 1.
 */
export type LabelMode = 'grid' | 'bay' | 'compact';

export function labelMode(gridCount: number, bayCount: number): LabelMode {
	if (gridCount <= MAX_GRID_TAGS) return 'grid';
	if (bayCount < gridCount && bayCount <= MAX_BAY_TAGS) return 'bay';
	return 'compact';
}

/**
 * "Main 1" → "M1", "Room small 2" → "RS2", "Module 1 · main" → "M1M":
 * first letter of every word, numbers kept whole, punctuation dropped.
 */
export function abbreviateGridName(name: string): string {
	const tokens = name
		.split(/\s+/)
		.map((t) => t.replace(/^[^\p{L}\p{N}]+/u, ''))
		.filter((t) => t.length > 0);
	const short = tokens.map((t) => (/^\p{N}+$/u.test(t) ? t : t.charAt(0).toUpperCase())).join('');
	return short || '?';
}

/** a, b, …, z, then a2, b2, … so suffixes never run out. */
function collisionSuffix(n: number): string {
	const letter = String.fromCharCode(97 + (n % 26));
	const round = Math.floor(n / 26);
	return round === 0 ? letter : `${letter}${round + 1}`;
}

/**
 * Abbreviations for a list of names, in order. Names whose abbreviation
 * collides get a/b/c suffixes so every tag is unique within the ship.
 */
export function abbreviateGridNames(names: readonly string[]): string[] {
	const base = names.map(abbreviateGridName);
	const total = new Map<string, number>();
	for (const b of base) total.set(b, (total.get(b) ?? 0) + 1);
	const seen = new Map<string, number>();
	return base.map((b) => {
		if ((total.get(b) ?? 0) < 2) return b;
		const n = seen.get(b) ?? 0;
		seen.set(b, n + 1);
		return `${b}${collisionSuffix(n)}`;
	});
}

/** One "RAMP" tag: the edge of `min`/`max` (cells) on `face`. */
export interface DoorSite {
	id: string;
	face: DoorFace;
	min: CellPoint;
	max: CellPoint;
	/** True when at least one covered grid has no curated door (the packer's default is shown). */
	assumed: boolean;
	/** True when the site covers the highlighted grid. */
	active: boolean;
}

function faceOf(gridIds: readonly string[], layout: HoldLayout): DoorFace | null {
	let shared: DoorFace | null = null;
	for (const id of gridIds) {
		const slot = layout.byId.get(id);
		if (!slot) continue;
		const face = doorOf(slot.grid);
		if (shared === null) shared = face;
		else if (shared !== face) return null;
	}
	return shared;
}

function isAssumed(gridIds: readonly string[], layout: HoldLayout): boolean {
	return gridIds.some((id) => layout.byId.get(id)?.grid.door === null);
}

function gridSite(
	gridId: string,
	layout: HoldLayout,
	highlightGridId: string | null
): DoorSite | null {
	const slot = layout.byId.get(gridId);
	if (!slot) return null;
	const { grid, origin } = slot;
	return {
		id: `door:${grid.id}`,
		face: doorOf(grid),
		min: origin,
		max: { x: origin.x + grid.cells.x, y: origin.y + grid.cells.y, z: origin.z + grid.cells.z },
		assumed: grid.door === null,
		active: grid.id === highlightGridId
	};
}

/**
 * "RAMP" tags follow the name-tag density: one per grid in 'grid' mode; one
 * per bay in 'bay' mode when the bay's grids share a door face (else one per
 * grid of that bay); in 'compact' mode a single tag on the hold's front edge
 * when every grid shares a face, plus the highlighted grid's own tag. The
 * chevron strips on the floor are drawn for every grid regardless.
 */
export function doorSites(
	layout: HoldLayout,
	mode: LabelMode,
	highlightGridId: string | null
): DoorSite[] {
	const sites: DoorSite[] = [];
	const push = (site: DoorSite | null) => {
		if (site) sites.push(site);
	};

	if (mode === 'grid') {
		for (const { grid } of layout.grids) push(gridSite(grid.id, layout, highlightGridId));
		return sites;
	}

	if (mode === 'bay') {
		for (const bay of layout.bays) {
			const face = faceOf(bay.gridIds, layout);
			if (face === null) {
				for (const id of bay.gridIds) push(gridSite(id, layout, highlightGridId));
				continue;
			}
			sites.push({
				id: `door:bay:${bay.key}`,
				face,
				min: bay.min,
				max: bay.max,
				assumed: isAssumed(bay.gridIds, layout),
				active: highlightGridId !== null && bay.gridIds.includes(highlightGridId)
			});
		}
		return sites;
	}

	const all = layout.grids.map(({ grid }) => grid.id);
	const shared = faceOf(all, layout);
	if (shared !== null && all.length > 0) {
		sites.push({
			id: 'door:hold',
			face: shared,
			min: layout.min,
			max: layout.max,
			assumed: isAssumed(all, layout),
			active: false
		});
	}
	if (highlightGridId !== null) push(gridSite(highlightGridId, layout, highlightGridId));
	return sites;
}

/**
 * The serialisable shape of a plan, shared by the URL codec, IndexedDB
 * persistence and JSON export. Keep it flat and versioned.
 */
import { CONTAINER_SIZES, type ContainerSize } from '../data/types.ts';

export const SNAPSHOT_VERSION = 1;
export const MAX_GROUPS = 4;
export const MAX_COUNT = 999;
export type ViewMode = 'orbit' | 'top';

export type SizeCounts = Record<ContainerSize, number>;

export interface GroupSnapshot {
	id: string;
	label: string;
	colorIndex: number;
	unloadOrder: number;
	counts: SizeCounts;
}

export interface PlanSnapshot {
	version: typeof SNAPSHOT_VERSION;
	shipSlug: string;
	groups: GroupSnapshot[];
	view: ViewMode;
}

export function emptyCounts(): SizeCounts {
	return { 1: 0, 2: 0, 4: 0, 8: 0, 16: 0, 24: 0, 32: 0 };
}

export function isContainerSize(n: number): n is ContainerSize {
	return (CONTAINER_SIZES as readonly number[]).includes(n);
}

export function clampCount(n: number): number {
	if (!Number.isFinite(n)) return 0;
	return Math.min(MAX_COUNT, Math.max(0, Math.floor(n)));
}

export function totalScu(counts: SizeCounts): number {
	return CONTAINER_SIZES.reduce((sum, size) => sum + size * counts[size], 0);
}

export function totalBoxes(counts: SizeCounts): number {
	return CONTAINER_SIZES.reduce((sum, size) => sum + counts[size], 0);
}

export function defaultGroupLabel(index: number): string {
	return `Contract ${String.fromCharCode(65 + (index % 26))}`;
}

/** Validates untrusted JSON (import, IndexedDB) into a snapshot or null. */
export function parseSnapshot(raw: unknown, fallbackSlug?: string): PlanSnapshot | null {
	if (typeof raw !== 'object' || raw === null) return null;
	const obj = raw as Record<string, unknown>;
	const shipSlug = typeof obj.shipSlug === 'string' ? obj.shipSlug : fallbackSlug;
	if (!shipSlug) return null;
	const groupsRaw = Array.isArray(obj.groups) ? obj.groups : [];
	const groups: GroupSnapshot[] = [];
	groupsRaw.slice(0, MAX_GROUPS).forEach((g, i) => {
		if (typeof g !== 'object' || g === null) return;
		const rec = g as Record<string, unknown>;
		const counts = emptyCounts();
		if (typeof rec.counts === 'object' && rec.counts !== null) {
			for (const [k, v] of Object.entries(rec.counts as Record<string, unknown>)) {
				const size = Number(k);
				if (isContainerSize(size) && typeof v === 'number') counts[size] = clampCount(v);
			}
		}
		groups.push({
			id: typeof rec.id === 'string' && rec.id ? rec.id : `g${i + 1}`,
			label:
				typeof rec.label === 'string' && rec.label.trim()
					? rec.label.slice(0, 40)
					: defaultGroupLabel(i),
			colorIndex: typeof rec.colorIndex === 'number' ? rec.colorIndex % 7 : i % 7,
			unloadOrder: typeof rec.unloadOrder === 'number' ? rec.unloadOrder : i,
			counts
		});
	});
	return {
		version: SNAPSHOT_VERSION,
		shipSlug,
		groups,
		view: obj.view === 'top' ? 'top' : 'orbit'
	};
}

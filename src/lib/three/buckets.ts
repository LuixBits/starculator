/**
 * Groups placements into render buckets for Containers.svelte: one
 * InstancedMesh per distinct (oriented dims, colour, capacity).
 *
 * A bucket is split in two so Svelte can tell what changed between packs:
 * the `BucketShell` (dims, colour, capacity: everything that decides the
 * geometry and material) is immutable and comes from a per-component cache,
 * so its identity is stable while its key is unchanged, and the keyed
 * `{#each}` over shells leaves the existing InstancedMesh, BoxGeometry and
 * material alone. Only the box lists (positions, order) are rebuilt.
 */
import type { CellVec, PackGroup, PackItem, Placement } from '../data/types.ts';
import type { HoldLayout } from './layout.ts';
import { crateColor } from './palette.ts';
import { cellBoxToWorld, type WorldTuple } from './space.ts';

/** Seam between flush containers so a full grid still reads as separate boxes. */
export const SEAM_M = 0.12;
/** Smallest InstancedMesh capacity; capacities double from here. */
export const MIN_LIMIT = 16;

export interface BoxInstance {
	itemId: string;
	center: WorldTuple;
	/** 0-based rank in loading order (drives the drop stagger). */
	rank: number;
}

export interface BucketShell {
	/** `dims|colour|limit`. */
	key: string;
	/** Oriented world size of one box. */
	size: WorldTuple;
	/** `size` minus the seam: the BoxGeometry args. */
	args: WorldTuple;
	color: string;
	/** Capacity of the InstancedMesh; part of the key so growth re-creates it. */
	limit: number;
}

export interface Buckets {
	/** Sorted by key, so equal inputs give equal order. */
	shells: BucketShell[];
	/** Boxes per shell key, in loading order. */
	boxes: ReadonlyMap<string, BoxInstance[]>;
}

export interface BucketInput {
	placements: readonly Placement[];
	items: readonly PackItem[];
	groups: readonly PackGroup[];
	layout: HoldLayout;
}

export function dimsKey(d: CellVec): string {
	return `${d.x}x${d.y}x${d.z}`;
}

/** Smallest power-of-two capacity (at least MIN_LIMIT) that holds `count` boxes. */
export function limitFor(count: number): number {
	let limit = MIN_LIMIT;
	while (limit < count) limit *= 2;
	return limit;
}

/** Hands out one shell object per key for the lifetime of a Containers instance. */
export class BucketCache {
	private readonly shells = new Map<string, BucketShell>();

	shell(dims: CellVec, size: WorldTuple, color: string, limit: number): BucketShell {
		const key = `${dimsKey(dims)}|${color}|${limit}`;
		let shell = this.shells.get(key);
		if (!shell) {
			shell = {
				key,
				size,
				args: [size[0] - SEAM_M, size[1] - SEAM_M, size[2] - SEAM_M],
				color,
				limit
			};
			this.shells.set(key, shell);
		}
		return shell;
	}
}

interface Pending {
	dims: CellVec;
	size: WorldTuple;
	color: string;
	boxes: BoxInstance[];
}

export function groupPlacements(input: BucketInput, cache: BucketCache): Buckets {
	const { placements, items, groups, layout } = input;
	const colorByGroup = new Map(groups.map((g) => [g.id, crateColor(g.colorIndex)]));
	const groupByItem = new Map(items.map((i) => [i.id, i.group]));
	const ordered = [...placements].sort((a, b) => a.order - b.order);

	const pending = new Map<string, Pending>();
	ordered.forEach((p, rank) => {
		const slot = layout.byId.get(p.gridId);
		if (!slot) return;
		const color = colorByGroup.get(groupByItem.get(p.itemId) ?? '') ?? crateColor(0);
		const key = `${dimsKey(p.dims)}|${color}`;
		const world = cellBoxToWorld(
			{ x: slot.origin.x + p.at.x, y: slot.origin.y + p.at.y, z: slot.origin.z + p.at.z },
			p.dims
		);
		const box: BoxInstance = { itemId: p.itemId, center: world.center, rank };
		const bucket = pending.get(key);
		if (bucket) bucket.boxes.push(box);
		else pending.set(key, { dims: p.dims, size: world.size, color, boxes: [box] });
	});

	const shells: BucketShell[] = [];
	const boxes = new Map<string, BoxInstance[]>();
	for (const b of pending.values()) {
		const shell = cache.shell(b.dims, b.size, b.color, limitFor(b.boxes.length));
		shells.push(shell);
		boxes.set(shell.key, b.boxes);
	}
	shells.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
	return { shells, boxes };
}

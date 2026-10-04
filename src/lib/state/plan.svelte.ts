/**
 * The planner's state for one ship: contract groups with per-size counts, the
 * last pack result, the selected box and the viewer mode. A plain runes class;
 * pages create one per ship and pass it down.
 */
import {
	CONTAINER_SIZES,
	type CargoGrid,
	type ContainerSize,
	type PackGroup,
	type PackItem,
	type PackResult,
	type Placement
} from '../data/types.ts';
import { expandCounts, runPack } from './adapters.ts';
import {
	MAX_GROUPS,
	SNAPSHOT_VERSION,
	clampCount,
	defaultGroupLabel,
	emptyCounts,
	totalBoxes,
	totalScu,
	type GroupSnapshot,
	type PlanSnapshot,
	type ViewMode
} from './snapshot.ts';

export type PlanStatus = 'idle' | 'packing' | 'ready' | 'stale' | 'error';

export class Plan {
	readonly shipSlug: string;
	groups = $state<GroupSnapshot[]>([]);
	result = $state<PackResult | null>(null);
	status = $state<PlanStatus>('idle');
	error = $state<string | null>(null);
	selectedItemId = $state<string | null>(null);
	view = $state<ViewMode>('orbit');

	/** Flat item list in group order; ids are stable for a given set of counts. */
	readonly items: PackItem[] = $derived.by(() =>
		this.groups.flatMap((g) => expandCounts(g.counts, g.id))
	);
	readonly packGroups: PackGroup[] = $derived.by(() =>
		this.groups.map(({ id, label, colorIndex, unloadOrder }) => ({
			id,
			label,
			colorIndex,
			unloadOrder
		}))
	);
	readonly totalScu: number = $derived(this.groups.reduce((s, g) => s + totalScu(g.counts), 0));
	readonly totalBoxes: number = $derived(this.groups.reduce((s, g) => s + totalBoxes(g.counts), 0));
	readonly placements: Placement[] = $derived(this.result?.placed ?? []);
	readonly itemsById: Readonly<Record<string, PackItem>> = $derived(
		Object.fromEntries(this.items.map((i) => [i.id, i]))
	);
	readonly selectedPlacement: Placement | null = $derived(
		this.placements.find((p) => p.itemId === this.selectedItemId) ?? null
	);

	private packRun = 0;

	constructor(shipSlug: string, snapshot?: PlanSnapshot | null) {
		this.shipSlug = shipSlug;
		if (snapshot) this.restore(snapshot);
		if (this.groups.length === 0) this.addGroup();
	}

	/* ---------- groups ---------- */

	addGroup(label?: string): GroupSnapshot | null {
		if (this.groups.length >= MAX_GROUPS) return null;
		const used = this.groups.map((g) => g.colorIndex);
		let colorIndex = 0;
		while (used.includes(colorIndex)) colorIndex++;
		let n = this.groups.length + 1;
		while (this.groups.some((g) => g.id === `g${n}`)) n++;
		const group: GroupSnapshot = {
			id: `g${n}`,
			label: label?.trim() || defaultGroupLabel(this.groups.length),
			colorIndex: colorIndex % 7,
			unloadOrder: this.groups.length,
			counts: emptyCounts()
		};
		this.groups.push(group);
		return group;
	}

	removeGroup(id: string): void {
		if (this.groups.length <= 1) {
			this.clearGroup(id);
			return;
		}
		this.groups = this.groups.filter((g) => g.id !== id).map((g, i) => ({ ...g, unloadOrder: i }));
		this.invalidate();
	}

	renameGroup(id: string, label: string): void {
		const g = this.groupById(id);
		if (g) g.label = label.slice(0, 40);
	}

	groupById(id: string): GroupSnapshot | undefined {
		return this.groups.find((g) => g.id === id);
	}

	/* ---------- counts ---------- */

	setCount(groupId: string, size: ContainerSize, n: number): void {
		const g = this.groupById(groupId);
		if (!g) return;
		const next = clampCount(n);
		if (g.counts[size] === next) return;
		g.counts[size] = next;
		this.invalidate();
	}

	increment(groupId: string, size: ContainerSize, delta = 1): void {
		const g = this.groupById(groupId);
		if (g) this.setCount(groupId, size, g.counts[size] + delta);
	}

	clearGroup(groupId: string): void {
		const g = this.groupById(groupId);
		if (!g) return;
		g.counts = emptyCounts();
		this.invalidate();
	}

	/** Removes every box but keeps the groups, so labels survive. */
	clear(): void {
		for (const g of this.groups) g.counts = emptyCounts();
		this.result = null;
		this.status = 'idle';
		this.error = null;
		this.selectedItemId = null;
	}

	/* ---------- selection / view ---------- */

	select(itemId: string | null): void {
		this.selectedItemId = itemId;
	}

	setView(view: ViewMode): void {
		this.view = view;
	}

	/* ---------- packing ---------- */

	async pack(grids: readonly CargoGrid[]): Promise<PackResult | null> {
		const run = ++this.packRun;
		if (this.items.length === 0) {
			this.result = null;
			this.status = 'idle';
			return null;
		}
		this.status = 'packing';
		this.error = null;
		try {
			// Snapshots: the worker structured-clones its input, and proxies do not clone.
			const result = await runPack(
				$state.snapshot(grids),
				$state.snapshot(this.items),
				$state.snapshot(this.packGroups)
			);
			if (run !== this.packRun) return null;
			this.result = result;
			this.status = 'ready';
			if (this.selectedItemId && !result.placed.some((p) => p.itemId === this.selectedItemId)) {
				this.selectedItemId = null;
			}
			return result;
		} catch (err) {
			if (run !== this.packRun) return null;
			this.status = 'error';
			this.error = err instanceof Error ? err.message : 'Packing failed';
			return null;
		}
	}

	/** Called after any count change: an existing plan no longer matches the manifest. */
	private invalidate(): void {
		if (this.result) this.status = 'stale';
		if (this.items.length === 0) {
			this.result = null;
			this.status = 'idle';
		}
	}

	/* ---------- snapshots ---------- */

	snapshot(): PlanSnapshot {
		return {
			version: SNAPSHOT_VERSION,
			shipSlug: this.shipSlug,
			groups: this.groups.map((g) => ({ ...g, counts: { ...g.counts } })),
			view: this.view
		};
	}

	restore(snapshot: PlanSnapshot): void {
		this.groups = snapshot.groups.slice(0, MAX_GROUPS).map((g, i) => ({
			id: g.id,
			label: g.label,
			colorIndex: g.colorIndex % 7,
			unloadOrder: i,
			counts: { ...emptyCounts(), ...g.counts }
		}));
		this.view = snapshot.view;
		this.result = null;
		this.status = 'idle';
		this.error = null;
		this.selectedItemId = null;
	}

	/** True when any group has at least one box. */
	get hasItems(): boolean {
		return this.groups.some((g) => CONTAINER_SIZES.some((s) => g.counts[s] > 0));
	}
}

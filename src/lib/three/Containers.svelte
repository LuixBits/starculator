<script lang="ts">
	/**
	 * All placed containers as instanced boxes: one InstancedMesh per distinct
	 * (oriented dims, colour) pair so the emissive tint can match the group
	 * colour. Boxes drop into place in loading order; the selected box is
	 * lifted slightly and outlined.
	 */
	import { T, useTask } from '@threlte/core';
	import { Edges, Instance, InstancedMesh, type IntersectionEvent } from '@threlte/extras';
	import { browser } from '$app/env';
	import { cubicOut } from 'svelte/easing';
	import type { CellVec, PackGroup, PackItem, Placement } from '../data/types.ts';
	import type { HoldLayout } from './layout.ts';
	import { crateColor, desaturateHex, SCENE_COLORS } from './palette.ts';
	import { cellBoxToWorld, type WorldTuple } from './space.ts';

	interface Props {
		placements: Placement[];
		items: PackItem[];
		groups: PackGroup[];
		layout: HoldLayout;
		selectedItemId?: string | null;
		onselect?: (itemId: string | null) => void;
	}

	let { placements, items, groups, layout, selectedItemId = null, onselect }: Props = $props();

	interface Box {
		itemId: string;
		center: WorldTuple;
		/** 0-based rank in loading order (drives the drop stagger). */
		rank: number;
	}

	interface Bucket {
		key: string;
		size: WorldTuple;
		color: string;
		/** Capacity of the InstancedMesh; part of the key so growth re-creates it. */
		limit: number;
		boxes: Box[];
	}

	const STAGGER_MS = 40;
	const DROP_MS = 300;
	const DROP_HEIGHT_M = 2.5;
	const SELECT_LIFT_M = 0.15;

	const colorByGroup = $derived(new Map(groups.map((g) => [g.id, crateColor(g.colorIndex)])));
	const groupByItem = $derived(new Map(items.map((i) => [i.id, i.group])));

	function dimsKey(d: CellVec): string {
		return `${d.x}x${d.y}x${d.z}`;
	}

	function limitFor(count: number): number {
		let limit = 16;
		while (limit < count) limit *= 2;
		return limit;
	}

	const buckets = $derived.by<Bucket[]>(() => {
		const ordered = [...placements].sort((a, b) => a.order - b.order);
		// A plain record keyed by "dims|colour"; a Map would trip svelte/prefer-svelte-reactivity.
		const byKey: Record<string, { size: WorldTuple; color: string; boxes: Box[] }> =
			Object.create(null);
		ordered.forEach((p, rank) => {
			const slot = layout.byId.get(p.gridId);
			if (!slot) return;
			const color = colorByGroup.get(groupByItem.get(p.itemId) ?? '') ?? crateColor(0);
			const key = `${dimsKey(p.dims)}|${color}`;
			const world = cellBoxToWorld(
				{ x: slot.origin.x + p.at.x, y: slot.origin.y + p.at.y, z: slot.origin.z + p.at.z },
				p.dims
			);
			const box: Box = { itemId: p.itemId, center: world.center, rank };
			const bucket = byKey[key];
			if (bucket) bucket.boxes.push(box);
			else byKey[key] = { size: world.size, color, boxes: [box] };
		});
		return Object.entries(byKey).map(([key, b]) => {
			const limit = limitFor(b.boxes.length);
			return { key: `${key}|${limit}`, limit, ...b };
		});
	});

	const selected = $derived.by(() => {
		if (!selectedItemId) return null;
		for (const bucket of buckets) {
			const box = bucket.boxes.find((b) => b.itemId === selectedItemId);
			if (box) return { box, size: bucket.size };
		}
		return null;
	});

	/* ---- drop animation ---- */

	let reducedMotion = $state(false);
	$effect(() => {
		if (!browser) return;
		const query = window.matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => (reducedMotion = query.matches);
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	let clockMs = $state(Infinity);
	let animating = $state(false);
	const totalMs = $derived(DROP_MS + STAGGER_MS * Math.max(0, placements.length - 1));

	$effect(() => {
		// Re-run whenever a new placement list arrives.
		void placements;
		if (reducedMotion) {
			clockMs = Infinity;
			animating = false;
			return;
		}
		clockMs = 0;
		animating = true;
	});

	useTask(
		(delta) => {
			clockMs += delta * 1000;
			if (clockMs >= totalMs) {
				clockMs = Infinity;
				animating = false;
			}
		},
		{ running: () => animating }
	);

	function lift(box: Box): number {
		const t = Math.min(1, Math.max(0, (clockMs - box.rank * STAGGER_MS) / DROP_MS));
		const drop = (1 - cubicOut(t)) * DROP_HEIGHT_M;
		return drop + (box.itemId === selectedItemId ? SELECT_LIFT_M : 0);
	}

	function positionOf(box: Box): WorldTuple {
		return [box.center[0], box.center[1] + lift(box), box.center[2]];
	}

	/* ---- selection ---- */

	// `pointermissed` fires before the hit dispatch, so defer the deselect one
	// microtask and let a box click veto it.
	let hitThisClick = false;

	function onBoxClick(itemId: string) {
		hitThisClick = true;
		onselect?.(itemId);
	}

	function onMissed() {
		queueMicrotask(() => {
			if (!hitThisClick) onselect?.(null);
			hitThisClick = false;
		});
	}
</script>

<T.Group onpointermissed={onMissed} />

{#each buckets as bucket (bucket.key)}
	<InstancedMesh limit={bucket.limit} range={bucket.boxes.length} frustumCulled={false}>
		<T.BoxGeometry args={bucket.size} />
		<T.MeshStandardMaterial
			color={desaturateHex(bucket.color, 0.12)}
			emissive={bucket.color}
			emissiveIntensity={0.38}
			roughness={0.6}
			metalness={0.1}
		/>
		{#each bucket.boxes as box (box.itemId)}
			<Instance
				position={positionOf(box)}
				onclick={(e: IntersectionEvent<MouseEvent>) => {
					e.stopPropagation();
					onBoxClick(box.itemId);
				}}
			/>
		{/each}
	</InstancedMesh>
{/each}

{#if selected}
	<T.Mesh position={positionOf(selected.box)} renderOrder={4}>
		<T.BoxGeometry
			args={[selected.size[0] * 1.01, selected.size[1] * 1.01, selected.size[2] * 1.01]}
		/>
		<T.MeshBasicMaterial transparent opacity={0} depthWrite={false} />
		<Edges color={SCENE_COLORS.fg} />
	</T.Mesh>
{/if}

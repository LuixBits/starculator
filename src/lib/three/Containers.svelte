<script lang="ts">
	/**
	 * All placed containers as instanced boxes: one InstancedMesh per distinct
	 * (oriented dims, colour) pair so the emissive tint can match the group
	 * colour. Boxes drop into place in loading order; the selected box is
	 * lifted slightly and outlined.
	 *
	 * The bucket shells come from a per-instance cache (buckets.ts), so a
	 * re-pack that keeps the same dims/colour/capacity hands the keyed each
	 * block the very same shell object: Svelte sees no change, Threlte keeps
	 * the BoxGeometry and material, and only the Instance positions move.
	 */
	import { T, useTask } from '@threlte/core';
	import { Edges, Instance, InstancedMesh, type IntersectionEvent } from '@threlte/extras';
	import { browser } from '$app/env';
	import { cubicOut } from 'svelte/easing';
	import type { PackGroup, PackItem, Placement } from '../data/types.ts';
	import { BucketCache, groupPlacements, type BoxInstance, type BucketShell } from './buckets.ts';
	import type { HoldLayout } from './layout.ts';
	import { desaturateHex, mixHex, SCENE_COLORS } from './palette.ts';
	import type { WorldTuple } from './space.ts';

	interface Props {
		placements: Placement[];
		items: PackItem[];
		groups: PackGroup[];
		layout: HoldLayout;
		selectedItemId?: string | null;
		onselect?: (itemId: string | null) => void;
	}

	let { placements, items, groups, layout, selectedItemId = null, onselect }: Props = $props();

	const STAGGER_MS = 40;
	const DROP_MS = 300;
	const DROP_HEIGHT_M = 2.5;
	const SELECT_LIFT_M = 0.15;
	/** Alternate boxes in loading order are shaded a little darker so flush boxes stay distinct. */
	const ALT_SHADE = 0.16;

	const cache = new BucketCache();
	const buckets = $derived(groupPlacements({ placements, items, groups, layout }, cache));

	function boxesOf(shell: BucketShell): BoxInstance[] {
		return buckets.boxes.get(shell.key) ?? [];
	}

	const selected = $derived.by(() => {
		if (!selectedItemId) return null;
		for (const shell of buckets.shells) {
			const box = boxesOf(shell).find((b) => b.itemId === selectedItemId);
			if (box) return { box, size: shell.size };
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

	function lift(box: BoxInstance): number {
		const t = Math.min(1, Math.max(0, (clockMs - box.rank * STAGGER_MS) / DROP_MS));
		const drop = (1 - cubicOut(t)) * DROP_HEIGHT_M;
		return drop + (box.itemId === selectedItemId ? SELECT_LIFT_M : 0);
	}

	function positionOf(box: BoxInstance): WorldTuple {
		return [box.center[0], box.center[1] + lift(box), box.center[2]];
	}

	/** Per-instance tint (multiplies the white material colour). */
	function tintOf(shell: BucketShell, box: BoxInstance): string {
		const body = desaturateHex(shell.color, 0.12);
		return box.rank % 2 === 0 ? body : mixHex(body, '#000000', ALT_SHADE);
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

{#each buckets.shells as shell (shell.key)}
	<InstancedMesh limit={shell.limit} range={boxesOf(shell).length} frustumCulled={false}>
		<T.BoxGeometry args={shell.args} />
		<T.MeshStandardMaterial
			color="#ffffff"
			emissive={shell.color}
			emissiveIntensity={0.3}
			roughness={0.6}
			metalness={0.1}
		/>
		{#each boxesOf(shell) as box (box.itemId)}
			<Instance
				position={positionOf(box)}
				color={tintOf(shell, box)}
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

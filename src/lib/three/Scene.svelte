<script lang="ts">
	/**
	 * Everything inside the Canvas: lighting, fog, holo-table floor, grids,
	 * containers, silhouette, labels and camera. Must live under <Canvas>
	 * because interactivity() and useThrelte() need its context.
	 */
	import { T, useThrelte } from '@threlte/core';
	import { Grid, interactivity } from '@threlte/extras';
	import { Color, Fog } from 'three';
	import type { PackGroup, PackItem, Placement, Ship } from '../data/types.ts';
	import Containers from './Containers.svelte';
	import GridVolume from './GridVolume.svelte';
	import HoldCamera from './HoldCamera.svelte';
	import HoldLabels from './HoldLabels.svelte';
	import ShipSilhouette from './ShipSilhouette.svelte';
	import type { HoldLayout } from './layout.ts';
	import { mixHex, SCENE_COLORS } from './palette.ts';
	import {
		boundsCenter,
		boundsRadius,
		boundsSize,
		cellBoundsToWorld,
		cellToWorld,
		type WorldTuple
	} from './space.ts';

	interface Props {
		ship: Ship;
		layout: HoldLayout;
		placements: Placement[];
		groups: PackGroup[];
		items: PackItem[];
		selectedItemId: string | null;
		onselect?: (itemId: string | null) => void;
		view: 'perspective' | 'top';
		highlightGridId: string | null;
		showLabels: boolean;
		showSilhouette: boolean;
	}

	let {
		ship,
		layout,
		placements,
		groups,
		items,
		selectedItemId,
		onselect,
		view,
		highlightGridId,
		showLabels,
		showSilhouette
	}: Props = $props();

	interactivity();

	const { scene, invalidate } = useThrelte();

	const bounds = $derived(cellBoundsToWorld(layout.min, layout.max));
	const center = $derived(boundsCenter(bounds));
	const radius = $derived(Math.max(4, boundsRadius(bounds)));
	const floorSize = $derived.by<[number, number]>(() => {
		const [w, , d] = boundsSize(bounds);
		const pad = Math.max(12, radius);
		return [w + pad * 2, d + pad * 2];
	});

	/** Hull centre: on the grid footprint, vertically centred on the hull height. */
	const hullCenter = $derived<WorldTuple>([
		center[0],
		Math.max(ship.dimensions.z / 2 - 1.5, bounds.max[1] / 2),
		center[2]
	]);

	$effect(() => {
		scene.background = new Color(SCENE_COLORS.bgDeep);
		scene.fog = new Fog(SCENE_COLORS.bgDeep, radius * 3, radius * 9);
		invalidate();
		return () => {
			scene.background = null;
			scene.fog = null;
		};
	});

	const keyLight = $derived<WorldTuple>([
		center[0] + radius * 1.5,
		radius * 2.2,
		center[2] + radius * 1.2
	]);
	const fillLight = $derived<WorldTuple>([
		center[0] - radius * 1.6,
		radius * 1.2,
		center[2] - radius * 1.6
	]);
</script>

<HoldCamera {view} {bounds} fitKey={ship.slug} />

<T.HemisphereLight
	args={[SCENE_COLORS.skyViolet, SCENE_COLORS.groundViolet, 1.4]}
	position={[0, 1, 0]}
/>
<T.DirectionalLight color="#bff6ff" intensity={2.4} position={keyLight} />
<T.DirectionalLight color={SCENE_COLORS.accent} intensity={0.55} position={fillLight} />

<Grid
	position={[center[0], -0.02, center[2]]}
	cellSize={1.25}
	sectionSize={2.5}
	cellColor={mixHex(SCENE_COLORS.bgDeep, SCENE_COLORS.accent2, 0.42)}
	sectionColor={SCENE_COLORS.accent}
	cellThickness={0.7}
	sectionThickness={1.1}
	gridSize={floorSize}
	fadeDistance={radius * 2.4}
	fadeStrength={1.6}
	fadeOrigin={[center[0], 0, center[2]]}
/>

{#each layout.grids as slot (slot.grid.id)}
	<GridVolume
		grid={slot.grid}
		position={cellToWorld(slot.origin)}
		highlighted={slot.grid.id === highlightGridId}
	/>
{/each}

<Containers {placements} {items} {groups} {layout} {selectedItemId} {onselect} />

{#if showSilhouette}
	<ShipSilhouette {ship} center={hullCenter} />
{/if}

{#if showLabels}
	<HoldLabels {layout} {highlightGridId} />
{/if}

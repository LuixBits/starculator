<script lang="ts">
	/**
	 * The 3D hold viewer. The only component the app mounts from this folder.
	 * SSR-safe: Threlte's <Canvas> renders nothing until it is in the browser.
	 */
	import { Canvas } from '@threlte/core';
	import { NoToneMapping } from 'three';
	import type { PackGroup, PackItem, Placement, Ship } from '../data/types.ts';
	import Scene from './Scene.svelte';
	import { layoutGrids } from './layout.ts';

	export interface HoldSceneProps {
		ship: Ship;
		placements: Placement[];
		groups: PackGroup[];
		items: PackItem[];
		selectedItemId?: string | null;
		onselect?: (itemId: string | null) => void;
		/** Bindable. */
		view?: 'perspective' | 'top';
		highlightGridId?: string | null;
		/** Grid name tags and door "RAMP" tags as HTML overlays (class `hold-label`). */
		showLabels?: boolean;
		/**
		 * Wireframe hull bounding box for scale. Defaults to on only when the
		 * grids have curated offsets; in a schematic layout the hull says nothing.
		 */
		showSilhouette?: boolean;
		class?: string;
	}

	let {
		ship,
		placements,
		groups,
		items,
		selectedItemId = null,
		onselect,
		view = $bindable('perspective'),
		highlightGridId = null,
		showLabels = true,
		showSilhouette,
		class: className
	}: HoldSceneProps = $props();

	const layout = $derived(layoutGrids(ship.grids));
	const silhouette = $derived(showSilhouette ?? layout.curated);
</script>

<div class={['hold-scene', className]} data-view={view}>
	<Canvas renderMode="on-demand" dpr={[1, 2]} toneMapping={NoToneMapping}>
		<Scene
			{ship}
			{layout}
			{placements}
			{groups}
			{items}
			{selectedItemId}
			{onselect}
			{view}
			{highlightGridId}
			{showLabels}
			showSilhouette={silhouette}
		/>
	</Canvas>
</div>

<style>
	.hold-scene {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		touch-action: none;
		overflow: hidden;
		background: #160a30;
	}
</style>

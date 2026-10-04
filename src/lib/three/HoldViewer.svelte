<script lang="ts">
	/**
	 * The Threlte side of the hold viewer. HoldScene.svelte loads this lazily
	 * so three.js and @threlte stay out of the page's initial chunk; nothing
	 * else should import this file directly.
	 */
	import { Canvas } from '@threlte/core';
	import { NoToneMapping } from 'three';
	import Scene from './Scene.svelte';
	import { layoutGrids } from './layout.ts';
	import type { HoldViewerProps } from './props.ts';

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
		showSilhouette
	}: HoldViewerProps = $props();

	const layout = $derived(layoutGrids(ship.grids));
	const silhouette = $derived(showSilhouette ?? layout.curated);
</script>

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

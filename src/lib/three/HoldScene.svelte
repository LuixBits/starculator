<script lang="ts">
	/**
	 * The 3D hold viewer. The only component the app mounts from this folder.
	 *
	 * This is a thin shell: it renders the labelled wrapper on the server and
	 * on first paint, then dynamically imports HoldViewer.svelte (three.js +
	 * Threlte, ~900 kB minified) in the browser, so the manifest and the rest
	 * of the page do not wait for the 3D bundle. While the import is in flight
	 * the host's idle text behind the wrapper stays visible.
	 */
	import { onMount, type Component } from 'svelte';
	import type { HoldSceneProps, HoldViewerProps } from './props.ts';

	let {
		ship,
		placements,
		view = $bindable('perspective'),
		class: className,
		...rest
	}: HoldSceneProps = $props();

	let Viewer = $state.raw<Component<HoldViewerProps> | null>(null);
	let failed = $state(false);

	onMount(() => {
		let cancelled = false;
		import('./HoldViewer.svelte').then(
			(module) => {
				if (!cancelled) Viewer = module.default;
			},
			(error: unknown) => {
				if (cancelled) return;
				failed = true;
				console.error('HoldScene: the 3D viewer failed to load', error);
			}
		);
		return () => {
			cancelled = true;
		};
	});

	const label = $derived.by(() => {
		const grids = ship.grids.length;
		const boxes = placements.length;
		return (
			`${ship.fullName} hold: ${grids} cargo ${grids === 1 ? 'grid' : 'grids'}, ` +
			`${boxes} ${boxes === 1 ? 'box' : 'boxes'} placed`
		);
	});
</script>

<!--
	role="img": the canvas has no accessible content of its own, and the HTML
	label overlays would otherwise be read as loose text. The loading order
	and per-grid bars on the page carry the same data for assistive tech.
-->
<div
	class={['hold-scene', className]}
	data-view={view}
	role="img"
	aria-label={label}
	aria-busy={Viewer === null && !failed}
>
	{#if Viewer}
		<Viewer {ship} {placements} bind:view {...rest} />
	{:else if failed}
		<p class="hold-scene__error">3D viewer unavailable · the loading order below has the plan</p>
	{/if}
</div>

<style>
	.hold-scene {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		touch-action: none;
		overflow: hidden;
	}
	/*
	 * <HTML> overlays are portalled next to the canvas. Without `transform`,
	 * @threlte/extras does not apply its pointerEvents prop, so the tags would
	 * swallow clicks meant for the boxes behind them.
	 */
	.hold-scene :global(canvas ~ div) {
		pointer-events: none;
	}
	.hold-scene__error {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		margin: 0;
		padding: 1rem;
		text-align: center;
		color: #8f7cab;
		font-size: var(--fs-small);
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
</style>

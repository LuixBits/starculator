<script lang="ts">
	import DepartureBoard from '#lib/components/DepartureBoard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const totalScu = $derived(data.index.reduce((s, e) => s + e.cargoScu, 0));
</script>

<svelte:head>
	<title>Ships · Starculator</title>
	<meta
		name="description"
		content="Every Star Citizen ship with a cargo grid: capacity in SCU, number of grids and the largest container each hold accepts."
	/>
</svelte:head>

<section class="intro">
	<p class="eyebrow">Departures · all ships</p>
	<p>
		{data.index.length} ships with cargo grids, {totalScu.toLocaleString('en-US')} SCU between them. Sort
		by name or capacity, filter for ships that take a 32-SCU box, then open a planner.
	</p>
</section>

<DepartureBoard entries={data.index} title="All departures" sortable initialSort="scu" />

<style>
	.intro {
		display: grid;
		gap: 0.5rem;
		max-width: 52rem;
		padding-bottom: 2rem;
		color: var(--fg-muted);
	}
</style>

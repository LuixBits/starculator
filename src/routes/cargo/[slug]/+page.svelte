<script lang="ts">
	import Planner from '#lib/components/Planner.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const description = $derived(
		`Cargo planner for the ${data.ship.fullName}: ${data.ship.cargoScu} SCU across ${data.ship.grids.length} grids, largest container ${data.ship.maxContainer ?? '—'} SCU. Enter your containers and get a load plan.`
	);
</script>

<svelte:head>
	<title>{data.ship.fullName} cargo planner · Starculator</title>
	<meta name="description" content={description} />
</svelte:head>

{#key data.ship.slug}
	<Planner ship={data.ship} />
{/key}

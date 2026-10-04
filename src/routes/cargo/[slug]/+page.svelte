<script lang="ts">
	import Planner from '#lib/components/Planner.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const title = $derived(data.variant?.fullName ?? data.ship.fullName);
	const description = $derived(
		`Cargo planner for the ${title}: ${data.ship.cargoScu} SCU across ${data.ship.grids.length} grids, largest container ${data.ship.maxContainer ?? '—'} SCU. Enter your containers and get a load plan.`
	);
</script>

<svelte:head>
	<title>{title} cargo planner · Starculator</title>
	<meta name="description" content={description} />
</svelte:head>

{#if data.variant}
	<p class="variant-note">
		The <strong>{data.variant.fullName}</strong> carries the same cargo grids as the
		<a href="/cargo/{data.ship.slug}/">{data.ship.fullName}</a>; the plan below is saved under that
		hull.
	</p>
{/if}

{#key data.ship.slug}
	<Planner ship={data.ship} />
{/key}

<style>
	.variant-note {
		max-width: 52rem;
		margin-bottom: 1.25rem;
		padding: 0.6rem 0.9rem;
		border-left: 3px solid var(--neon-violet);
		background: #bfa0ff14;
		color: var(--fg-muted);
		font-size: var(--fs-small);
	}
	.variant-note strong {
		color: var(--fg);
	}
</style>

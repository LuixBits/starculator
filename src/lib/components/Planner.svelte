<script lang="ts">
	/**
	 * The planner for one ship: owns the Plan store, syncs it with the URL and
	 * IndexedDB, and composes the holo-table, manifest, scale, hazard tags, legend
	 * and loading order. The page wraps this in {#key ship.slug}.
	 */
	import type { Snippet } from 'svelte';
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/env';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import type { Ship } from '../data/types.ts';
	import { Plan } from '../state/plan.svelte.ts';
	import { createDebouncedSaver, loadStoredPlan } from '../state/persist.ts';
	import { decodePlan, encodePlanQuery } from '../state/url.ts';
	import type { ViewMode } from '../state/snapshot.ts';
	import { UNPLACED_REASON } from '../ui/crates.ts';
	import { formatPercent, formatScu } from '../ui/format.ts';
	import HoloTable from './HoloTable.svelte';
	import GridLattice from './GridLattice.svelte';
	import ManifestSheet from './ManifestSheet.svelte';
	import CargoScale from './CargoScale.svelte';
	import HazardTag from './HazardTag.svelte';
	import GridLegend from './GridLegend.svelte';
	import LoadingOrder from './LoadingOrder.svelte';
	import PlanTools from './PlanTools.svelte';

	let {
		ship,
		viewer
	}: {
		ship: Ship;
		/**
		 * Optional 3D viewer rendered on the holo-table instead of the lattice preview.
		 * INTEGRATION: the page passes a snippet wrapping #lib/three/HoldScene.svelte.
		 */
		viewer?: Snippet<[Plan]>;
	} = $props();

	// svelte-ignore state_referenced_locally (the page re-keys this component per ship)
	const plan = new Plan(ship.slug);
	const saver = createDebouncedSaver();
	let hydrated = $state(false);
	let orderOpen = $state(true);

	const shareUrl = $derived.by(() => {
		const query = encodePlanQuery(plan.snapshot());
		return browser
			? `${page.url.origin}${page.url.pathname}${query}`
			: `${page.url.pathname}${query}`;
	});
	type Reason = keyof typeof UNPLACED_REASON;
	const unplacedSummary = $derived.by(() => {
		const byReason: Partial<Record<Reason, { count: number; scu: number; sizes: number[] }>> = {};
		for (const u of plan.result?.unplaced ?? []) {
			const row = byReason[u.reason] ?? { count: 0, scu: 0, sizes: [] };
			row.count++;
			row.scu += u.item.scu;
			if (!row.sizes.includes(u.item.scu)) row.sizes.push(u.item.scu);
			byReason[u.reason] = row;
		}
		return (Object.keys(byReason) as Reason[]).map((reason) => {
			const row = byReason[reason] ?? { count: 0, scu: 0, sizes: [] };
			return {
				reason: UNPLACED_REASON[reason],
				...row,
				sizes: [...row.sizes].sort((a, b) => b - a)
			};
		});
	});

	function runPlan() {
		void plan.pack(ship.grids);
	}

	async function hydrate() {
		const fromUrl = decodePlan(page.url.searchParams, ship.slug);
		if (fromUrl) {
			plan.restore(fromUrl);
		} else {
			const stored = await loadStoredPlan(ship.slug);
			if (stored) plan.restore(stored);
		}
		if (plan.groups.length === 0) plan.addGroup();
		orderOpen = !window.matchMedia('(max-width: 60rem)').matches;
		hydrated = true;
		if (plan.hasItems) runPlan();
	}

	onMount(() => {
		void hydrate();
	});
	onDestroy(() => saver.cancel());

	// Mirror every manifest change into the address bar and the local database.
	$effect(() => {
		if (!hydrated) return;
		const snapshot = plan.snapshot();
		const query = encodePlanQuery(snapshot);
		const target = `${page.url.pathname}${query}`;
		if (`${page.url.pathname}${page.url.search}` !== target) {
			void goto(target, { shallow: true, replace: true, state: {} });
		}
		saver.save(snapshot);
	});

	const views: { id: ViewMode; label: string }[] = [
		{ id: 'orbit', label: '3D' },
		{ id: 'top', label: 'Top' }
	];
</script>

<div class="planner">
	<header class="ship-head">
		<p class="eyebrow">
			{ship.manufacturer.name} · {ship.size}{#if ship.role}
				· {ship.role}{/if}
		</p>
		<h1 class="ship-name">{ship.name}</h1>
		<p class="ship-facts">
			<span><strong>{formatScu(ship.cargoScu)}</strong> SCU</span>
			<span><strong>{ship.grids.length}</strong> {ship.grids.length === 1 ? 'grid' : 'grids'}</span>
			<span>max box <strong>{ship.maxContainer ?? '—'}</strong> SCU</span>
			<span class="muted">{ship.dimensions.y} × {ship.dimensions.x} × {ship.dimensions.z} m</span>
		</p>
	</header>

	<div class="table-col">
		<HoloTable caption={`${ship.fullName} · hold projection`}>
			{#snippet controls()}
				<div class="view-toggle" role="group" aria-label="View">
					{#each views as v (v.id)}
						<button
							type="button"
							aria-pressed={plan.view === v.id}
							onclick={() => plan.setView(v.id)}>{v.label}</button
						>
					{/each}
				</div>
			{/snippet}
			{#if viewer}
				{@render viewer(plan)}
			{:else}
				<GridLattice
					{ship}
					placements={plan.placements}
					groups={plan.packGroups}
					items={plan.items}
					selectedItemId={plan.selectedItemId}
					onselect={(id) => plan.select(id)}
				/>
			{/if}
		</HoloTable>

		<!-- Sticky fill summary on narrow screens; hidden on desktop where the scale is in view. -->
		<div class="fill-strip" role="status" aria-live="polite">
			<span class="strip-pct">{formatPercent(plan.result?.usedScu ?? 0, ship.cargoScu)}</span>
			<span class="strip-text"
				>{formatScu(plan.result?.usedScu ?? 0)} / {formatScu(ship.cargoScu)} SCU loaded{#if plan.result && plan.result.unplaced.length > 0}
					· <span class="strip-warn">{plan.result.unplaced.length} unplaced</span>{/if}</span
			>
			<a class="strip-link" href="#manifest">Manifest ↓</a>
		</div>
	</div>

	<aside class="side" id="manifest">
		<ManifestSheet {plan} {ship} onpack={runPlan} />
		<PlanTools {plan} {shareUrl} onimport={runPlan} />
		<CargoScale {ship} result={plan.result} manifestScu={plan.totalScu} />
		{#if unplacedSummary.length > 0}
			<HazardTag title="Does not fit">
				<ul>
					{#each unplacedSummary as row (row.reason)}
						<li>
							<strong>{row.count}</strong>
							{row.count === 1 ? 'box' : 'boxes'} ({row.sizes.join('/')} SCU, {formatScu(row.scu)} SCU
							total):
							{row.reason.toLowerCase()}
						</li>
					{/each}
				</ul>
			</HazardTag>
		{/if}
		<GridLegend {ship} />
	</aside>

	<details class="order-drawer" bind:open={orderOpen}>
		<summary>
			<span>Loading order</span>
			<span class="muted small">{plan.placements.length} boxes</span>
		</summary>
		<LoadingOrder {plan} {ship} />
	</details>
</div>

<style>
	.planner {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(20rem, 1fr);
		grid-template-rows: auto auto 1fr;
		grid-template-areas:
			'head head'
			'table side'
			'order side';
		gap: 1.5rem 2rem;
		align-items: start;
		min-width: 0;
	}
	/* Grid areas must shrink below their content's min-content width (no horizontal scroll on phones). */
	.ship-head,
	.table-col,
	.side,
	.order-drawer {
		min-width: 0;
	}
	.ship-head {
		grid-area: head;
		display: grid;
		gap: 0.3rem;
	}
	.ship-name {
		color: var(--fg);
		text-shadow:
			0 0 3px #fff2ff,
			0 0 18px #bfa0ff88;
	}
	.ship-facts {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 1.4rem;
		color: var(--fg-muted);
	}
	.ship-facts strong {
		color: var(--fg);
	}
	.table-col {
		grid-area: table;
		display: grid;
		gap: 0.75rem;
	}
	.side {
		grid-area: side;
		display: grid;
		gap: 1.25rem;
	}
	.order-drawer {
		grid-area: order;
	}
	.order-drawer summary {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		min-height: 44px;
		padding: 0.5rem 0.75rem;
		margin-bottom: 0.5rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		font-size: var(--fs-small);
		cursor: pointer;
		border-radius: 4px;
		background: #ffffff06;
		list-style: none;
	}
	.order-drawer summary::-webkit-details-marker {
		display: none;
	}
	.order-drawer summary::before {
		content: '▸';
		color: var(--neon-cyan);
		margin-right: 0.5rem;
	}
	.order-drawer[open] summary::before {
		content: '▾';
	}
	.view-toggle {
		display: inline-flex;
		border: 1px solid #4a3d5f;
		border-radius: 4px;
		overflow: hidden;
	}
	.view-toggle button {
		min-width: 44px;
		min-height: 44px;
		padding: 0 0.7rem;
		border: 0;
		background: #0e0918;
		color: var(--fg-muted);
		font-size: var(--fs-small);
		letter-spacing: 0.1em;
	}
	.view-toggle button + button {
		border-left: 1px solid #4a3d5f;
	}
	.view-toggle button[aria-pressed='true'] {
		color: var(--neon-cyan);
		background: #35e6e61a;
		box-shadow: inset 0 -2px 0 var(--accent-2);
	}
	.fill-strip {
		display: none;
	}
	@media (max-width: 60rem) {
		.planner {
			grid-template-columns: 1fr;
			grid-template-rows: auto;
			grid-template-areas:
				'head'
				'table'
				'side'
				'order';
			gap: 1.25rem;
		}
		.fill-strip {
			position: sticky;
			top: 0;
			z-index: 5;
			display: flex;
			align-items: center;
			gap: 0.75rem;
			min-height: 48px;
			padding: 0.4rem 0.9rem;
			border-radius: 6px;
			background: linear-gradient(#2a2238f2, #1a1426f2);
			border: 1px solid #4a3d5f;
			box-shadow: 0 10px 20px -12px #000;
			backdrop-filter: blur(6px);
			font-size: var(--fs-small);
		}
		.strip-pct {
			font-family: var(--font-display);
			font-size: var(--fs-h3);
			color: var(--neon-cyan);
		}
		.strip-text {
			flex: 1;
			color: var(--fg-muted);
		}
		.strip-warn {
			color: var(--sun);
		}
		.strip-link {
			color: var(--neon-cyan);
			white-space: nowrap;
			min-height: 44px;
			display: inline-flex;
			align-items: center;
		}
	}
</style>

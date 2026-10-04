<script lang="ts">
	/**
	 * Wall-mounted departure board: the ship picker. Monospace rows, each a real
	 * link to the planner. Search and the 32-SCU filter sit in the board's frame.
	 */
	import type { ShipIndexEntry } from '../data/types.ts';
	import { formatScu } from '../ui/format.ts';

	type SortKey = 'name' | 'scu';

	let {
		entries,
		title = 'Departures',
		limit,
		sortable = false,
		initialSort = 'name',
		moreHref,
		aliases = {}
	}: {
		entries: ShipIndexEntry[];
		/** Folded variant names per representative slug; searchable and shown under the ship name. */
		aliases?: Record<string, string[]>;
		title?: string;
		/** Show at most this many rows (landing page). */
		limit?: number;
		sortable?: boolean;
		initialSort?: SortKey;
		/** Link shown under a truncated board ("All departures"). */
		moreHref?: string;
	} = $props();

	const uid = $props.id();
	let query = $state('');
	let fits32 = $state(false);
	// svelte-ignore state_referenced_locally (initialSort is an initial value by design)
	let sort = $state<SortKey>(initialSort);
	// svelte-ignore state_referenced_locally
	let desc = $state(initialSort === 'scu');

	const normalised = (s: string) =>
		s
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, ' ')
			.trim();

	const filtered = $derived.by(() => {
		const q = normalised(query);
		const words = q ? q.split(' ') : [];
		return entries.filter((e) => {
			if (fits32 && e.maxContainer !== 32) return false;
			if (words.length === 0) return true;
			const hay = normalised(
				`${e.fullName} ${e.manufacturer.code} ${e.manufacturer.name} ${e.role ?? ''} ${(aliases[e.slug] ?? []).join(' ')}`
			);
			return words.every((w) => hay.includes(w));
		});
	});
	const sorted = $derived.by(() => {
		const rows = [...filtered];
		rows.sort((a, b) =>
			sort === 'scu'
				? a.cargoScu - b.cargoScu || a.fullName.localeCompare(b.fullName)
				: a.fullName.localeCompare(b.fullName)
		);
		if (desc) rows.reverse();
		return rows;
	});
	const visible = $derived(limit ? sorted.slice(0, limit) : sorted);
	const hidden = $derived(sorted.length - visible.length);

	function toggleSort(key: SortKey) {
		if (sort === key) desc = !desc;
		else {
			sort = key;
			desc = key === 'scu';
		}
	}
	const ariaSort = (key: SortKey) => (sort === key ? (desc ? 'descending' : 'ascending') : 'none');
</script>

<section class="board" aria-labelledby="{uid}-title">
	<div class="frame">
		<span class="bolt b1" aria-hidden="true"></span>
		<span class="bolt b2" aria-hidden="true"></span>
		<header class="head">
			<h2 id="{uid}-title" class="title">{title}</h2>
			<div class="lamp" aria-hidden="true"></div>
			<label class="search">
				<span class="visually-hidden">Search ships</span>
				<input
					type="search"
					placeholder="Search ship or maker"
					autocomplete="off"
					bind:value={query}
					aria-controls="{uid}-rows"
				/>
			</label>
			<label class="toggle">
				<input type="checkbox" bind:checked={fits32} aria-controls="{uid}-rows" />
				<span>fits a 32-SCU box</span>
			</label>
		</header>

		<div class="columns" role="row" aria-hidden={sortable ? undefined : 'true'}>
			<span role="columnheader" class="c-maker">Maker</span>
			{#if sortable}
				<button
					type="button"
					class="c-ship sort"
					role="columnheader"
					aria-sort={ariaSort('name')}
					onclick={() => toggleSort('name')}
				>
					Ship {#if sort === 'name'}<span aria-hidden="true">{desc ? '▾' : '▴'}</span>{/if}
				</button>
				<button
					type="button"
					class="c-scu sort num"
					role="columnheader"
					aria-sort={ariaSort('scu')}
					onclick={() => toggleSort('scu')}
				>
					SCU {#if sort === 'scu'}<span aria-hidden="true">{desc ? '▾' : '▴'}</span>{/if}
				</button>
			{:else}
				<span role="columnheader" class="c-ship">Ship</span>
				<span role="columnheader" class="c-scu num">SCU</span>
			{/if}
			<span role="columnheader" class="c-grids num">Grids</span>
			<span role="columnheader" class="c-box num">Max box</span>
		</div>

		<ol id="{uid}-rows" class="rows" aria-live="polite" aria-label="Ships">
			{#each visible as ship (ship.slug)}
				<li>
					<a class="row" href="/cargo/{ship.slug}/" data-sveltekit-preload-data="tap">
						<span class="c-maker">
							<span class="code" aria-hidden="true">{ship.manufacturer.code}</span>
							<span class="visually-hidden">{ship.manufacturer.name}</span>
						</span>
						<span class="c-ship"
							>{ship.name}{#if aliases[ship.slug]?.length}
								<span class="aliases small">also {aliases[ship.slug].join(' · ')}</span>{/if}</span
						>
						<span class="c-scu num">{formatScu(ship.cargoScu)}</span>
						<span class="c-grids num">{ship.gridCount}</span>
						<span class="c-box num">{ship.maxContainer ?? '—'}<span class="unit"> SCU</span></span>
					</a>
				</li>
			{:else}
				<li class="empty">No ship matches. Try a maker code like DRAK or CRUS.</li>
			{/each}
		</ol>

		{#if hidden > 0 && moreHref}
			<a class="more" href={moreHref}>All departures ({sorted.length} ships) →</a>
		{:else if hidden > 0}
			<p class="more muted">{hidden} more ships hidden by the limit.</p>
		{/if}
	</div>
	<div class="bracket" aria-hidden="true"></div>
</section>

<style>
	.board {
		position: relative;
		max-width: 64rem;
	}
	.frame {
		position: relative;
		padding: 1rem clamp(0.75rem, 2vw, 1.5rem) 1.25rem;
		border-radius: 8px;
		background:
			linear-gradient(90deg, #ffffff0a, transparent 20%, transparent 80%, #0000002a),
			linear-gradient(#2a2238, #1a1426 50%, #150f1f);
		border: 1px solid #4a3d5f;
		box-shadow:
			inset 0 1px 0 #ffffff14,
			0 30px 50px -30px #000,
			0 0 0 6px #110c1a,
			0 0 0 7px #3a2d4e;
	}
	.bolt {
		position: absolute;
		top: 10px;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #d9ccd6, #6d5c6b 55%, #241c2a);
	}
	.b1 {
		left: 10px;
	}
	.b2 {
		right: 10px;
	}
	.bracket {
		position: absolute;
		left: 12%;
		right: 12%;
		bottom: -14px;
		height: 14px;
		background: linear-gradient(#1a1426, #0b0812);
		border-radius: 0 0 6px 6px;
		box-shadow: 0 10px 20px -8px #000;
	}
	.head {
		display: grid;
		grid-template-columns: auto auto 1fr auto;
		align-items: center;
		gap: 0.75rem 1rem;
		padding-bottom: 0.9rem;
		border-bottom: 1px dashed #4a3d5f;
	}
	.title {
		color: var(--neon-cyan);
		letter-spacing: 0.22em;
		text-shadow:
			0 0 6px #72f0e7aa,
			0 0 18px #35e6e655;
	}
	.lamp {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--sun);
		box-shadow:
			0 0 8px var(--sun),
			0 0 18px #ffd36e80;
	}
	.search input {
		width: 100%;
		min-height: 44px;
		padding: 0.45rem 0.9rem;
		border-radius: 4px;
		border: 1px solid #5a4b70;
		background: #0e0918;
		color: var(--fg);
		box-shadow: inset 0 2px 6px #00000080;
	}
	.search input::placeholder {
		color: #7f6b9a;
	}
	.toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 44px;
		padding: 0 0.6rem;
		font-size: var(--fs-small);
		color: var(--fg-muted);
		white-space: nowrap;
		cursor: pointer;
	}
	.toggle input {
		width: 1.15rem;
		height: 1.15rem;
		accent-color: var(--accent-2);
	}
	.columns,
	.row {
		display: grid;
		grid-template-columns: 4.2rem 1fr 5rem 4rem 5.5rem;
		gap: 0.75rem;
		align-items: center;
	}
	.columns {
		padding: 0.7rem 0.6rem 0.3rem;
		font-size: var(--fs-small);
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: #8f7cab;
	}
	.sort {
		background: none;
		border: 0;
		padding: 0;
		text-align: left;
		color: inherit;
		letter-spacing: inherit;
		text-transform: inherit;
		font-size: inherit;
		min-height: 32px;
	}
	.sort[aria-sort='ascending'],
	.sort[aria-sort='descending'] {
		color: var(--neon-cyan);
	}
	.num {
		text-align: right;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid #ffffff10;
	}
	.rows li + li {
		border-top: 1px solid #ffffff0a;
	}
	.row {
		position: relative;
		min-height: 48px;
		padding: 0.45rem 0.6rem;
		color: var(--fg);
		text-decoration: none;
		border-radius: 4px;
		transition:
			transform 220ms var(--ease-out),
			background-color 220ms;
	}
	.row::after {
		content: '';
		position: absolute;
		left: 0.6rem;
		right: 0.6rem;
		bottom: 0;
		height: 2px;
		background: var(--accent-2);
		transform: scaleX(0);
		transform-origin: left;
		transition: transform 220ms var(--ease-out);
		box-shadow: 0 0 8px var(--accent-2);
	}
	.row:hover,
	.row:focus-visible {
		background: #ffffff08;
		transform: translateY(-2px);
	}
	.row:hover::after,
	.row:focus-visible::after {
		transform: scaleX(1);
	}
	.code {
		display: inline-block;
		padding: 0.05rem 0.4rem;
		border-radius: 3px;
		border: 1px solid #5a4b70;
		color: var(--sun);
		font-size: var(--fs-small);
		letter-spacing: 0.1em;
	}
	.c-ship {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.aliases {
		display: block;
		font-weight: 400;
		color: #8f7cab;
		line-height: 1.3;
	}
	.unit {
		color: #8f7cab;
		font-size: var(--fs-small);
	}
	.empty,
	.more {
		display: block;
		padding: 0.9rem 0.6rem 0;
		color: var(--fg-muted);
		font-size: var(--fs-small);
	}
	.more {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		color: var(--neon-cyan);
	}
	@media (max-width: 48rem) {
		.head {
			grid-template-columns: 1fr auto;
		}
		.search {
			grid-column: 1 / -1;
		}
		.toggle {
			grid-column: 1 / -1;
			padding: 0;
		}
		.columns,
		.row {
			grid-template-columns: 3.6rem 1fr 4rem;
			gap: 0.5rem;
		}
		.c-grids,
		.c-box {
			display: none;
		}
	}
</style>

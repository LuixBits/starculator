<script lang="ts">
	/** Grid legend: every cargo grid with its cells, accepted sizes and external flag. */
	import type { Ship } from '../data/types.ts';
	import { formatCells, formatMeters, formatScu } from '../ui/format.ts';

	let { ship }: { ship: Ship } = $props();
	const uid = $props.id();
</script>

<details class="legend">
	<summary id="{uid}-s">
		<span class="label">Grid legend</span>
		<span class="meta">{ship.grids.length} grids · {formatScu(ship.cargoScu)} SCU</span>
	</summary>
	<ul aria-labelledby="{uid}-s">
		{#each ship.grids as g (g.id)}
			<li>
				<span class="name"
					>{g.name}{#if g.external}<span class="flag" title="Open to space / external rack"
							>EXT</span
						>{/if}</span
				>
				<span class="cells" title={formatMeters(g.meters)}
					>{formatCells(g.cells)} cells · {formatScu(g.scu)} SCU</span
				>
				<span class="sizes">accepts {g.allowedSizes.join(' / ')} SCU</span>
			</li>
		{/each}
	</ul>
</details>

<style>
	.legend {
		border-radius: 6px;
		border: 1px solid #4a3d5f;
		background: linear-gradient(#1f1830, #170f25);
		font-size: var(--fs-small);
	}
	summary {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		min-height: 44px;
		padding: 0.6rem 0.9rem;
		cursor: pointer;
		list-style: none;
		align-items: center;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary::before {
		content: '▸';
		color: var(--neon-cyan);
		margin-right: 0.5rem;
	}
	.legend[open] summary::before {
		content: '▾';
	}
	.label {
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--fg);
	}
	.meta {
		color: var(--fg-muted);
		margin-left: auto;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0 0.9rem 0.7rem;
		display: grid;
		gap: 0.4rem;
		max-height: 18rem;
		overflow: auto;
	}
	li {
		display: grid;
		grid-template-columns: minmax(7rem, 1fr) auto;
		gap: 0.1rem 0.75rem;
		padding-top: 0.4rem;
		border-top: 1px solid #ffffff0c;
	}
	.name {
		color: var(--fg);
		display: flex;
		gap: 0.45rem;
		align-items: center;
	}
	.flag {
		padding: 0 0.3rem;
		border: 1px solid #ffd36e99;
		border-radius: 2px;
		color: var(--sun);
		letter-spacing: 0.12em;
	}
	.cells {
		color: var(--fg-muted);
		text-align: right;
		white-space: nowrap;
	}
	.sizes {
		grid-column: 1 / -1;
		color: #8f7cab;
	}
</style>

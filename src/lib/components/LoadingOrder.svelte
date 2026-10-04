<script lang="ts">
	/**
	 * Loading order: one line per placed box (number, size, contract, grid). The
	 * selected box is highlighted and each line selects on click.
	 */
	import type { Ship } from '../data/types.ts';
	import type { Plan } from '../state/plan.svelte.ts';
	import { crateColor } from '../ui/crates.ts';
	import { formatOrder } from '../ui/format.ts';

	let { plan, ship }: { plan: Plan; ship: Ship } = $props();
	const uid = $props.id();
	const gridName = $derived(Object.fromEntries(ship.grids.map((g) => [g.id, g.name])));
	const rows = $derived([...plan.placements].sort((a, b) => a.order - b.order));
</script>

<section class="order" aria-labelledby="{uid}-t">
	<h3 id="{uid}-t" class="title">Loading order</h3>
	{#if rows.length === 0}
		<p class="muted small">Run the load plan to get the sequence, first box in to last.</p>
	{:else}
		<ol class="list">
			{#each rows as p (p.itemId)}
				{@const item = plan.itemsById[p.itemId]}
				{@const group = item ? plan.groupById(item.group) : undefined}
				{@const selected = plan.selectedItemId === p.itemId}
				<li>
					<button
						type="button"
						class="line"
						class:selected
						aria-pressed={selected}
						style={`--swatch:${crateColor(group?.colorIndex ?? 0)}`}
						onclick={() => plan.select(selected ? null : p.itemId)}
					>
						<span class="no">{formatOrder(p.order, rows.length)}</span>
						<span class="swatch" aria-hidden="true"></span>
						<span class="scu">{item?.scu ?? '?'} SCU</span>
						<span class="grp">{group?.label ?? item?.group ?? ''}</span>
						<span class="gcell">{gridName[p.gridId] ?? p.gridId}</span>
						<span class="pos small">x{p.at.x} y{p.at.y} z{p.at.z}</span>
					</button>
				</li>
			{/each}
		</ol>
	{/if}
</section>

<style>
	.order {
		padding: 1rem;
		border-radius: 8px;
		border: 1px solid #4a3d5f;
		background: linear-gradient(#211a31, #170f25);
	}
	.title {
		letter-spacing: 0.22em;
		color: var(--fg);
		margin-bottom: 0.5rem;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
		gap: 0.3rem 1rem;
		max-height: 24rem;
		overflow: auto;
	}
	.line {
		display: grid;
		grid-template-columns: 3.2rem 0.75rem 4.5rem 1fr 1fr auto;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
		min-height: 44px;
		padding: 0.25rem 0.5rem;
		border: 1px solid transparent;
		border-radius: 4px;
		background: transparent;
		color: var(--fg);
		font-size: var(--fs-small);
		text-align: left;
	}
	.line:hover {
		background: #ffffff08;
	}
	.line.selected {
		border-color: var(--fg);
		background: #ffffff10;
		box-shadow: 0 0 10px #ffe9ff33;
	}
	.no {
		color: var(--sun);
	}
	.swatch {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 2px;
		background: var(--swatch);
	}
	.line > * {
		min-width: 0;
	}
	.grp,
	.gcell {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.gcell {
		color: var(--fg-muted);
	}
	.pos {
		color: #8f7cab;
	}
	@media (max-width: 30rem) {
		.pos {
			display: none;
		}
		.line {
			grid-template-columns: 3rem 0.75rem 4rem 1fr 1fr;
		}
	}
</style>

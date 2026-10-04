<script lang="ts">
	/**
	 * The manifest sheet: cream paper with ink-blue monospace text, one row per
	 * container size with a crate icon and −/+ steppers, up to four contract
	 * groups, a status line and the "Load plan" action.
	 */
	import { CONTAINER_SIZES, type ContainerSize, type Ship } from '../data/types.ts';
	import type { Plan } from '../state/plan.svelte.ts';
	import { MAX_GROUPS, totalScu } from '../state/snapshot.ts';
	import { crateColor, crateFootprint } from '../ui/crates.ts';
	import { formatMs, formatScu } from '../ui/format.ts';
	import CrateIcon from './CrateIcon.svelte';

	let {
		plan,
		ship,
		onpack
	}: {
		plan: Plan;
		ship: Ship;
		onpack: () => void;
	} = $props();

	const uid = $props.id();
	let activeGroupId = $state<string | null>(null);
	const active = $derived(
		plan.groups.find((g) => g.id === activeGroupId) ?? plan.groups[0] ?? null
	);
	const accepted = $derived(new Set(ship.grids.flatMap((g) => g.allowedSizes)));
	const sizes = $derived([...CONTAINER_SIZES].sort((a, b) => b - a));

	function onInput(size: ContainerSize, event: Event) {
		if (!active) return;
		const value = Number((event.currentTarget as HTMLInputElement).value);
		plan.setCount(active.id, size, value);
	}
	function addGroup() {
		const g = plan.addGroup();
		if (g) activeGroupId = g.id;
	}
	function removeGroup(id: string) {
		plan.removeGroup(id);
		activeGroupId = plan.groups[0]?.id ?? null;
	}
	const statusText = $derived.by(() => {
		switch (plan.status) {
			case 'packing':
				return 'Packing…';
			case 'ready':
				return plan.result && plan.result.unplaced.length > 0
					? `${plan.result.unplaced.length} not placed · packed in ${formatMs(plan.result.elapsedMs)}`
					: `Packed in ${formatMs(plan.result?.elapsedMs ?? 0)}`;
			case 'stale':
				return 'Manifest changed · re-planning…';
			case 'error':
				return plan.error ?? 'Packing failed';
			default:
				return plan.hasItems ? 'Ready to plan' : 'Add containers from your contracts';
		}
	});
</script>

<form
	class="sheet"
	aria-labelledby="{uid}-title"
	onsubmit={(e) => {
		e.preventDefault();
		onpack();
	}}
>
	<header class="head">
		<h2 id="{uid}-title" class="title">Manifest</h2>
		<p class="sub">{ship.fullName} · {formatScu(ship.cargoScu)} SCU</p>
	</header>

	<fieldset class="groups">
		<legend class="visually-hidden">Contract groups</legend>
		<div class="tabs" role="tablist" aria-label="Contracts">
			{#each plan.groups as g (g.id)}
				<button
					type="button"
					role="tab"
					class="tab"
					aria-selected={active?.id === g.id}
					aria-controls="{uid}-rows"
					id="{uid}-tab-{g.id}"
					style={`--swatch:${crateColor(g.colorIndex)}`}
					onclick={() => (activeGroupId = g.id)}
				>
					<span class="swatch" aria-hidden="true"></span>
					<span class="tab-label">{g.label}</span>
				</button>
			{/each}
			{#if plan.groups.length < MAX_GROUPS}
				<button type="button" class="tab add" onclick={addGroup} aria-label="Add a contract group"
					>+ contract</button
				>
			{/if}
		</div>
		{#if active}
			<div class="group-row">
				<label class="rename">
					<span class="visually-hidden">Contract name</span>
					<input
						type="text"
						maxlength="40"
						value={active.label}
						oninput={(e) =>
							plan.renameGroup(active.id, (e.currentTarget as HTMLInputElement).value)}
					/>
				</label>
				<span class="group-total">{formatScu(totalScu(active.counts))} SCU</span>
				{#if plan.groups.length > 1}
					<button type="button" class="link-btn" onclick={() => removeGroup(active.id)}
						>remove</button
					>
				{/if}
			</div>
		{/if}
	</fieldset>

	{#if active}
		<div
			id="{uid}-rows"
			role="tabpanel"
			aria-labelledby="{uid}-tab-{active.id}"
			style={`--swatch:${crateColor(active.colorIndex)}`}
		>
			<ol class="rows">
				{#each sizes as size (size)}
					{@const ok = accepted.has(size)}
					{@const count = active.counts[size]}
					<li class="row" class:off={!ok} class:has={count > 0}>
						<span class="icon" aria-hidden="true">
							<CrateIcon {size} unit={7} color={count > 0 ? 'var(--swatch)' : '#1d2a4a'} />
						</span>
						<label class="size" for="{uid}-n-{size}">
							<span class="scu">{size} SCU</span>
							<span class="dims"
								>{crateFootprint(size)}{#if !ok}
									· not accepted{/if}</span
							>
						</label>
						<span class="stepper">
							<button
								type="button"
								aria-label={`Fewer ${size} SCU containers`}
								disabled={count === 0}
								onclick={() => plan.increment(active.id, size, -1)}>−</button
							>
							<input
								id="{uid}-n-{size}"
								type="number"
								inputmode="numeric"
								min="0"
								max="999"
								step="1"
								value={count}
								disabled={!ok}
								oninput={(e) => onInput(size, e)}
							/>
							<button
								type="button"
								aria-label={`More ${size} SCU containers`}
								disabled={!ok}
								onclick={() => plan.increment(active.id, size, 1)}>+</button
							>
						</span>
					</li>
				{/each}
			</ol>
		</div>
	{/if}

	<footer class="foot">
		<p class="totals">
			<span class="n">{formatScu(plan.totalBoxes)}</span> boxes ·
			<span class="n">{formatScu(plan.totalScu)}</span> SCU
		</p>
		<p class="status" role="status">{statusText}</p>
		<div class="actions">
			<button type="submit" class="primary" disabled={!plan.hasItems || plan.status === 'packing'}
				>Load plan</button
			>
			<button type="button" class="ghost" onclick={() => plan.clear()} disabled={!plan.hasItems}
				>Clear</button
			>
		</div>
	</footer>
</form>

<style>
	.sheet {
		position: relative;
		color: var(--paper-ink);
		background:
			radial-gradient(ellipse at 20% 0%, #ffffff66, transparent 50%),
			repeating-linear-gradient(0deg, transparent 0 27px, #1d2a4a0f 27px 28px),
			linear-gradient(170deg, #f8f1e2, var(--paper) 50%, #ebdfc6);
		border-radius: 2px;
		padding: 1.3rem 1.2rem 1.1rem;
		box-shadow:
			0 1px 0 #ffffffaa inset,
			0 18px 28px -16px #000,
			3px 3px 0 var(--paper-shadow);
		font-variant-numeric: tabular-nums;
	}
	.head {
		display: grid;
		gap: 0.1rem;
		padding-bottom: 0.75rem;
		border-bottom: 2px solid var(--paper-ink);
	}
	.title {
		font-size: var(--fs-heading);
		letter-spacing: 0.26em;
		color: var(--paper-ink);
	}
	.sub {
		font-size: var(--fs-small);
		opacity: 0.75;
	}
	.groups {
		margin: 0.9rem 0 0;
		padding: 0;
		border: 0;
	}
	.tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.tab {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-height: 44px;
		padding: 0.3rem 0.8rem;
		border-radius: 3px;
		border: 1px dashed #1d2a4a66;
		background: transparent;
		color: var(--paper-ink);
		font-size: var(--fs-small);
		max-width: 100%;
	}
	.tab[aria-selected='true'] {
		border-style: solid;
		background: #1d2a4a12;
		font-weight: 700;
	}
	.tab.add {
		opacity: 0.75;
	}
	.tab-label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 10rem;
	}
	.swatch {
		width: 0.9rem;
		height: 0.9rem;
		border-radius: 2px;
		background: var(--swatch);
		box-shadow: inset 0 0 0 1px #00000040;
	}
	.group-row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-top: 0.6rem;
		flex-wrap: wrap;
	}
	.rename {
		flex: 1 1 10rem;
	}
	.rename input {
		width: 100%;
		min-height: 44px;
		padding: 0.3rem 0.5rem;
		border: 0;
		border-bottom: 1px solid #1d2a4a80;
		background: transparent;
		color: var(--paper-ink);
		font-weight: 700;
	}
	.group-total {
		font-size: var(--fs-small);
		opacity: 0.8;
	}
	.link-btn {
		background: none;
		border: 0;
		padding: 0.5rem;
		min-height: 44px;
		color: #8a3b2f;
		font-size: var(--fs-small);
		text-decoration: underline;
		text-underline-offset: 0.25em;
	}
	.rows {
		list-style: none;
		margin: 0.6rem 0 0;
		padding: 0;
	}
	.row {
		display: grid;
		grid-template-columns: 4.6rem 1fr auto;
		align-items: center;
		gap: 0.6rem;
		min-height: 56px;
		padding: 0.25rem 0;
		border-bottom: 1px dotted #1d2a4a55;
	}
	.row.off {
		opacity: 0.55;
	}
	.row.has .scu {
		font-weight: 700;
	}
	.icon {
		display: grid;
		place-items: center;
		height: 44px;
	}
	.size {
		display: grid;
		line-height: 1.3;
		cursor: pointer;
	}
	.dims {
		font-size: var(--fs-small);
		opacity: 0.7;
	}
	.stepper {
		display: inline-flex;
		align-items: stretch;
		border: 1px solid #1d2a4a80;
		border-radius: 4px;
		overflow: hidden;
		background: #fffaf0;
	}
	.stepper button {
		width: 44px;
		min-height: 44px;
		border: 0;
		background: #1d2a4a0f;
		color: var(--paper-ink);
		font-weight: 700;
	}
	.stepper button:hover:not(:disabled) {
		background: #1d2a4a22;
	}
	.stepper button:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.stepper input {
		width: 3.6rem;
		min-height: 44px;
		text-align: center;
		border: 0;
		border-left: 1px solid #1d2a4a40;
		border-right: 1px solid #1d2a4a40;
		background: transparent;
		color: var(--paper-ink);
		font-weight: 700;
		-moz-appearance: textfield;
		appearance: textfield;
	}
	.stepper input::-webkit-outer-spin-button,
	.stepper input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.foot {
		margin-top: 0.9rem;
		display: grid;
		gap: 0.5rem;
	}
	.totals {
		font-size: var(--fs-small);
		opacity: 0.85;
	}
	.n {
		font-weight: 700;
		font-size: var(--fs-body);
	}
	.status {
		font-size: var(--fs-small);
		min-height: 1.4em;
		font-style: italic;
		opacity: 0.8;
	}
	.actions {
		display: flex;
		gap: 0.6rem;
		flex-wrap: wrap;
	}
	.primary,
	.ghost {
		min-height: 48px;
		padding: 0.5rem 1.3rem;
		border-radius: 4px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		font-size: var(--fs-small);
	}
	.primary {
		flex: 1 1 auto;
		border: 1px solid #0a9f9f;
		background: linear-gradient(#5df1f1, #22c6c6);
		color: #062a2a;
		box-shadow:
			0 0 14px #35e6e666,
			inset 0 1px 0 #ffffff80;
	}
	.primary:hover:not(:disabled) {
		background: linear-gradient(#7cf5f5, #35e6e6);
	}
	.primary:disabled {
		opacity: 0.45;
		box-shadow: none;
		cursor: default;
	}
	.ghost {
		border: 1px solid #1d2a4a80;
		background: transparent;
		color: var(--paper-ink);
	}
	.ghost:disabled {
		opacity: 0.4;
		cursor: default;
	}
</style>

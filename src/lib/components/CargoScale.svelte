<script lang="ts">
	/**
	 * Cargo scale: a vertical gauge with a needle, used / total SCU in large tabular
	 * figures, and per-grid fill bars underneath.
	 */
	import type { PackResult, Ship } from '../data/types.ts';
	import { formatPercent, formatScu } from '../ui/format.ts';

	let {
		ship,
		result,
		manifestScu
	}: {
		ship: Ship;
		result: PackResult | null;
		/** SCU currently on the manifest (packed or not). */
		manifestScu: number;
	} = $props();

	const uid = $props.id();
	const capacity = $derived(ship.cargoScu);
	const used = $derived(result?.usedScu ?? 0);
	const ratio = $derived(capacity > 0 ? Math.min(1, used / capacity) : 0);
	const manifestRatio = $derived(capacity > 0 ? Math.min(1.2, manifestScu / capacity) : 0);
	const fillById = $derived(new Map((result?.fills ?? []).map((f) => [f.gridId, f])));
	// Needle sweeps 150° from empty (left) to full (right).
	const angle = $derived(-75 + ratio * 150);
	const ticks = Array.from({ length: 11 }, (_, i) => -75 + i * 15);
</script>

<section class="scale" aria-labelledby="{uid}-t">
	<h3 id="{uid}-t" class="visually-hidden">Fill level</h3>
	<div class="dial-wrap">
		<svg
			class="dial"
			viewBox="0 0 200 120"
			role="img"
			aria-label={`Hold ${formatPercent(used, capacity)} full`}
		>
			<defs>
				<linearGradient id="{uid}-arc" x1="0" y1="0" x2="1" y2="0">
					<stop offset="0" stop-color="#35e6e6" />
					<stop offset="0.7" stop-color="#ffd36e" />
					<stop offset="1" stop-color="#ff5ed1" />
				</linearGradient>
			</defs>
			<path d="M24 104A80 80 0 0 1 176 104" fill="none" stroke="#0e0918" stroke-width="14" />
			<path
				d="M24 104A80 80 0 0 1 176 104"
				fill="none"
				stroke="url(#{uid}-arc)"
				stroke-width="10"
				stroke-opacity="0.9"
				pathLength="100"
				stroke-dasharray={`${ratio * 100} 100`}
			/>
			{#if manifestRatio > ratio}
				<!-- manifest total that is not yet (or cannot be) placed, as a ghost arc -->
				<path
					d="M24 104A80 80 0 0 1 176 104"
					fill="none"
					stroke="#ffe9ff"
					stroke-opacity="0.25"
					stroke-width="10"
					pathLength="100"
					stroke-dasharray={`${Math.min(1, manifestRatio) * 100} 100`}
				/>
			{/if}
			{#each ticks as t (t)}
				<line
					x1="100"
					y1="30"
					x2="100"
					y2={t % 75 === 0 || t === 0 ? 20 : 25}
					stroke="#c8a6ef"
					stroke-opacity="0.7"
					stroke-width="1.2"
					transform={`rotate(${t} 100 104)`}
				/>
			{/each}
			<g class="needle" style={`--angle:${angle}deg`}>
				<path d="M100 104L97 98 100 28 103 98Z" fill="#ffe9ff" />
			</g>
			<circle cx="100" cy="104" r="7" fill="#1a1426" stroke="#c8a6ef" stroke-width="1.5" />
			<text x="22" y="118" font-size="9" fill="#8f7cab" font-family="var(--font-body)">EMPTY</text>
			<text
				x="178"
				y="118"
				text-anchor="end"
				font-size="9"
				fill="#8f7cab"
				font-family="var(--font-body)">FULL</text
			>
		</svg>
		<div class="readout">
			<span class="big">{formatScu(used)}</span>
			<span class="of">/ {formatScu(capacity)} <span class="unit">SCU</span></span>
			<span class="pct"
				>{formatPercent(used, capacity)} loaded{#if manifestScu > used}
					· {formatScu(manifestScu)} on manifest{/if}</span
			>
		</div>
	</div>

	<ul class="grids" aria-label="Fill per grid">
		{#each ship.grids as g (g.id)}
			{@const fill = fillById.get(g.id)}
			{@const u = fill?.usedCells ?? 0}
			<li>
				<span class="gname">{g.name}</span>
				<span class="bar" aria-hidden="true">
					<span class="fill" style={`width:${g.scu > 0 ? (u / g.scu) * 100 : 0}%`}></span>
				</span>
				<span class="gnum">{formatScu(u)}<span class="dim">/{formatScu(g.scu)}</span></span>
			</li>
		{/each}
	</ul>
</section>

<style>
	.scale {
		padding: 1rem 1rem 1.1rem;
		border-radius: 8px;
		background:
			linear-gradient(90deg, #ffffff08, transparent 25%, transparent 75%, #00000030),
			linear-gradient(#2a2238, #1a1426 55%, #150f1f);
		border: 1px solid #4a3d5f;
		box-shadow:
			inset 0 1px 0 #ffffff12,
			0 20px 30px -24px #000;
	}
	.dial-wrap {
		display: grid;
		grid-template-columns: minmax(110px, 170px) 1fr;
		gap: 0.75rem;
		align-items: center;
	}
	.dial {
		width: 100%;
		height: auto;
	}
	.needle {
		transform: rotate(var(--angle));
		transform-origin: 100px 104px;
		transition: transform 700ms var(--ease-out);
		filter: drop-shadow(0 0 4px #ffe9ff88);
	}
	.readout {
		display: grid;
		gap: 0.1rem;
	}
	.big {
		font-family: var(--font-display);
		font-size: var(--fs-title);
		line-height: 1;
		color: var(--neon-cyan);
		text-shadow:
			0 0 8px #72f0e7aa,
			0 0 20px #35e6e655;
	}
	.of {
		color: var(--fg-muted);
	}
	.unit,
	.dim {
		color: #8f7cab;
		font-size: var(--fs-small);
	}
	.pct {
		font-size: var(--fs-small);
		color: var(--fg-muted);
	}
	.grids {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0.75rem 0 0;
		border-top: 1px dashed #4a3d5f;
		display: grid;
		gap: 0.35rem;
		max-height: 16rem;
		overflow: auto;
	}
	.grids li {
		display: grid;
		grid-template-columns: minmax(6rem, 1fr) 2fr auto;
		gap: 0.6rem;
		align-items: center;
		font-size: var(--fs-small);
	}
	.gname {
		color: var(--fg-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bar {
		display: block;
		height: 8px;
		border-radius: 4px;
		background: #0e0918;
		box-shadow: inset 0 1px 3px #000;
		overflow: hidden;
	}
	.fill {
		display: block;
		height: 100%;
		background: linear-gradient(90deg, var(--accent-2), var(--accent));
		box-shadow: 0 0 8px var(--accent-2);
		transition: width 500ms var(--ease-out);
	}
	.gnum {
		text-align: right;
		white-space: nowrap;
	}
</style>

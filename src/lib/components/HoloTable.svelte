<script lang="ts">
	/**
	 * The holo-table: a drawn table with a dark bezel, cyan edge light, four feet
	 * and a projection gradient rising from its surface. Whatever is rendered in
	 * `children` (the Threlte hold viewer) sits in the projection area.
	 */
	import type { Snippet } from 'svelte';

	let {
		children,
		caption,
		controls
	}: {
		children: Snippet;
		/** Short label on the table's front edge, e.g. the ship name. */
		caption?: string;
		/** Controls that belong to the table (view toggle), rendered on the bezel. */
		controls?: Snippet;
	} = $props();
	const uid = $props.id();
</script>

<div class="holo">
	<div class="projection-glow" aria-hidden="true"></div>
	<div class="tabletop">
		<div class="bezel">
			<div class="surface">
				<div class="scan" aria-hidden="true"></div>
				<div class="stage">
					{@render children()}
				</div>
			</div>
			<div class="edge-light" aria-hidden="true"></div>
		</div>
		<div class="apron">
			<svg class="apron-art" viewBox="0 0 600 40" preserveAspectRatio="none" aria-hidden="true">
				<defs>
					<linearGradient id="{uid}-apron" x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stop-color="#2a2238" />
						<stop offset="0.5" stop-color="#1c1627" />
						<stop offset="1" stop-color="#120d1b" />
					</linearGradient>
					<pattern id="{uid}-vents" width="6" height="8" patternUnits="userSpaceOnUse">
						<rect x="1" y="1" width="2" height="6" fill="#090611" />
					</pattern>
				</defs>
				<rect width="600" height="40" fill="url(#{uid}-apron)" />
				<rect x="0" y="0" width="600" height="1.5" fill="#ffffff14" />
				<rect x="330" y="12" width="90" height="16" rx="2" fill="url(#{uid}-vents)" />
				<circle cx="10" cy="20" r="2.6" fill="#0b0813" stroke="#4b3f58" />
				<circle cx="590" cy="20" r="2.6" fill="#0b0813" stroke="#4b3f58" />
				<circle cx="24" cy="20" r="2.2" fill="#35e6e6" />
				<circle cx="34" cy="20" r="2.2" fill="#ffd36e" opacity="0.8" />
			</svg>
			<div class="apron-row">
				{#if caption}
					<span class="caption">{caption}</span>
				{/if}
				{#if controls}
					<div class="controls">{@render controls()}</div>
				{/if}
			</div>
		</div>
	</div>
	<div class="legs" aria-hidden="true">
		<span class="foot f1"></span>
		<span class="foot f2"></span>
		<span class="foot f3"></span>
		<span class="foot f4"></span>
		<span class="floor-shadow"></span>
	</div>
</div>

<style>
	.holo {
		position: relative;
		isolation: isolate;
		padding-bottom: 2.2rem;
	}
	.projection-glow {
		position: absolute;
		z-index: -1;
		left: 6%;
		right: 6%;
		top: -14%;
		height: 60%;
		background: radial-gradient(ellipse at 50% 100%, #35e6e630, #35e6e60c 45%, transparent 75%);
		pointer-events: none;
	}
	.tabletop {
		position: relative;
		border-radius: 14px 14px 6px 6px;
		background: linear-gradient(#2f2642, #1d1729 60%, #15101f);
		box-shadow:
			0 24px 40px -18px #05020c,
			0 2px 0 #ffffff10 inset;
	}
	.bezel {
		position: relative;
		padding: 14px;
		border-radius: 14px 14px 0 0;
		background:
			linear-gradient(90deg, #ffffff0a, transparent 15%, transparent 85%, #00000030),
			linear-gradient(#3a3050, #241c33 40%, #1a1426);
		border: 1px solid #4a3d5f;
		border-bottom: 0;
	}
	.surface {
		position: relative;
		overflow: hidden;
		border-radius: 6px;
		background:
			radial-gradient(ellipse at 50% 120%, #35e6e61a, transparent 55%),
			linear-gradient(#0e0820, var(--bg-deep) 50%, #0e0820);
		box-shadow:
			inset 0 0 0 1px #35e6e655,
			inset 0 0 24px #35e6e622,
			inset 0 10px 30px #00000080;
		aspect-ratio: 16 / 10;
		min-height: 320px;
	}
	.stage {
		position: absolute;
		inset: 0;
	}
	.scan {
		position: absolute;
		inset: 0;
		z-index: 1;
		pointer-events: none;
		background:
			repeating-linear-gradient(to bottom, #35e6e608 0 1px, transparent 1px 4px),
			linear-gradient(to top, #35e6e614, transparent 40%);
		mix-blend-mode: screen;
	}
	.edge-light {
		position: absolute;
		left: 14px;
		right: 14px;
		bottom: 6px;
		height: 2px;
		background: linear-gradient(
			90deg,
			transparent,
			var(--accent-2) 20%,
			var(--accent-2) 80%,
			transparent
		);
		box-shadow:
			0 0 8px var(--accent-2),
			0 0 22px #35e6e680;
		opacity: 0.9;
	}
	.apron {
		position: relative;
		height: 56px;
		border: 1px solid #3a2f4a;
		border-top: 0;
		border-radius: 0 0 6px 6px;
		overflow: hidden;
	}
	.apron-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.apron-row {
		/* Absolute so the nowrap caption never widens the table on phones. */
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0 1rem 0 3rem;
	}
	.caption {
		min-width: 0;
		font-size: var(--fs-small);
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: #9fb3c8;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.controls {
		display: flex;
		gap: 0.4rem;
		flex-shrink: 0;
	}
	.legs {
		position: relative;
		height: 0;
	}
	.foot {
		position: absolute;
		top: -2px;
		width: 14px;
		height: 30px;
		background: linear-gradient(90deg, #2a2238, #171221 60%, #0f0b17);
		border-radius: 0 0 3px 3px;
		box-shadow: 0 6px 10px -4px #000;
	}
	.foot::after {
		content: '';
		position: absolute;
		left: -4px;
		right: -4px;
		bottom: -3px;
		height: 5px;
		border-radius: 2px;
		background: #110c1a;
	}
	.f1 {
		left: 6%;
	}
	.f2 {
		left: calc(6% + 22px);
		height: 24px;
		opacity: 0.6;
	}
	.f3 {
		right: 6%;
	}
	.f4 {
		right: calc(6% + 22px);
		height: 24px;
		opacity: 0.6;
	}
	.floor-shadow {
		position: absolute;
		left: 2%;
		right: 2%;
		top: 26px;
		height: 18px;
		border-radius: 50%;
		background: radial-gradient(ellipse at center, #00000099, transparent 70%);
		filter: blur(4px);
	}
	@media (max-width: 40rem) {
		.bezel {
			padding: 8px;
		}
		.surface {
			aspect-ratio: 4 / 3;
			min-height: 260px;
		}
		.apron-row {
			padding-left: 2.6rem;
		}
	}
</style>

<script lang="ts">
	/**
	 * The deck edge: a magenta floor grid receding to a glowing horizon with a
	 * banded sun, as in the owner's FooterVaporwave.svelte (LuixBits/lupe-webfolio),
	 * rebuilt in CSS/SVG for the freight deck. Decorative; the footer content is
	 * rendered on top by the layout.
	 */
	import { scatter } from '../ui/hash.ts';
	const uid = $props.id();
	const stars = scatter('deck-edge-stars', 26, 1000, 120);
</script>

<div class="edge" aria-hidden="true">
	<div class="sky"></div>
	<div class="sky-warm"></div>
	<svg class="stars" viewBox="0 0 1000 120" preserveAspectRatio="none">
		{#each stars as s, i (i)}
			<circle cx={s.x} cy={s.y} r={s.r} fill={i % 5 === 0 ? '#ff5ed1' : '#ffd36e'} opacity={s.a} />
		{/each}
	</svg>
	<div class="cloud c1"></div>
	<div class="cloud c2"></div>
	<div class="sun-glow"></div>
	<svg class="sun" viewBox="0 0 100 66" preserveAspectRatio="xMidYMax meet">
		<defs>
			<linearGradient id="{uid}-sunGrad" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#ffd36e" />
				<stop offset="0.55" stop-color="#ffd36e" />
				<stop offset="1" stop-color="#ff5ed1" />
			</linearGradient>
			<mask id="{uid}-bands">
				<rect width="100" height="66" fill="#fff" />
				<rect x="0" y="33" width="100" height="2" fill="#000" />
				<rect x="0" y="42" width="100" height="3" fill="#000" />
				<rect x="0" y="52" width="100" height="4" fill="#000" />
				<rect x="0" y="63" width="100" height="5" fill="#000" />
			</mask>
		</defs>
		<circle cx="50" cy="36" r="33" fill="url(#{uid}-sunGrad)" mask="url(#{uid}-bands)" />
	</svg>
	<!-- hangar door silhouette on the horizon -->
	<svg class="hangar" viewBox="0 0 400 60" preserveAspectRatio="xMidYMax meet">
		<path d="M0 60V40h30V26h36v14h44V18h18v22h12v-8h12v8h8V60Z" fill="#0d0718" />
		<path d="M400 60V40h-30V26h-36v14h-44V18h-18v22h-12v-8h-12v8h-8V60Z" fill="#0d0718" />
		<!-- door frame posts and the lintel above the open hangar door -->
		<rect x="156" y="14" width="6" height="46" fill="#0d0718" />
		<rect x="238" y="14" width="6" height="46" fill="#0d0718" />
		<rect x="150" y="8" width="100" height="7" fill="#0d0718" />
		<rect x="165" y="15" width="70" height="2" fill="#ffd36e" opacity="0.6" />
		<g fill="#35e6e6" opacity="0.8">
			<rect x="76" y="30" width="3" height="2" /><rect x="118" y="24" width="2" height="2" /><rect
				x="280"
				y="24"
				width="3"
				height="2"
			/><rect x="322" y="30" width="2" height="2" />
		</g>
		<g fill="#ffd36e" opacity="0.7">
			<rect x="44" y="46" width="4" height="2" /><rect x="352" y="46" width="4" height="2" />
		</g>
	</svg>
	<div class="floor-wrap">
		<div class="floor">
			<div class="floor-lines"></div>
		</div>
	</div>
	<div class="horizon"></div>
</div>

<style>
	.edge {
		position: absolute;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		contain: strict;
		--horizon: 150px;
	}
	.sky {
		position: absolute;
		left: 0;
		right: 0;
		bottom: var(--horizon);
		height: 120px;
		background: linear-gradient(to top, #7b4bd659, #24104633 55%, transparent);
	}
	.sky-warm {
		position: absolute;
		left: 0;
		right: 0;
		bottom: var(--horizon);
		height: 48px;
		background: linear-gradient(to top, #ffd36e2e, #ff5ed117 55%, transparent);
	}
	.stars {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		width: 100%;
		height: calc(100% - var(--horizon) - 20px);
	}
	.cloud {
		position: absolute;
		height: 3px;
		border-radius: 2px;
		background: linear-gradient(to right, transparent, #ff5ed18c 30%, #ff5ed18c 70%, transparent);
		opacity: 0.38;
	}
	.c1 {
		left: 12%;
		top: 26px;
		width: min(200px, 22vw);
	}
	.c2 {
		right: 10%;
		top: 44px;
		width: min(160px, 18vw);
	}
	.sun-glow {
		position: absolute;
		left: 50%;
		bottom: calc(var(--horizon) - 60px);
		width: 260px;
		height: 220px;
		transform: translateX(-50%);
		background: radial-gradient(closest-side, #ffd36e57, #ff5ed12e 45%, transparent 72%);
		animation: breathe 7s ease-in-out infinite;
	}
	@keyframes breathe {
		0%,
		100% {
			opacity: 0.75;
		}
		50% {
			opacity: 1;
		}
	}
	.sun {
		position: absolute;
		left: 50%;
		bottom: var(--horizon);
		width: 110px;
		height: 73px;
		transform: translateX(-50%);
		filter: drop-shadow(0 0 10px #ffd36e8c);
	}
	.hangar {
		position: absolute;
		left: 50%;
		bottom: calc(var(--horizon) - 1px);
		width: min(100%, 760px);
		height: 60px;
		transform: translateX(-50%);
		opacity: 0.95;
	}
	.floor-wrap {
		position: absolute;
		left: -14%;
		right: -14%;
		bottom: 0;
		height: var(--horizon);
		overflow: hidden;
		perspective: 220px;
		perspective-origin: 50% 0%;
		-webkit-mask-image: linear-gradient(to right, transparent, #000 14%, #000 86%, transparent);
		mask-image: linear-gradient(to right, transparent, #000 14%, #000 86%, transparent);
	}
	.floor {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		height: 420px;
		transform: rotateX(58deg);
		transform-origin: 50% 0%;
		overflow: hidden;
		background: linear-gradient(to bottom, #ff5ed14d, #7b4bd624 30%, transparent 62%);
	}
	.floor-lines {
		position: absolute;
		left: 0;
		right: 0;
		top: -56px;
		height: calc(100% + 56px);
		background-image:
			repeating-linear-gradient(to bottom, #ff5ed159 0 5px, transparent 5px 56px),
			repeating-linear-gradient(to bottom, #ff5ed1 0 2px, transparent 2px 56px),
			repeating-linear-gradient(to right, #ff5ed14d 0 5px, transparent 5px 72px),
			repeating-linear-gradient(to right, #ff5ed1 0 2px, transparent 2px 72px);
		animation: floor-travel 2.8s linear infinite;
	}
	@keyframes floor-travel {
		from {
			transform: translateY(0);
		}
		to {
			transform: translateY(56px);
		}
	}
	.horizon {
		position: absolute;
		left: 4%;
		right: 4%;
		bottom: calc(var(--horizon) - 1px);
		height: 2px;
		background: linear-gradient(
			to right,
			transparent,
			#ff5ed1 22%,
			#ffd36e 50%,
			#ff5ed1 78%,
			transparent
		);
		box-shadow:
			0 0 10px 1px #ff5ed1a6,
			0 0 26px 4px #ff5ed14d;
	}
	@media (prefers-reduced-motion: reduce) {
		.sun-glow,
		.floor-lines {
			animation: none;
		}
	}
</style>

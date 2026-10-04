<script lang="ts">
	/**
	 * A shipping crate with sprayed stencil text, used for data provenance.
	 * The lines are real HTML (readable, selectable); the crate is SVG around them.
	 */
	let { lines, title = 'Data provenance' }: { lines: string[]; title?: string } = $props();
	const uid = $props.id();
</script>

<figure class="crate" aria-label={title}>
	<svg class="art" viewBox="0 0 320 150" preserveAspectRatio="none" aria-hidden="true">
		<defs>
			<linearGradient id="{uid}-wood" x1="0" y1="0" x2="0" y2="1">
				<stop offset="0" stop-color="#7a5a40" />
				<stop offset="0.5" stop-color="#5f4430" />
				<stop offset="1" stop-color="#4a3424" />
			</linearGradient>
			<pattern id="{uid}-grain" width="320" height="6" patternUnits="userSpaceOnUse">
				<path d="M0 3h320" stroke="#00000022" stroke-width="1" />
				<path d="M0 5.5h320" stroke="#ffffff0c" stroke-width="0.6" />
			</pattern>
		</defs>
		<rect width="320" height="150" rx="3" fill="url(#{uid}-wood)" />
		<rect width="320" height="150" rx="3" fill="url(#{uid}-grain)" />
		<!-- planks -->
		<path d="M0 37h320M0 75h320M0 113h320" stroke="#2c1d12" stroke-width="2" />
		<!-- frame battens -->
		<rect x="4" y="4" width="312" height="142" fill="none" stroke="#3a281a" stroke-width="7" />
		<rect
			x="4"
			y="4"
			width="312"
			height="142"
			fill="none"
			stroke="#a07a55"
			stroke-opacity="0.35"
			stroke-width="1"
		/>
		<!-- corner steel -->
		<path
			d="M4 24V4h20M296 4h20v20M4 126v20h20M296 146h20v-20"
			fill="none"
			stroke="#9aa0a8"
			stroke-width="5"
		/>
		<!-- nails -->
		<g fill="#2b2b2b">
			<circle cx="12" cy="56" r="1.6" /><circle cx="12" cy="94" r="1.6" /><circle
				cx="308"
				cy="56"
				r="1.6"
			/><circle cx="308" cy="94" r="1.6" />
		</g>
		<!-- fragile arrows -->
		<path
			d="M280 118l10-12 10 12M290 106v30"
			stroke="#e8d7b8"
			stroke-opacity="0.55"
			stroke-width="2.5"
			fill="none"
		/>
	</svg>
	<figcaption class="stencil">
		{#each lines as line, i (i)}
			<span class="line">{line}</span>
		{/each}
	</figcaption>
</figure>

<style>
	.crate {
		position: relative;
		margin: 0;
		width: 100%;
		aspect-ratio: 320 / 150;
		filter: drop-shadow(0 12px 14px #00000080);
	}
	.art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.stencil {
		position: absolute;
		inset: 14% 10%;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 0.1rem;
		font-family: var(--font-display);
		font-size: var(--fs-small);
		letter-spacing: 0.22em;
		text-transform: uppercase;
		line-height: 1.5;
		color: #f6e9cc;
		opacity: 0.95;
		transform: rotate(-1.2deg);
		/* Spray texture: dotted mask with ragged edges. */
		-webkit-mask-image:
			radial-gradient(ellipse, #000 62%, #000000aa 80%, #00000055 100%),
			radial-gradient(circle at 30% 40%, transparent 0.35px, #000 0.8px);
		mask-image:
			radial-gradient(ellipse, #000 62%, #000000aa 80%, #00000055 100%),
			radial-gradient(circle at 30% 40%, transparent 0.35px, #000 0.8px);
		-webkit-mask-size:
			100% 100%,
			5px 5px;
		mask-size:
			100% 100%,
			5px 5px;
		mask-composite: intersect;
		-webkit-mask-composite: source-in;
	}
	.line {
		display: block;
		overflow-wrap: anywhere;
	}
</style>

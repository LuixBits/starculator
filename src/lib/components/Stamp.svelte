<script lang="ts">
	/** A rubber-stamp impression on paper. Decorative when `decorative`, else an inline status. */
	let {
		text,
		tilt = -7,
		tone = 'ink',
		decorative = false
	}: {
		text: string;
		tilt?: number;
		tone?: 'ink' | 'red' | 'violet';
		decorative?: boolean;
	} = $props();
</script>

<span
	class="stamp tone-{tone}"
	style={`--tilt:${tilt}deg`}
	aria-hidden={decorative ? 'true' : undefined}
	role={decorative ? undefined : 'status'}
>
	<span class="stamp-ring"></span>
	<span class="txt">{text}</span>
</span>

<style>
	.stamp {
		position: relative;
		display: inline-grid;
		place-items: center;
		padding: 0.25rem 0.75rem;
		font-family: var(--font-display);
		font-size: var(--fs-h3);
		letter-spacing: 0.22em;
		text-transform: uppercase;
		line-height: 1;
		color: var(--stamp);
		transform: rotate(var(--tilt));
		mix-blend-mode: multiply;
		/* Uneven ink pickup: a mask that eats small specks out of the impression. */
		-webkit-mask-image:
			radial-gradient(circle at 20% 30%, transparent 0.8px, #000 1.2px),
			radial-gradient(circle at 70% 70%, transparent 0.7px, #000 1.1px);
		-webkit-mask-size:
			7px 9px,
			11px 8px;
		mask-image:
			radial-gradient(circle at 20% 30%, transparent 0.8px, #000 1.2px),
			radial-gradient(circle at 70% 70%, transparent 0.7px, #000 1.1px);
		mask-size:
			7px 9px,
			11px 8px;
		mask-composite: intersect;
		-webkit-mask-composite: source-in;
		opacity: 0.88;
	}
	.tone-ink {
		--stamp: #1d2a4a;
	}
	.tone-red {
		--stamp: #b8322a;
	}
	.tone-violet {
		--stamp: #5a2f8f;
	}
	.stamp-ring {
		position: absolute;
		inset: 0;
		border: 3px double var(--stamp);
		border-radius: 4px 7px 5px 6px;
	}
	.txt {
		position: relative;
	}
</style>

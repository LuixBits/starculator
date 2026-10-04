<script lang="ts">
	/**
	 * Neon tube lettering with the real heading in HTML underneath.
	 *
	 * The tube alphabet and the four-stroke construction (dark backing, faint
	 * halo, bright core, white-hot centre, drop-shadow glow) are ported from the
	 * owner's portfolio: LuixBits/lupe-webfolio,
	 * src/lib/projects/overview/NeonSign.svelte. Mounting board, standoffs and
	 * the maker's plate are new for the freight deck.
	 */
	type Level = 1 | 2 | 3;
	let {
		text,
		color = 'pink',
		level = 2,
		plate,
		hero = false,
		id
	}: {
		text: string;
		color?: 'pink' | 'cyan' | 'violet';
		/** Heading level of the HTML text under the tubes. */
		level?: Level;
		/** Optional small label on the maker's plate (defaults to the text). */
		plate?: string | null;
		/** The main room sign: larger, with the headline glow. */
		hero?: boolean;
		id?: string;
	} = $props();

	// Original single-line tube lettering (owner's alphabet).
	const letters: Record<string, string> = {
		A: 'M2 38 15 2 28 38M7 25h16',
		B: 'M3 38V2h12q13 0 13 9t-13 9H3m12 0q14 0 14 9t-14 9H3',
		C: 'M28 6Q19-1 10 3T2 20q0 20 26 14',
		D: 'M3 38V2h9q18 0 18 18T12 38Z',
		E: 'M28 2H3v36h25M3 20h20',
		F: 'M28 2H3v36M3 20h20',
		G: 'M28 6Q2-7 2 20t26 15V22H17',
		H: 'M3 2v36M27 2v36M3 20h24',
		I: 'M6 2h18M15 2v36M6 38h18',
		J: 'M8 2h19v24q0 18-21 10l-3-6',
		K: 'M3 2v36M27 2 3 24m8-9 17 23',
		L: 'M3 2v36h25',
		M: 'M2 38V2l13 19L28 2v36',
		N: 'M3 38V2l24 36V2',
		O: 'M15 2Q2 2 2 20t13 18q13 0 13-18T15 2Z',
		P: 'M3 38V2h12q13 0 13 10T15 22H3',
		Q: 'M15 2Q2 2 2 20t13 18q13 0 13-18T15 2Zm4 27 11 13',
		R: 'M3 38V2h12q13 0 13 10T15 22H3m12 0 14 16',
		S: 'M27 5Q3-5 3 11q0 9 12 9t12 10Q27 45 3 35',
		T: 'M2 2h26M15 2v36',
		U: 'M3 2v24q0 12 12 12t12-12V2',
		V: 'M2 2 15 38 28 2',
		W: 'M1 2 7 38l8-21 8 21 6-36',
		X: 'M2 2 28 38M28 2 2 38',
		Y: 'M2 2 15 20 28 2M15 20v18',
		Z: 'M2 2h26L2 38h26',
		'0': 'M15 2Q4 2 4 20t11 18q11 0 11-18T15 2ZM8 32 22 8',
		'1': 'M7 10 15 2v36',
		'2': 'M3 8q6-6 13-6 10 0 10 9 0 6-6 11L3 38h25',
		'3': 'M3 5q6-3 11-3 11 0 11 8 0 8-10 9 12 1 12 10 0 9-12 9-7 0-13-4',
		'-': 'M6 20h18',
		'·': 'M15 19v2'
	};
	const glyphs = $derived([...text.toUpperCase()]);
	const width = $derived(glyphs.length * 40 + 20);
	const plateText = $derived(plate === undefined ? text : plate);
	const uid = $props.id();
	const headingId = $derived(id ?? `${uid}-h`);
</script>

<div class="sign neon-{color} level-{level}" class:hero>
	<span class="board" aria-hidden="true">
		<span class="standoff s1"></span>
		<span class="standoff s2"></span>
		<span class="tubes neon-hum" style={`--sign-width:${width / 54}em`}>
			<svg viewBox={`0 0 ${width} 64`} fill="none">
				<g stroke-linecap="round" stroke-linejoin="round">
					{#each glyphs as glyph, i (i)}
						{#if letters[glyph]}
							<g transform={`translate(${i * 40 + 15} 11)`}>
								<path d={letters[glyph]} stroke="#130f21" stroke-width="9" />
								<path class="tube-halo" d={letters[glyph]} stroke="currentColor" stroke-width="7" />
								<path d={letters[glyph]} stroke="currentColor" stroke-width="3.5" />
								<path d={letters[glyph]} stroke="#fff3fc" stroke-width="1.15" />
							</g>
						{/if}
					{/each}
				</g>
			</svg>
		</span>
	</span>
	<span class="under">
		{#if level === 1}
			<h1 id={headingId} class="label">{text}</h1>
		{:else if level === 2}
			<h2 id={headingId} class="label">{text}</h2>
		{:else}
			<h3 id={headingId} class="label">{text}</h3>
		{/if}
		{#if plateText}
			<span class="plate" aria-hidden="true">{plateText}</span>
		{/if}
	</span>
</div>

<style>
	.sign {
		display: inline-flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.35rem;
		max-width: 100%;
		color: var(--neon-pink);
		font-size: var(--fs-heading);
	}
	.sign.hero {
		font-size: var(--fs-title);
	}
	.neon-cyan {
		color: var(--neon-cyan);
	}
	.neon-violet {
		color: var(--neon-violet);
	}
	.board {
		position: relative;
		display: inline-block;
		padding: 0.22em 0.42em 0.18em;
		background:
			linear-gradient(90deg, #ffffff08, transparent 20%, transparent 80%, #00000026),
			linear-gradient(#1a1326, #120d1d);
		border: 1px solid #3a2d4e;
		border-radius: 0.14em;
		box-shadow:
			inset 0 1px 0 #ffffff12,
			0 0.18em 0.5em #0a0614b0,
			0 0 1.2em color-mix(in srgb, currentColor 22%, transparent);
	}
	.standoff {
		position: absolute;
		top: -0.12em;
		width: 0.26em;
		height: 0.26em;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #c7b8cf, #5a4a66 55%, #221a2b);
		box-shadow: 0 1px 2px #00000080;
	}
	.standoff.s1 {
		left: 0.3em;
	}
	.standoff.s2 {
		right: 0.3em;
	}
	.tubes {
		display: block;
		width: var(--sign-width);
		max-width: 100%;
	}
	.tubes svg {
		display: block;
		width: 100%;
		height: auto;
		overflow: visible;
		filter: drop-shadow(0 0 6px currentColor);
	}
	.tube-halo {
		opacity: 0.18;
	}
	.under {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.35rem 0.75rem;
		padding-left: 0.2em;
	}
	/* The HTML heading is the accessible name; the tubes carry the display size. */
	.label {
		font-size: var(--fs-small);
		color: var(--fg-muted);
		letter-spacing: 0.3em;
	}
	/* The hero sign's tubes already spell the title; keep the heading for assistive tech only. */
	.sign.hero .label {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.plate {
		font-size: var(--fs-small);
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--fg-muted);
		padding: 0.1rem 0.55rem;
		border: 1px solid #ffffff22;
		border-radius: 2px;
		background: linear-gradient(#2a1f3a, #1a1327);
	}
</style>

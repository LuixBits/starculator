<script lang="ts">
	import DepartureBoard from '#lib/components/DepartureBoard.svelte';
	import CrateIcon from '#lib/components/CrateIcon.svelte';
	import NeonSign from '#lib/components/NeonSign.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const steps = [
		{
			n: '01',
			title: 'Pick a ship',
			text: 'Every cargo grid, read from the game files, in 1.25 m cells. Nose, modules, side racks.',
			size: 32 as const
		},
		{
			n: '02',
			title: 'Enter the manifest',
			text: 'Type in the containers from your hauling contracts: 1 to 32 SCU, one colour per contract.',
			size: 8 as const
		},
		{
			n: '03',
			title: 'Get the load plan',
			text: 'Boxes placed grid by grid, fill level per hold, a loading order and what will not fit.',
			size: 16 as const
		}
	];
</script>

<svelte:head>
	<title>Starculator · Star Citizen cargo planner</title>
	<meta
		name="description"
		content="Free Star Citizen cargo planner: pick a ship, see its exact cargo grids, enter the containers from your hauling contracts and get a load plan with fill level."
	/>
</svelte:head>

<section class="hero">
	<p class="pitch">
		Pick a ship, see its cargo grids cell by cell, type in the containers from your hauling
		contracts, and get a load plan before you leave the hangar. Free, no account, data versioned per
		game build.
	</p>
	<p class="pitch-links">
		<a class="cta" href="/cargo/drake-caterpillar/">Open the Caterpillar →</a>
		<a class="quiet" href="/ships/">All ships</a>
	</p>
</section>

<section class="board-wall">
	<DepartureBoard entries={data.index} aliases={data.aliases} limit={8} moreHref="/ships/" />
</section>

<section class="how" aria-labelledby="how-title">
	<NeonSign text="How it works" level={2} color="cyan" plate={null} id="how-title" />
	<ol class="steps">
		{#each steps as step (step.n)}
			<li class="step">
				<span class="step-no" aria-hidden="true">{step.n}</span>
				<span class="crate" aria-hidden="true">
					<CrateIcon size={step.size} unit={9} color="var(--neon-cyan)" />
				</span>
				<h3>{step.title}</h3>
				<p>{step.text}</p>
			</li>
		{/each}
	</ol>
</section>

<section class="note">
	<p>
		Starculator is a fan-made planning tool for Star Citizen haulers. Grid sizes come from the game
		data the Star Citizen Wiki team extracts each patch; grid positions inside a ship are schematic
		until curated. <a href="/about/"
			>What this is, where the data comes from, and how to report a wrong grid.</a
		>
	</p>
</section>

<style>
	.hero {
		max-width: 52rem;
		display: grid;
		gap: 1.2rem;
		padding-bottom: 2.5rem;
	}
	.pitch {
		color: var(--fg);
		max-width: 46rem;
	}
	.pitch-links {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1.5rem;
		align-items: center;
	}
	.cta {
		display: inline-flex;
		align-items: center;
		min-height: 48px;
		padding: 0 1.4rem;
		border-radius: 4px;
		border: 1px solid #0a9f9f;
		background: linear-gradient(#5df1f1, #22c6c6);
		color: #062a2a;
		font-weight: 700;
		text-decoration: none;
		letter-spacing: 0.06em;
		box-shadow:
			0 0 18px #35e6e666,
			inset 0 1px 0 #ffffff80;
	}
	.cta:hover {
		background: linear-gradient(#7cf5f5, #35e6e6);
		color: #062a2a;
	}
	.quiet {
		min-height: 44px;
		display: inline-flex;
		align-items: center;
		color: var(--fg-muted);
	}
	.board-wall {
		padding-bottom: 3.5rem;
	}
	.how {
		display: grid;
		gap: 1.5rem;
		padding-bottom: 3rem;
	}
	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
		gap: 1.25rem;
	}
	.step {
		position: relative;
		display: grid;
		gap: 0.5rem;
		padding: 1.25rem 1.25rem 1.4rem;
		border-radius: 6px;
		border: 1px solid #4a3d5f;
		background:
			linear-gradient(135deg, #ffffff08, transparent 40%),
			linear-gradient(#2a2238, #1a1426 70%, #150f1f);
		box-shadow: 0 20px 30px -24px #000;
	}
	.step::after {
		/* stencilled strap across the crate */
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0.8rem;
		height: 3px;
		background: repeating-linear-gradient(90deg, #ffd36e66 0 10px, transparent 10px 20px);
	}
	.step-no {
		position: absolute;
		top: 0.9rem;
		right: 1rem;
		font-size: var(--fs-small);
		letter-spacing: 0.3em;
		color: var(--sun);
	}
	.crate {
		display: flex;
		align-items: flex-end;
		height: 72px;
	}
	.step h3 {
		color: var(--fg);
	}
	.step p {
		color: var(--fg-muted);
		font-size: var(--fs-small);
	}
	.note {
		max-width: 52rem;
		color: var(--fg-muted);
		font-size: var(--fs-small);
	}
</style>

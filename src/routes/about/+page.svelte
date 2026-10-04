<script lang="ts">
	import NeonSign from '#lib/components/NeonSign.svelte';
	import MetalPlate from '#lib/components/MetalPlate.svelte';
	import { getDataMeta } from '#lib/state/adapters.ts';

	const meta = getDataMeta();
</script>

<svelte:head>
	<title>About · Starculator</title>
	<meta
		name="description"
		content="What Starculator is, where its Star Citizen cargo-grid data comes from, how to report a wrong grid, credits and license."
	/>
</svelte:head>

<article class="about">
	<header>
		<NeonSign text="About" level={1} color="violet" plate="Read me" />
	</header>

	<section class="section" aria-labelledby="what">
		<h2 id="what">What this is</h2>
		<p>
			Starculator is a free, no-login cargo planner for Star Citizen haulers. You pick a ship, see
			its cargo grids as 1.25 m cells, enter the containers from the hauling contracts you accepted
			and get a load plan: which box goes in which grid, how full each hold is, what does not fit,
			and the order to load. Plans live in your browser and in the link you share; nothing is sent
			to a server.
		</p>
	</section>

	<section class="section" aria-labelledby="data">
		<h2 id="data">Where the data comes from</h2>
		<p>
			Ship and grid geometry is read at build time from
			<a href={meta.repository} rel="noopener">scunpacked-data</a>, the game-file extraction the
			Star Citizen Wiki team publishes once per game build. The current snapshot is game version
			<strong>{meta.gameVersion}</strong>, published {meta.publishedAt.slice(0, 10)}, commit
			<code>{meta.commit.slice(0, 10)}</code>, with {meta.shipCount} ships and {meta.gridCount} grids.
			Every grid dimension in that data is an exact multiple of 1.25 m, so a hold is a set of rectangular
			cell lattices.
		</p>
		<p>
			Two things are not in the game data: where each grid sits inside the ship, and some maximum
			container sizes are wrong or missing (Ironclad, Nomad, Cutlass Black). Positions are shown
			schematically until curated; sizes are corrected with a hand-maintained override file.
		</p>
	</section>

	<section class="section" aria-labelledby="report">
		<h2 id="report">Found a wrong grid?</h2>
		<p>
			Open an issue at
			<a href="https://github.com/LuixBits/starculator/issues" rel="noopener"
				>github.com/LuixBits/starculator/issues</a
			>
			with the ship, the grid, what you measured in game (a screenshot of the hold with boxes in it is
			ideal) and the game version. Fixes land as overrides and ship with the next build.
		</p>
	</section>

	<section class="section" aria-labelledby="credits">
		<h2 id="credits">Credits</h2>
		<ul>
			<li>
				<a href="https://github.com/StarCitizenWiki/scunpacked-data" rel="noopener"
					>Star Citizen Wiki · scunpacked-data</a
				>
				for the extracted game data, and the
				<a href="https://starcitizen.tools" rel="noopener">wiki</a>
				itself for cargo documentation.
			</li>
			<li>
				<a href="https://fleetyards.net" rel="noopener">FleetYards</a> for independently extracted holds
				and hand-curated grid offsets, used as a cross-check and a seed for curated layouts.
			</li>
			<li>Righteous and Space Mono typefaces via Fontsource (OFL).</li>
			<li>
				Neon sign and deck-edge constructions follow the owner's portfolio,
				<a href="https://github.com/LuixBits/lupe-webfolio" rel="noopener">lupe-webfolio</a>.
			</li>
		</ul>
	</section>

	<section class="section" aria-labelledby="license">
		<h2 id="license">License</h2>
		<p>
			The Starculator code is open source under the
			<a href="https://github.com/LuixBits/starculator/blob/main/LICENSE" rel="noopener"
				>MIT License</a
			>. Game data remains the property of Cloud Imperium; this site redistributes numbers only,
			never models or textures.
		</p>
	</section>

	<MetalPlate>
		<p>
			This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium group of
			companies. Star Citizen®, Roberts Space Industries® and Cloud Imperium® are registered
			trademarks of Cloud Imperium Rights LLC.
		</p>
	</MetalPlate>
</article>

<style>
	.about {
		max-width: 46rem;
		display: grid;
		gap: 2rem;
	}
	.section {
		display: grid;
		gap: 0.75rem;
	}
	.section h2 {
		color: var(--neon-violet);
		letter-spacing: 0.2em;
		padding-bottom: 0.4rem;
		border-bottom: 1px solid #bfa0ff44;
	}
	.section p,
	.section li {
		color: var(--fg);
		overflow-wrap: anywhere;
	}
	ul {
		margin: 0;
		padding-left: 1.2rem;
		display: grid;
		gap: 0.5rem;
	}
	code {
		font-size: var(--fs-small);
		color: var(--sun);
	}
</style>

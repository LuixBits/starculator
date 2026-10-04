<script lang="ts">
	import '@fontsource/righteous';
	import '@fontsource/space-mono/400.css';
	import '@fontsource/space-mono/700.css';
	import './layout.css';
	import '../app.css';
	import { page } from '$app/state';
	import { asset } from '$app/paths';
	import type { LayoutProps } from './$types';
	import NeonSign from '#lib/components/NeonSign.svelte';
	import DeckEdge from '#lib/components/DeckEdge.svelte';
	import MetalPlate from '#lib/components/MetalPlate.svelte';
	import CrateStencil from '#lib/components/CrateStencil.svelte';
	import { getDataMeta } from '#lib/state/adapters.ts';

	let { children }: LayoutProps = $props();

	const meta = getDataMeta();
	const dataDate = meta.publishedAt.slice(0, 10);
	const nav = [
		{ href: '/', label: 'Deck' },
		{ href: '/ships/', label: 'Ships' },
		{ href: '/about/', label: 'About' }
	] as const;
	const isCurrent = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<link rel="icon" href={asset('favicon.svg')} type="image/svg+xml" />
	<link rel="manifest" href={asset('manifest.webmanifest')} />
	<meta name="theme-color" content="#241046" />
</svelte:head>

<a class="skip" href="#main">Skip to content</a>

<div class="deck">
	<header class="deck-head room">
		<a class="home" href="/" aria-label="Starculator, home">
			<NeonSign text="Starculator" level={1} hero color="pink" plate="Cargo planning deck" />
		</a>
		<nav class="deck-nav" aria-label="Main">
			<ul>
				{#each nav as item (item.href)}
					<li>
						<a href={item.href} aria-current={isCurrent(item.href) ? 'page' : undefined}
							>{item.label}</a
						>
					</li>
				{/each}
			</ul>
		</nav>
	</header>

	<main id="main" class="deck-main room room-enter" tabindex="-1">
		{@render children()}
	</main>

	<footer class="deck-foot">
		<DeckEdge />
		<div class="foot-content room">
			<div class="foot-plate">
				<MetalPlate>
					<p>
						This is an unofficial Star Citizen fan site, not affiliated with the Cloud Imperium
						group of companies. Star Citizen®, Roberts Space Industries® and Cloud Imperium® are
						registered trademarks of Cloud Imperium Rights LLC. Ship geometry comes from game data
						published by the Star Citizen Wiki team. No game meshes are shipped.
					</p>
					<p class="foot-links">
						<a href="/about/">About &amp; data</a> ·
						<a href="https://github.com/LuixBits/starculator" rel="noopener">Source (MIT)</a> ·
						<a href="https://github.com/LuixBits/starculator/issues" rel="noopener"
							>Report a wrong grid</a
						>
					</p>
				</MetalPlate>
			</div>
			<div class="foot-crate">
				<CrateStencil
					lines={[`DATA ${meta.gameVersion}`, dataDate, 'SCUNPACKED']}
					title={`Data from game version ${meta.gameVersion}, published ${dataDate}, source scunpacked-data`}
				/>
			</div>
		</div>
	</footer>
</div>

<style>
	.deck {
		display: flex;
		flex-direction: column;
		min-height: 100svh;
	}
	.deck-head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: 1rem 2rem;
		padding-top: clamp(1.2rem, 3vw, 2.4rem);
		padding-bottom: 1rem;
	}
	.home {
		text-decoration: none;
		color: inherit;
		display: inline-block;
		max-width: 100%;
	}
	.deck-nav ul {
		list-style: none;
		margin: 0;
		padding: 0.3rem;
		display: flex;
		gap: 0.25rem;
		border-radius: 6px;
		background: linear-gradient(#1a1426, #120d1d);
		border: 1px solid #3a2d4e;
		box-shadow:
			inset 0 1px 0 #ffffff10,
			0 8px 18px -10px #000;
	}
	.deck-nav a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 1rem;
		border-radius: 4px;
		color: var(--fg-muted);
		text-decoration: none;
		font-size: var(--fs-small);
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	.deck-nav a:hover {
		color: var(--fg);
		background: #ffffff08;
	}
	.deck-nav a[aria-current='page'] {
		color: var(--neon-cyan);
		box-shadow: inset 0 -2px 0 var(--accent-2);
		text-shadow: 0 0 8px #72f0e799;
	}
	.deck-main {
		flex: 1;
		padding-top: 1rem;
		padding-bottom: clamp(3rem, 6vw, 5rem);
		outline: none;
	}
	.deck-foot {
		position: relative;
		isolation: isolate;
		margin-top: 2rem;
		padding: 3.5rem 0 11.5rem;
		min-height: 420px;
		background: linear-gradient(to bottom, transparent, #160a30 40%);
	}
	.foot-content {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2rem;
		align-items: end;
	}
	.foot-plate {
		max-width: 46rem;
	}
	.foot-plate p + p {
		margin-top: 0.5rem;
	}
	.foot-links a {
		display: inline-block;
		padding: 0.55rem 0;
		color: var(--neon-cyan);
	}
	.foot-crate {
		justify-self: end;
		width: 22rem;
		max-width: 100%;
	}
	@media (max-width: 56rem) {
		.foot-content {
			grid-template-columns: 1fr;
		}
		.foot-crate {
			justify-self: start;
		}
	}
</style>

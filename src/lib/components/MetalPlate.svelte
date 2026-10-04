<script lang="ts">
	/** A small riveted metal plate; the text comes from `children`. */
	import type { Snippet } from 'svelte';
	let { children, tone = 'dark' }: { children: Snippet; tone?: 'dark' | 'light' } = $props();
</script>

<div class="plate tone-{tone}">
	<span class="rivet r1" aria-hidden="true"></span>
	<span class="rivet r2" aria-hidden="true"></span>
	<span class="rivet r3" aria-hidden="true"></span>
	<span class="rivet r4" aria-hidden="true"></span>
	<div class="text">{@render children()}</div>
</div>

<style>
	.plate {
		position: relative;
		padding: 0.85rem 1.4rem;
		border-radius: 3px;
		font-size: var(--fs-small);
		line-height: 1.5;
		letter-spacing: 0.04em;
		box-shadow:
			0 2px 0 #ffffff10 inset,
			0 -1px 0 #00000060 inset,
			0 6px 14px -6px #000;
	}
	.tone-dark {
		color: #d6c9d9;
		background:
			repeating-linear-gradient(135deg, #ffffff05 0 2px, transparent 2px 5px),
			linear-gradient(170deg, #6b5a66, #3d3240 45%, #2a2230);
		border: 1px solid #7a6676;
	}
	.tone-light {
		color: #241c2c;
		background:
			repeating-linear-gradient(135deg, #ffffff22 0 2px, transparent 2px 5px),
			linear-gradient(170deg, #c9bcc6, #9c8a99 50%, #7f6f7d);
		border: 1px solid #d8ccd5;
	}
	.rivet {
		position: absolute;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #d9ccd6, #6d5c6b 55%, #241c2a);
		box-shadow: 0 1px 1px #00000090;
	}
	.r1 {
		left: 6px;
		top: 6px;
	}
	.r2 {
		right: 6px;
		top: 6px;
	}
	.r3 {
		left: 6px;
		bottom: 6px;
	}
	.r4 {
		right: 6px;
		bottom: 6px;
	}
	.text {
		position: relative;
	}
</style>

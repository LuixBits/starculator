<script lang="ts">
	/**
	 * Amber-and-black striped tag pinned to the manifest, for warnings such as
	 * unplaced containers. The body comes from `children`.
	 */
	import type { Snippet } from 'svelte';
	let { title, children }: { title: string; children: Snippet } = $props();
</script>

<aside class="tag" aria-label={title}>
	<span class="pin" aria-hidden="true"></span>
	<div class="stripe" aria-hidden="true"></div>
	<div class="body">
		<p class="title">{title}</p>
		{@render children()}
	</div>
	<span class="hole" aria-hidden="true"></span>
</aside>

<style>
	.tag {
		position: relative;
		margin-top: 0.75rem;
		padding: 0.9rem 1rem 0.9rem 1.1rem;
		color: #1b1507;
		background: linear-gradient(#ffffff26, transparent 40%), linear-gradient(#ffd36e, #e7b94c);
		border-radius: 3px 10px 3px 3px;
		box-shadow:
			0 10px 16px -10px #000,
			inset 0 0 0 1px #00000026;
		transform: rotate(-0.8deg);
		font-size: var(--fs-small);
		line-height: 1.5;
	}
	.stripe {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 10px;
		border-radius: 3px 0 0 3px;
		background: repeating-linear-gradient(-45deg, #1b1507 0 7px, #ffd36e 7px 14px);
	}
	.pin {
		position: absolute;
		right: 12px;
		top: -6px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: radial-gradient(circle at 35% 35%, #ffffff, #c53a3a 40%, #6b1b1b);
		box-shadow: 0 2px 3px #00000080;
	}
	.hole {
		position: absolute;
		right: 14px;
		top: 10px;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--paper, #f3ead8);
		box-shadow: inset 0 1px 2px #00000060;
	}
	.body {
		padding-left: 0.5rem;
	}
	.title {
		font-family: var(--font-display);
		font-size: var(--fs-small);
		letter-spacing: 0.22em;
		text-transform: uppercase;
		margin: 0 0 0.35rem;
	}
	.body :global(ul) {
		margin: 0;
		padding-left: 1.1rem;
	}
</style>

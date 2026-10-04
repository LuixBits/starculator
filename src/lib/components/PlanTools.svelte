<script lang="ts">
	/** Share / export / import controls for the plan: a small tool tray under the manifest. */
	import { downloadPlan, planFromJson } from '../state/persist.ts';
	import type { Plan } from '../state/plan.svelte.ts';

	let {
		plan,
		shareUrl,
		onimport
	}: {
		plan: Plan;
		/** Current shareable URL (absolute when available). */
		shareUrl: string;
		onimport: () => void;
	} = $props();

	const uid = $props.id();
	let note = $state('');
	let timer: ReturnType<typeof setTimeout> | null = null;
	function flash(text: string) {
		note = text;
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => (note = ''), 2200);
	}
	$effect(() => () => {
		if (timer) clearTimeout(timer);
	});

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			flash('Link copied');
		} catch {
			flash('Copy failed: use the address bar');
		}
	}
	function exportJson() {
		downloadPlan(plan.snapshot());
		flash('Downloaded');
	}
	async function importJson(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		const snapshot = planFromJson(await file.text(), plan.shipSlug);
		if (!snapshot) {
			flash('Not a Starculator plan');
			return;
		}
		plan.restore({ ...snapshot, shipSlug: plan.shipSlug });
		onimport();
		flash(
			snapshot.shipSlug === plan.shipSlug ? 'Plan imported' : 'Imported counts from another ship'
		);
	}
</script>

<div class="tray" role="group" aria-label="Share and backup">
	<button type="button" onclick={copyLink}>Copy link</button>
	<button type="button" onclick={exportJson}>Export .json</button>
	<label class="file">
		<span>Import .json</span>
		<input id="{uid}-file" type="file" accept="application/json,.json" onchange={importJson} />
	</label>
	<span class="note small" role="status">{note}</span>
</div>

<style>
	.tray {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		border-radius: 0 0 6px 6px;
		background: linear-gradient(#2a2238, #1a1426);
		border: 1px solid #4a3d5f;
		border-top: 0;
		font-size: var(--fs-small);
	}
	button,
	.file {
		min-height: 44px;
		padding: 0.4rem 0.9rem;
		border-radius: 4px;
		border: 1px solid #5a4b70;
		background: #ffffff08;
		color: var(--fg);
		font-size: var(--fs-small);
		letter-spacing: 0.08em;
		text-transform: uppercase;
		display: inline-flex;
		align-items: center;
		cursor: pointer;
	}
	button:hover,
	.file:hover {
		border-color: var(--accent-2);
		color: var(--neon-cyan);
	}
	.file input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.file:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 5px;
	}
	.note {
		color: var(--sun);
		margin-left: auto;
	}
</style>

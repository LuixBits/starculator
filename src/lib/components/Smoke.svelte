<script lang="ts">
	let { label = 'smoke' }: { label?: string } = $props();
</script>

<p data-testid="smoke">{label}</p>

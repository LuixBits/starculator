import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Smoke from './Smoke.svelte';

describe('browser test infrastructure', () => {
	it('renders a Svelte component in Chromium', async () => {
		render(Smoke, { label: 'deck' });
		await expect.element(page.getByTestId('smoke')).toHaveTextContent('deck');
	});
});

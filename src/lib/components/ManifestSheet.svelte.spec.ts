import { page } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import ManifestSheet from './ManifestSheet.svelte';
import caterpillarJson from '../data/generated/ships/drake-caterpillar.json';
import type { Ship } from '../data/types.ts';
import { Plan } from '../state/plan.svelte.ts';

const caterpillar = caterpillarJson as Ship;

describe('ManifestSheet', () => {
	it('steppers and the number input update the plan counts', async () => {
		const plan = new Plan('drake-caterpillar');
		render(ManifestSheet, { plan, ship: caterpillar, onpack: () => {} });
		await page.getByRole('button', { name: 'More 24 SCU containers' }).click();
		await page.getByRole('button', { name: 'More 24 SCU containers' }).click();
		expect(plan.groups[0].counts[24]).toBe(2);
		await page.getByRole('button', { name: 'Fewer 24 SCU containers' }).click();
		expect(plan.groups[0].counts[24]).toBe(1);
		await page.getByRole('spinbutton', { name: /^8 SCU/ }).fill('5');
		expect(plan.groups[0].counts[8]).toBe(5);
		expect(plan.totalScu).toBe(24 + 40);
		await expect.element(page.getByText('6 boxes')).toBeInTheDocument();
	});

	it('disables sizes the ship cannot accept', async () => {
		const plan = new Plan('drake-caterpillar');
		render(ManifestSheet, { plan, ship: caterpillar, onpack: () => {} });
		await expect
			.element(page.getByRole('button', { name: 'More 32 SCU containers' }))
			.toBeDisabled();
	});

	it('submits the load plan and clears', async () => {
		const plan = new Plan('drake-caterpillar');
		const onpack = vi.fn();
		render(ManifestSheet, { plan, ship: caterpillar, onpack });
		await expect.element(page.getByRole('button', { name: 'Load plan' })).toBeDisabled();
		await page.getByRole('button', { name: 'More 1 SCU containers' }).click();
		await page.getByRole('button', { name: 'Load plan' }).click();
		expect(onpack).toHaveBeenCalledTimes(1);
		await page.getByRole('button', { name: 'Clear' }).click();
		expect(plan.totalBoxes).toBe(0);
	});

	it('adds and names contract groups up to four', async () => {
		const plan = new Plan('drake-caterpillar');
		render(ManifestSheet, { plan, ship: caterpillar, onpack: () => {} });
		const add = page.getByRole('button', { name: 'Add a contract group' });
		await add.click();
		await add.click();
		await add.click();
		expect(plan.groups).toHaveLength(4);
		expect(document.querySelector('.tab.add')).toBeNull();
		await page.getByRole('textbox', { name: 'Contract name' }).fill('Red Wind');
		expect(plan.groups[3].label).toBe('Red Wind');
	});
});

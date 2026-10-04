import { describe, expect, it } from 'vitest';
import { CRATE_PALETTE, crateColor, desaturateHex, mixHex } from './palette.ts';

describe('crateColor', () => {
	it('maps colorIndex 0..6 to --crate-1..7', () => {
		expect(crateColor(0)).toBe('#ff5ed1');
		expect(crateColor(6)).toBe('#d8f55c');
	});

	it('wraps indices beyond the palette and negative indices', () => {
		expect(crateColor(7)).toBe(CRATE_PALETTE[0]);
		expect(crateColor(-1)).toBe(CRATE_PALETTE[6]);
	});
});

describe('mixHex', () => {
	it('returns the endpoints at t = 0 and t = 1', () => {
		expect(mixHex('#000000', '#ffffff', 0)).toBe('#000000');
		expect(mixHex('#000000', '#ffffff', 1)).toBe('#ffffff');
	});

	it('blends and clamps t', () => {
		expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
		expect(mixHex('#000000', '#ffffff', 2)).toBe('#ffffff');
	});

	it('rejects malformed colours', () => {
		expect(() => mixHex('red', '#ffffff', 0.5)).toThrow();
	});
});

describe('desaturateHex', () => {
	it('leaves grey unchanged and moves saturated colours towards grey', () => {
		expect(desaturateHex('#808080', 0.5)).toBe('#808080');
		const out = desaturateHex('#ff0000', 1);
		expect(out).toBe('#808080');
	});
});

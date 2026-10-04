/**
 * Occupancy lattice for one cargo grid: a flat Uint8Array with one byte per
 * cell, indexed x-fastest (x + nx * (y + ny * z)). All methods take a box as
 * minimum corner `at` plus oriented size `dims` and assume integer inputs.
 */
import type { CellVec } from '../data/types.ts';

export class Lattice {
	readonly nx: number;
	readonly ny: number;
	readonly nz: number;
	readonly total: number;
	readonly occ: Uint8Array;
	/** Number of occupied cells. */
	used: number;

	constructor(cells: CellVec, occ?: Uint8Array, used = 0) {
		this.nx = cells.x;
		this.ny = cells.y;
		this.nz = cells.z;
		this.total = cells.x * cells.y * cells.z;
		this.occ = occ ?? new Uint8Array(this.total);
		this.used = used;
	}

	get cells(): CellVec {
		return { x: this.nx, y: this.ny, z: this.nz };
	}

	get free(): number {
		return this.total - this.used;
	}

	clone(): Lattice {
		return new Lattice(this.cells, this.occ.slice(), this.used);
	}

	index(x: number, y: number, z: number): number {
		return x + this.nx * (y + this.ny * z);
	}

	isOccupied(x: number, y: number, z: number): boolean {
		return this.occ[this.index(x, y, z)] === 1;
	}

	inBounds(at: CellVec, dims: CellVec): boolean {
		return (
			at.x >= 0 &&
			at.y >= 0 &&
			at.z >= 0 &&
			at.x + dims.x <= this.nx &&
			at.y + dims.y <= this.ny &&
			at.z + dims.z <= this.nz
		);
	}

	/** True when every cell of the box is free. Caller guarantees bounds. */
	isFree(at: CellVec, dims: CellVec): boolean {
		const { occ, nx, ny } = this;
		for (let z = at.z; z < at.z + dims.z; z++) {
			for (let y = at.y; y < at.y + dims.y; y++) {
				let i = at.x + nx * (y + ny * z);
				for (let x = 0; x < dims.x; x++, i++) if (occ[i] === 1) return false;
			}
		}
		return true;
	}

	/** Number of base cells resting on the floor or on an occupied cell. */
	supportCount(at: CellVec, dims: CellVec): number {
		if (at.z === 0) return dims.x * dims.y;
		const { occ, nx, ny } = this;
		const z = at.z - 1;
		let n = 0;
		for (let y = at.y; y < at.y + dims.y; y++) {
			let i = at.x + nx * (y + ny * z);
			for (let x = 0; x < dims.x; x++, i++) n += occ[i];
		}
		return n;
	}

	supportFraction(at: CellVec, dims: CellVec): number {
		return this.supportCount(at, dims) / (dims.x * dims.y);
	}

	/**
	 * Contact area in cell faces between the box and walls or other boxes on
	 * its four side faces (the bottom is counted via `supportCount`).
	 */
	sideContact(at: CellVec, dims: CellVec): number {
		const { occ, nx, ny, nz } = this;
		let n = 0;
		const x0 = at.x;
		const x1 = at.x + dims.x;
		const y0 = at.y;
		const y1 = at.y + dims.y;
		const z0 = at.z;
		const z1 = at.z + dims.z;
		// -x / +x faces
		if (x0 === 0) n += dims.y * dims.z;
		else
			for (let z = z0; z < z1; z++)
				for (let y = y0; y < y1; y++) n += occ[x0 - 1 + nx * (y + ny * z)];
		if (x1 === nx) n += dims.y * dims.z;
		else
			for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) n += occ[x1 + nx * (y + ny * z)];
		// -y / +y faces
		if (y0 === 0) n += dims.x * dims.z;
		else
			for (let z = z0; z < z1; z++)
				for (let x = x0; x < x1; x++) n += occ[x + nx * (y0 - 1 + ny * z)];
		if (y1 === ny) n += dims.x * dims.z;
		else
			for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) n += occ[x + nx * (y1 + ny * z)];
		// ceiling counts as a wall too: it keeps tall stacks against the roof honest
		if (z1 === nz) n += dims.x * dims.y;
		return n;
	}

	/** Marks (value 1) or clears (value 0) the box. Caller guarantees bounds and no overlap. */
	fill(at: CellVec, dims: CellVec, value: 0 | 1): void {
		const { occ, nx, ny } = this;
		let delta = 0;
		for (let z = at.z; z < at.z + dims.z; z++) {
			for (let y = at.y; y < at.y + dims.y; y++) {
				let i = at.x + nx * (y + ny * z);
				for (let x = 0; x < dims.x; x++, i++) {
					delta += value - occ[i];
					occ[i] = value;
				}
			}
		}
		this.used += delta;
	}

	/** Height of the topmost occupied cell plus one (0 when empty). */
	maxHeight(): number {
		const { occ, nx, ny, nz } = this;
		const layer = nx * ny;
		for (let z = nz - 1; z >= 0; z--) {
			const start = z * layer;
			for (let i = start; i < start + layer; i++) if (occ[i] === 1) return z + 1;
		}
		return 0;
	}
}

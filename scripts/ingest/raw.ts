/**
 * The subset of the scunpacked-data ships.json shape the ingest reads, plus a
 * structural check. Everything else in the 41 MB file is ignored.
 */

export interface RawBox {
	X: number;
	Y: number;
	Z: number;
}

export interface RawCargoGrid {
	UUID?: string;
	Class: string;
	SCU: number;
	X: number;
	Y: number;
	Z: number;
	MinSize?: RawBox | null;
	MaxSize?: RawBox | null;
	IsOpenContainer?: boolean;
	IsExternalContainer?: boolean;
	IsClosedContainer?: boolean;
}

export interface RawPort {
	HardpointName: string;
	ClassName: string;
}

export interface RawVehicle {
	UUID: string;
	ClassName: string;
	Name: string;
	Manufacturer?: { Code?: string; Name?: string } | null;
	Size?: number;
	Role?: string | null;
	Career?: string | null;
	Length: number;
	Width: number;
	Height: number;
	Cargo?: number;
	IsSpaceship?: boolean;
	IsVehicle?: boolean;
	IsGravlev?: boolean;
	CargoGrids?: RawCargoGrid[] | null;
	Systems?: { CargoGrids?: { Ports?: RawPort[] | null } | null } | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

function isRawBox(value: unknown): value is RawBox {
	return (
		isRecord(value) && isFiniteNumber(value.X) && isFiniteNumber(value.Y) && isFiniteNumber(value.Z)
	);
}

function isRawCargoGrid(value: unknown): value is RawCargoGrid {
	if (!isRecord(value)) return false;
	if (typeof value.Class !== 'string') return false;
	if (![value.SCU, value.X, value.Y, value.Z].every(isFiniteNumber)) return false;
	for (const key of ['MinSize', 'MaxSize'] as const) {
		const box = value[key];
		if (box !== undefined && box !== null && !isRawBox(box)) return false;
	}
	return true;
}

function isRawPort(value: unknown): value is RawPort {
	return (
		isRecord(value) &&
		typeof value.HardpointName === 'string' &&
		typeof value.ClassName === 'string'
	);
}

/** Minimal structural check for one vehicle entry. */
export function isRawVehicle(value: unknown): value is RawVehicle {
	if (!isRecord(value)) return false;
	if (
		typeof value.UUID !== 'string' ||
		typeof value.ClassName !== 'string' ||
		typeof value.Name !== 'string'
	)
		return false;
	if (![value.Length, value.Width, value.Height].every(isFiniteNumber)) return false;
	if (value.CargoGrids !== undefined && value.CargoGrids !== null) {
		if (!Array.isArray(value.CargoGrids) || !value.CargoGrids.every(isRawCargoGrid)) return false;
	}
	const ports =
		isRecord(value.Systems) && isRecord(value.Systems.CargoGrids)
			? value.Systems.CargoGrids.Ports
			: undefined;
	if (ports !== undefined && ports !== null && (!Array.isArray(ports) || !ports.every(isRawPort)))
		return false;
	return true;
}

export function rawGrids(vehicle: RawVehicle): RawCargoGrid[] {
	return vehicle.CargoGrids ?? [];
}

export function rawPorts(vehicle: RawVehicle): RawPort[] {
	return vehicle.Systems?.CargoGrids?.Ports ?? [];
}

export function hasCargoGrids(vehicle: RawVehicle): boolean {
	return rawGrids(vehicle).length > 0;
}

/**
 * Module worker entry: one PackRequest in, one PackResponse out. Only ever
 * loaded in the browser through `client.ts`, so the worker globals are typed
 * locally instead of pulling in the webworker lib.
 */
import { handlePackRequest, type PackRequest, type PackResponse } from './protocol.ts';

interface WorkerScope {
	onmessage: ((event: MessageEvent<PackRequest>) => void) | null;
	postMessage(message: PackResponse): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
	scope.postMessage(handlePackRequest(event.data));
};

import { Subject } from "rxjs";

const eventBus = new Subject<BusEvent>();

export function useEventBus() {
	return eventBus;
}

export type BusEvent = {
	timestamp: string;
	event: string;
	node_id: string;
	direction: "tx" | "rx";
	room?: string;
};

import { ConnectionState } from "@/stores/connection";
import { SettingsState } from "@/stores/settings";
import type { QueueMode } from "common/models/types";
import type { QueueItem } from "common/models/video";
import type { Store } from "vuex";

// workaround until store.js is converted to typescript.
type FullOTTStoreState = BaseStoreState & {
	settings: SettingsState;
	connection: ConnectionState;
};

let _store: Store<FullOTTStoreState>;

// temp state interface that needs to match what's in @/store.js
interface BaseStoreState {
	room: {
		name: string;
		title: string;
		description: string;
		isTemporary: boolean;
		queueMode: QueueMode;
		currentSource: QueueItem | null;
		queue: QueueItem[];
		isPlaying: boolean;
		playbackPosition: number;
		hasOwner: boolean;
		chatMessages: unknown[];
		voteCounts?: Map<string, number>;
	};

	keepAliveInterval: number | null;
}

export function setStoreInstance(s: Store<unknown>) {
	_store = s as Store<FullOTTStoreState>;
}

/** This is a workaround to make it possible to convert components that
 * reference the Vuex store to use the composition api. This should be
 * easily replacable with `useStore()` in vuex 4. */
export function useStore(): Store<FullOTTStoreState> {
	return _store;
}

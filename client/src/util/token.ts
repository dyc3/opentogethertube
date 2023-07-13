import type { FullOTTStoreState } from "../store";
import type { Store } from "vuex";

export async function waitForToken(store: Store<FullOTTStoreState>) {
	if (store.getters["users/token"]) {
		return;
	}
	console.info("Waiting for auth token...");
	return new Promise<void>(resolve => {
		const unsub = store.subscribe(mutation => {
			if (mutation.type === "users/SET_AUTH_TOKEN") {
				console.info("Got auth token");
				resolve();
				unsub();
			}
		});
	});
}

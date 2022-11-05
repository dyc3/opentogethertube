import { Toast } from "@/models/toast";
import { useStore, Store } from "vuex";

let _store: Store<unknown> | null = null;

export function setStore(store: Store<unknown>) {
	_store = store;
}

export function add(toast: Omit<Toast, "id">): void {
	if (!_store) {
		throw new Error("Store not set");
	}
	let store = _store;
	store.commit("toast/ADD_TOAST", toast);
}
export function remove(id: symbol): void {
	if (!_store) {
		throw new Error("Store not set");
	}
	let store = _store;
	store.commit("toast/REMOVE_TOAST", id);
}

export default {
	setStore,
	add,
	remove,
};

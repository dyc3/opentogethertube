import { Toast } from "@/models/toast";
import { Store } from "vuex";
import { useStore } from "@/store";

let _store: Store<unknown> | null = null;

export function setStore(store: Store<unknown>) {
	_store = store;
}

export function add(toast: Omit<Toast, "id">): void {
	let store = useStore() ?? _store;
	if (!store) {
		throw new Error("toast: Store not found");
	}
	store.commit("toast/ADD_TOAST", toast);
}
export function remove(id: symbol): void {
	let store = useStore() ?? _store;
	if (!store) {
		throw new Error("toast: Store not found");
	}
	store.commit("toast/REMOVE_TOAST", id);
}

export default {
	setStore,
	add,
	remove,
};

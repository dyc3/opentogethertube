import { Toast } from "@/models/toast";
import { useStore } from "vuex";

export function add(toast: Omit<Toast, "id">): void {
	const store = useStore();
	store.commit("toast/ADD_TOAST", toast);
}
export function remove(id: symbol): void {
	const store = useStore();
	store.commit("toast/REMOVE_TOAST", id);
}

export default {
	add,
	remove,
};

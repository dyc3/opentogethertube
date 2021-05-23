import { Toast } from '@/models/toast';

export default {
	install(Vue: Vue, options: { store: any; }): void {
		const store = options.store;
		Vue.prototype.$toast = {
			add(toast: Omit<Toast, "id">): void {
				store.commit("toast/ADD_TOAST", toast);
			},
		};
	},
};

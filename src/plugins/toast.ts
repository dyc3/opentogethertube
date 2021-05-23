import { Toast } from '@/models/toast';
import { PluginObject } from 'vue/types';

type ToastPluginOptions = { store: any; }

const plugin: PluginObject<ToastPluginOptions> = {
	install(vue, options: ToastPluginOptions): void {
		const store = options.store;
		vue.prototype.$toast = {
			add(toast: Omit<Toast, "id">): void {
				store.commit("toast/ADD_TOAST", toast);
			},
			remove(id: symbol): void {
				store.commit("toast/REMOVE_TOAST", id);
			},
		};
	},
};
export default plugin;

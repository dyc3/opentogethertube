/* eslint-disable no-unused-vars */
import { Toast } from "@/models/toast";
import iVue from "vue";

declare module "vue/types/vue" {
	interface Vue extends iVue {
		prototype: any;
		$route: {
			params: {
				roomId?: string;
			};
		};
	}
}

declare module "*.vue" {
	// eslint-disable-next-line no-undef
	export default Vue;
}

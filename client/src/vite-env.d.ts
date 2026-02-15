/// <reference types="vite/client" />

declare module "*.vue" {
	import type { DefineComponent } from "vue";
	const component: DefineComponent<{}, {}, any>;
	export default component;
}

declare module "vuetify/styles";
declare module "vuetify/components";
declare module "vuetify/directives";
declare module "vuetify/iconsets/mdi-svg";

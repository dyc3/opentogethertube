import { createApp } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import App from "./App.vue";
import vuetify from "./plugins/vuetify";
import { store, key } from "./store";
import { router } from "./router";
import { i18n } from "./i18n";
import { OttRoomConnectionPlugin } from "./plugins/connection";
import { OttSfxPlugin } from "./plugins/sfx";

const queryClient = new QueryClient();

createApp(App)
	.use(store, key)
	.use(router)
	.use(VueQueryPlugin, { queryClient })
	.use(i18n)
	.use(vuetify)
	.use(OttRoomConnectionPlugin)
	.use(OttSfxPlugin)
	.mount("#app");

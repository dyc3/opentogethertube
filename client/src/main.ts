import { createApp } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import "./styles/theme.css";
import App from "./App.vue";
import { store, key } from "./store";
import { router } from "./router";
import { i18n } from "./i18n";
import { OttRoomConnectionPlugin } from "./plugins/connection";
import { OttSfxPlugin } from "./plugins/sfx";
import { OttUiPlugin } from "./plugins/ui";

const queryClient = new QueryClient();

// default theme until settings load
if (!document.documentElement.dataset.theme) {
	document.documentElement.dataset.theme = "dark";
}

createApp(App)
	.use(store, key)
	.use(router)
	.use(VueQueryPlugin, { queryClient })
	.use(i18n)
	.use(OttUiPlugin)
	.use(OttRoomConnectionPlugin)
	.use(OttSfxPlugin)
	.mount("#app");

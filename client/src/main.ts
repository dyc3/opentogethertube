import { createApp } from "vue";
import App from "./App.vue";
import { i18n } from "./i18n";
import { OttRoomConnectionPlugin } from "./plugins/connection";
import { OttSfxPlugin } from "./plugins/sfx";
import vuetify from "./plugins/vuetify";
import { router } from "./router";
import { key, store } from "./store";

createApp(App)
	.use(store, key)
	.use(router)
	.use(i18n)
	.use(vuetify)
	.use(OttRoomConnectionPlugin)
	.use(OttSfxPlugin)
	.mount("#app");

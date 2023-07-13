import { createApp } from "vue";
import App from "./App.vue";
import vuetify from "./plugins/vuetify";
import { store, key } from "./store";
import { router } from "./router";
import { i18n } from "./i18n";
import { OttRoomConnectionPlugin } from "./plugins/connection";
import { OttSfxPlugin } from "./plugins/sfx";

createApp(App)
	.use(store, key)
	.use(router)
	.use(i18n)
	.use(vuetify)
	.use(OttRoomConnectionPlugin)
	.use(OttSfxPlugin)
	.mount("#app");

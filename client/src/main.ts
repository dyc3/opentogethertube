import { createApp } from "vue";
import App from "./App.vue";
import vuetify from "./plugins/vuetify";
import { store } from "./store";
import { router } from "./router";
import { i18n } from "./i18n";

createApp(App).use(store).use(router).use(i18n).use(vuetify).mount("#app");

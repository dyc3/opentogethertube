import { createApp } from "vue";
import App from "./App.vue";
import vuetify from "./plugins/vuetify";
import { store } from "./store";
import { router } from "./router";

createApp(App).use(store).use(router).use(vuetify).mount("#app");

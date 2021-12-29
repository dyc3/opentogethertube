import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';

import VueGtag from "vue-gtag";
Vue.use(VueGtag, {
  config: { id: "UA-148983263-2" },
}, router);

import VueEvents from 'vue-events';
Vue.use(VueEvents);

import vuetify from '@/plugins/vuetify';

import Fragment from 'vue-fragment';
Vue.use(Fragment.Plugin);

import toast from "@/plugins/toast";
import { i18n } from './i18n';
Vue.use(toast, { store });

Vue.config.productionTip = false;

window.vm = new Vue({
  vuetify,
  store,
  router,
  i18n,
  render: h => h(App),
}).$mount('#app');

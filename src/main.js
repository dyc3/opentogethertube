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

import 'vue-slider-component/theme/default.css';

import Fragment from 'vue-fragment';
Vue.use(Fragment.Plugin);

Vue.config.productionTip = false;

window.vm = new Vue({
  vuetify,
  store,
  router,
  render: h => h(App),
}).$mount('#app');

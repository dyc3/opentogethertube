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

import VueNativeWebsocket from "vue-native-websocket";
Vue.use(VueNativeWebsocket, `ws://${window.location.host}/api`, {
  store: store,
  format: 'json',
  reconnection: true,
  reconnectionDelay: 3000,
  connectManually: true,
 });

import vuetify from '@/plugins/vuetify';

import VueYoutube from 'vue-youtube';
Vue.use(VueYoutube);

import VueSlider from 'vue-slider-component';
import 'vue-slider-component/theme/default.css';
Vue.component('VueSlider', VueSlider);

Vue.config.productionTip = false;

new Vue({
  vuetify,
  store,
  router,
  render: h => h(App),
}).$mount('#app');

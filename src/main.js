import Vue from 'vue';
import App from './App.vue';
import router from './router';

import VueEvents from 'vue-events';
Vue.use(VueEvents);

import VueNativeSock from 'vue-native-websocket';
Vue.use(VueNativeSock, "ws://localhost:8080/api", {
  format: 'json',
  reconnection: true,
  reconnectionDelay: 3000,
 });

import VueMaterial from 'vue-material';
import 'vue-material/dist/vue-material.min.css';
Vue.use(VueMaterial);

import VueYoutube from 'vue-youtube';
Vue.use(VueYoutube);

Vue.config.productionTip = false;

new Vue({
  router,
  render: h => h(App)
}).$mount('#app');

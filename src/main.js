import Vue from 'vue';
import App from './App.vue';
import router from './router';
import store from './store';

import VueEvents from 'vue-events';
Vue.use(VueEvents);

// import VueWebsocket from "vue-websocket";
// Vue.use(VueWebsocket, "ws://localhost:8080/api", {
//   reconnection: true,
//   reconnectionDelay: 3000,
//  });

import VueNativeWebsocket from "vue-native-websocket";
Vue.use(VueNativeWebsocket, "ws://localhost:8080/api", {
  store: store,
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
  store,
  router,
  render: h => h(App)
}).$mount('#app');

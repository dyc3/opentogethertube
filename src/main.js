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
Vue.use(VueNativeWebsocket, `ws://${window.location.host}/api`, {
  store: store,
  format: 'json',
  reconnection: true,
  reconnectionDelay: 3000,
  connectManually: true,
 });

// import VueMaterial from 'vue-material';
// import 'vue-material/dist/vue-material.min.css';
// Vue.use(VueMaterial);

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
  render: h => h(App)
}).$mount('#app');

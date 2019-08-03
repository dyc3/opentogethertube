
import Vue from 'vue';
import Vuetify from 'vuetify';
import 'vuetify/dist/vuetify.min.css';
import '@mdi/font/css/materialdesignicons.css';
import '@fortawesome/fontawesome-free/css/all.css';
Vue.use(Vuetify);

import colors from 'vuetify/lib/util/colors';

export default new Vuetify({
	icons: {
		iconfont: "fa"
	},
	theme: {
		dark: true,
		themes: {
			dark: {
				primary: "#ffb300",
				secondary: "#aa00ff"
			}
		}
	},
});
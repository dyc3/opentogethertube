import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import "@fortawesome/fontawesome-free/css/all.css";
import { createVuetify, ThemeDefinition } from "vuetify/lib/framework.mjs";
import { fa } from "vuetify/iconsets/fa";
import { mdi } from "vuetify/iconsets/mdi";
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

const themeDark: ThemeDefinition = {
	dark: true,
	colors: {
		primary: "#ffb300", // orange
		secondary: "#42A5F5", // blue
	},
};

const themeLight: ThemeDefinition = {
	dark: false,
};

const vuetify = createVuetify({
	components,
	directives,
	icons: {
		defaultSet: "fa",
		sets: {
			fa,
			mdi,
		},
	},
	theme: {
		defaultTheme: "dark",
		themes: {
			dark: themeDark,
			light: themeLight,
		},
	},
});

export default vuetify;

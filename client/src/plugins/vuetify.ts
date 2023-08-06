import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import "@fortawesome/fontawesome-free/css/all.css";
import { createVuetify, ThemeDefinition } from "vuetify/lib/framework.mjs";
import { fa } from "vuetify/iconsets/fa";
import { mdi } from "vuetify/iconsets/mdi";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

const themeDark: ThemeDefinition = {
	dark: true,
	colors: {
		"primary": "#ffb300", // orange
		"primary-lighten-1": "#FFC233",
		"primary-darken-1": "#F5AB00",
		"secondary": "#42A5F5", // blue
	},
};

const themeLight: ThemeDefinition = {
	dark: false,
	colors: {
		"media-control-surface": "#ffffff",
		"primary-lighten-1": "#7C1FFF",
	},
};

const themeDeepRed: ThemeDefinition = {
	dark: true,
	colors: {
		"primary": "#D00000",
		"primary-lighten-1": "#f50000",
		"primary-darken-1": "#b80000",
		"secondary": "#FFBA08",
		"background": "#280411",
		"surface": "#370617",
	},
};

const themeDeepBlue: ThemeDefinition = {
	dark: true,
	colors: {
		"primary": "#a8eff0",
		"primary-lighten-1": "#b9f2f3",
		"primary-darken-1": "#8539ea",
		"secondary": "#42A5F5",
		"background": "#001021",
		"surface": "#001a37",
	},
};

const vuetify = createVuetify({
	components,
	directives,
	icons: {
		defaultSet: "mdi",
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
			deepred: themeDeepRed,
			deepblue: themeDeepBlue,
		},
	},
});

export default vuetify;

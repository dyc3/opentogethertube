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
		"secondary": "#CF7826",
		"background": "#280411",
		"surface": "#370617",
		"success": "#00A878",
		"warning": "#E15112",
		"error": "#B10F2E",
	},
};

const themeDeepBlue: ThemeDefinition = {
	dark: true,
	colors: {
		"primary": "#4288F0",
		"primary-lighten-1": "#b9f2f3",
		"primary-darken-1": "#1b9b9d",
		"secondary": "#42A5F5",
		"background": "#001021",
		"surface": "#001a37",
		"success": "#00A878",
		"warning": "#F46036",
		"error": "#B10F2E",
	},
};

const themeGreenSlate: ThemeDefinition = {
	dark: true,
	colors: {
		primary: "#48e87d",
		secondary: "#d9bc6a",
		background: "#1f1f1f",
		surface: "#303030",
		success: "#48e87d",
		warning: "#efeb68",
		error: "#f66f64",
	},
};

const themeStrawberry: ThemeDefinition = {
	dark: false,
	colors: {
		"primary": "#e8035f",
		"secondary": "#83b264",
		"background": "#ffffff",
		"surface": "#fac7c5",
		"success": "#83b264",
		"warning": "#F19A3E",
		"error": "#460b25",
		"media-control-surface": "#ffffff",
		"on-background": "#460b25",
		"on-surface": "#460b25",
		"on-warning": "#460b25",
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
			greenslate: themeGreenSlate,
			strawberry: themeStrawberry,
		},
	},
});

export default vuetify;

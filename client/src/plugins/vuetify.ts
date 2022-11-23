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
		primary: "#ffb300", // orange
		secondary: "#42A5F5", // blue
	},
};

const themeLight: ThemeDefinition = {
	dark: false,
};

const themeDeepGreen: ThemeDefinition = {
	dark: true,
	colors: {
		primary: "#4caf50",
		secondary: "#b7f397",
		background: "#042100",
		surface: "#042100",
	},
};

const themeDeepBlue: ThemeDefinition = {
	dark: true,
	colors: {
		primary: "#a8eff0",
		secondary: "#42A5F5",
		background: "#001021",
		surface: "#001021",
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
			deepgreen: themeDeepGreen,
			deepblue: themeDeepBlue,
		},
	},
});

export default vuetify;

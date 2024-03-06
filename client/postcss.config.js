import postCssPurge from "@fullhuman/postcss-purgecss";

const vuePath = /\.vue(\?.+)?$/;

export default {
	plugins: [
		postCssPurge({
			contentFunction: sourceInputFile => {
				if (vuePath.test(sourceInputFile)) {
					return [sourceInputFile.replace(vuePath, ".vue")];
				}
				return ["src/**/*.vue", "index.html", "node_modules/vuetify/lib/iconsets/mdi.mjs"];
			},
			defaultExtractor(content) {
				if (content.startsWith("<template")) {
					content = `${content.split("</template")[0]}</template>`;
				}
				return content.match(/[\w-/:]+(?<!:)/g) || [];
			},
			safelist: [
				/^hero/,
				/^role/,
				/^v-/,
				/^textarea$/,
				/^button$/,
				/^input$/,
				/^select$/,
				/^opt-group$/,
				/-(leave|enter|appear)(|-(to|from|active))$/,
				/^(?!(|.*?:)cursor-move).+-move$/,
				/^router-link(|-exact)-active$/,
				/data-v-.*/,
				/^(align|justify)-center/,
				/^bg-.*/,
				/^fa[sr]$/,
				"mdi",
				// HACK: these classes are used by vuetify, but not detected by purgecss
				"mdi-chevron-up",
				"mdi-check",
				"mdi-close-circle",
				"mdi-close",
				"mdi-close-circle",
				"mdi-check-circle",
				"mdi-information",
				"mdi-alert-circle",
				"mdi-close-circle",
				"mdi-chevron-left",
				"mdi-chevron-right",
				"mdi-checkbox-marked",
				"mdi-checkbox-blank-outline",
				"mdi-minus-box",
				"mdi-circle",
				"mdi-arrow-up",
				"mdi-arrow-down",
				"mdi-chevron-down",
				"mdi-menu",
				"mdi-menu-down",
				"mdi-radiobox-marked",
				"mdi-radiobox-blank",
				"mdi-pencil",
				"mdi-star-outline",
				"mdi-star",
				"mdi-star-half-full",
				"mdi-cached",
				"mdi-page-first",
				"mdi-page-last",
				"mdi-unfold-more-horizontal",
				"mdi-paperclip",
				"mdi-plus",
				"mdi-minus",
				"mdi-calendar",
				"mdi-eyedropper",
				/^vue-slider/,
			],
		}),
	],
};

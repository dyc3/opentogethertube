const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`) });

module.exports = {
	devServer: {
		proxy: {
			"^/api": {
				target: "http://localhost:3000",
				ws: true,
			},
		},
	},
	transpileDependencies: ["vuetify"],
	pluginOptions: {
		webpackBundleAnalyzer: {
			openAnalyzer: false,
		},
	},
	configureWebpack: {
		plugins: [],
	},
	chainWebpack: (config) => {
		config.plugin('define').tap(definitions => {
			definitions[0]['process.env']['GOOGLE_DRIVE_API_KEY'] = JSON.stringify(process.env.GOOGLE_DRIVE_API_KEY);
			return definitions;
		});
	},
};

const PreloadWebpackPlugin = require('@vue/preload-webpack-plugin');

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
		plugins: [new PreloadWebpackPlugin()],
	},
};

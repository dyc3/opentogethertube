const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), `env/${process.env.NODE_ENV}.env`) });
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

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
			analyzerHost: "0.0.0.0",
			openAnalyzer: false,
		},
	},
	configureWebpack: {
		resolve: {
			extensions: [".ts", ".js"],
		},
		module: {
			rules: [
				{
					test: /\.tsx?$/,
					loader: 'ts-loader',
					exclude: /node_modules/,
					options: {
						// disable type checker - we will use it in fork plugin
						transpileOnly: true,
					},
				},
			],
		},
		plugins: [new ForkTsCheckerWebpackPlugin()],
	},
	chainWebpack: (config) => {
		config.plugin('define').tap(definitions => {
			definitions[0]['process.env']['GOOGLE_DRIVE_API_KEY'] = JSON.stringify(process.env.GOOGLE_DRIVE_API_KEY);
			if (process.env.SHORT_URL) {
				definitions[0]['process.env']['SHORT_URL'] = JSON.stringify(process.env.SHORT_URL);
			}
			return definitions;
		});
	},
};

// biome-ignore lint/style/noCommonJs: config file
module.exports = {
	presets: [["@vue/app", { useBuiltIns: "entry" }]],
	env: {
		test: {
			plugins: ["@babel/plugin-transform-modules-commonjs"],
		},
	},
};

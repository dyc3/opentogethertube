module.exports = {
	presets: [["@vue/app", { useBuiltIns: "entry" }]],
	env: {
		test: {
			plugins: ["@babel/plugin-transform-modules-commonjs"],
		},
	},
};

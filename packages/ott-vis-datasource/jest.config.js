// force timezone to UTC to allow tests to work regardless of local timezone
// generally used by snapshots, but can affect specific tests
process.env.TZ = "UTC";

// biome-ignore lint/style/noCommonJs: biome migration
module.exports = {
	// Jest configuration provided by Grafana scaffolding
	// biome-ignore lint/style/noCommonJs: biome migration
		...require("./.config/jest.config"),
};

import { e2e } from "@grafana/e2e";

e2e.scenario({
	describeName: "Smoke test",
	itName: "Smoke test",
	scenario: () => {
		e2e.pages.Home.visit();
		e2e().contains("Welcome to Grafana").should("be.visible");
	},
});

e2e.scenario({
	describeName: "Smoke: Datasource makes outbound request",
	itName: "Smoke: Outbound Request",
	scenario: () => {
		e2e.components.DataSource.DataSourceHttpSettings.urlInput("http://localhost:8081");
		e2e.
		e2e().check();
	}
});

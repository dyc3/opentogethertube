import { e2e } from "@grafana/e2e";

e2e.scenario({
	describeName: "Smoke test",
	itName: "Smoke test",
	scenario: () => {
		e2e.pages.Home.visit();
		e2e().contains("Welcome to Grafana").should("be.visible");
	},
});

// e2e.scenario({
// 	describeName: "Smoke: Datasource makes outbound request",
// 	itName: "Smoke: Datasource save and test",
// 	scenario: () => {
// 		cy.intercept("http://localhost:8000/status", {
// 			statusCode: 200,
// 			body: "OK",
// 		}).as("healthCheck");
// 		e2e.pages.DataSources.visit();
// 		e2e().contains("vis-datasource").click();
// 		e2e.pages.DataSource.saveAndTest().click();
// 		cy.wait("@healthCheck");
// 		e2e.pages.DataSource.alert().should("be.visible").should("contain", "Success");
// 	},
// });

e2e.scenario({
	describeName: "Smoke: Datasource makes outbound request",
	itName: "Smoke: Datasource explore, poll state",
	scenario: () => {
		cy.intercept("http://localhost:8000/state", {
			statusCode: 200,
			body: [],
		}).as("getState");
		e2e.pages.Explore.visit();
		e2e.components.DataSourcePicker.inputV2().click().type("vis{enter}");
		e2e.pages.Explore.General.container().should("be.visible");
		cy.get('[data-testid="vis-query-text"]').click().type("foo");
		e2e.components.RefreshPicker.runButtonV2().click();
		cy.wait("@getState");
		e2e.pages.Explore.General.table().should("be.visible");
	},
});

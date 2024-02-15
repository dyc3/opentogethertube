describe("Websocket connection", () => {
	beforeEach(() => {
		cy.ottEnsureToken();
		cy.ottResetRateLimit();
		cy.ottRequest({ method: "POST", url: "/api/room/generate" }).then(resp => {
			// @ts-expect-error Cypress doesn't know how to respect this return type
			cy.visit(`/room/${resp.body.room}`);
		});
	});

	it("should connect to the websocket", () => {
		cy.get("#connectStatus").should("contain", "Connected");
	});

	it("should connect to the websocket on reconnect", () => {
		cy.get("#connectStatus").should("contain", "Connected");
		cy.get("button").eq(0).focus(); // focus something so keyboard shortcuts work
		cy.realPress(["Control", "Shift", "F12"]);
		cy.get("button").contains("Disconnect Me").click();
		cy.scrollTo("top");
		cy.get("#connectStatus").should("contain", "Connecting");
		cy.get("#connectStatus").should("contain", "Connected");
	});
})
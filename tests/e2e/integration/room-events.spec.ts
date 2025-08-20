describe("Room events", () => {
	Cypress.on("uncaught:exception", (err, runnable) => {
		return false;
	});

	beforeEach(() => {
		cy.ottEnsureToken();
		cy.ottResetRateLimit();
		cy.ottRequest({ method: "POST", url: "/api/room/generate" }).then(resp => {
			// @ts-expect-error Cypress doesn't know how to respect this return type
			cy.visit(`/room/${resp.body.room}`);
		});
	});

	it("should show toasts when adding a video and skipping it", () => {
		cy.contains("button", "Add a video").click();
		cy.get('[data-cy="add-preview-input"]').type("https://vjs.zencdn.net/v/oceans.mp4");
		cy.get(".video button").eq(1).click();
		cy.get(".toast-item").contains("added oceans");
		cy.get("video").should("exist").scrollIntoView();

		cy.wait(200);
		cy.get('[aria-label="Next video"]').click();
		cy.get(".toast-item").contains("skipped oceans");
	});
});

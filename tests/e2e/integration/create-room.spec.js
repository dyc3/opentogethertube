// create-room.spec.js created with Cypress
//
// Start writing your Cypress tests below!
// If you're unfamiliar with how Cypress works,
// check out the link below and learn how to write your first test:
// https://on.cypress.io/writing-first-test

describe("Creating Rooms", () => {
	it("should create a temporary room", () => {
		cy.visit(Cypress.config().baseUrl);
		cy.contains("Create Room").should("be.visible").click();
		cy.wait(500);
		cy.location("pathname").should((path) => {
			expect(path).to.include("room");
		});
		cy.get("h1").contains("Temporary Room").scrollIntoView().should("be.visible");
		cy.get("#connectStatus").should("have.text", "Connected");
	});
});

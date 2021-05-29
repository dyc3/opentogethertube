describe("Creating Rooms", () => {
	it("should create a temporary room", () => {
		cy.visit(Cypress.config().baseUrl);
		cy.contains("Create Room").should("be.visible").click();
		cy.get('[role="menu"]').contains('[role="menuitem"]', "Create Temporary Room").should("be.visible").click();
		cy.wait(500);
		cy.location("pathname").should((path) => {
			expect(path).to.include("room");
		});
		cy.get("h1").contains("Temporary Room").scrollIntoView().should("be.visible").should("have.text", "Temporary Room");
		cy.get("#connectStatus").should("have.text", "Connected");
	});

	it("should create a permanent room", () => {
		cy.visit(Cypress.config().baseUrl);
		cy.contains("Create Room").should("be.visible").click();
		cy.get('[role="menu"]').contains('[role="menuitem"]', "Create Permanent Room").should("be.visible").click();

		let roomName = Math.random().toString(36).substring(2);
		cy.get('form').find("input").first().type(roomName);
		cy.get('form').submit();

		cy.wait(500);
		cy.location("pathname").should((path) => {
			expect(path).to.include("room");
		});
		cy.get("h1").contains(roomName).scrollIntoView().should("be.visible").should("have.text", roomName);
		cy.get("#connectStatus").should("have.text", "Connected");
	});
});

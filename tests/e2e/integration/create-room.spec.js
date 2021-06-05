import faker from "faker";
import uuid from "uuid";

describe("Creating Rooms", () => {
	beforeEach(() => {
		cy.request("POST", "/api/dev/reset-rate-limit");
	});

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

		let roomName = uuid.v4().substring(0, 20);
		cy.get('form').find("input").first().type(roomName);
		cy.get('form').submit();

		cy.wait(500);
		cy.location("pathname").should((path) => {
			expect(path).to.include("room");
		});
		cy.get("h1").contains(roomName).scrollIntoView().should("be.visible").should("have.text", roomName);
		cy.get("#connectStatus").should("have.text", "Connected");
	});

	describe("Room Ownership", () => {
		let userCreds = null;
		before(() => {
			userCreds = {
				email: faker.internet.email(),
				username: faker.internet.userName(faker.name.firstName(), faker.name.lastName()),
				password: faker.internet.password(12),
			};
			cy.request("POST", "/api/user/register", userCreds);
		});

		beforeEach(() => {
			cy.clearCookies();
			cy.clearLocalStorage();
			cy.reload();
		});

		function createRoom() {
			cy.visit(Cypress.config().baseUrl);
			cy.contains("Create Room").click();
			cy.get('[role="menu"]').contains('[role="menuitem"]', "Create Permanent Room").click();

			let roomName = uuid.v4().substring(0, 20);
			cy.get('form').find("input").first().type(roomName);
			cy.get('form').submit();

			cy.wait(500);
			cy.location("pathname").should((path) => {
				expect(path).to.include("room");
			});
		}

		function checkPermissionsEditor() {
			cy.contains("Permissions Editor").should("contain", "Viewing as: Owner");
		}

		it("should create a room then claim", () => {
			createRoom();
			cy.request("POST", "/api/user/login", userCreds);
			cy.reload();

			cy.contains("Settings").click();
			cy.contains("button", "Claim Room").should("be.visible").click();
			cy.wait(200);
			cy.contains("button", "Save").scrollIntoView().should("be.visible").should("not.be.disabled").should("not.have.css", "pointer-events", "none");
			checkPermissionsEditor();
		});

		it("should create a room that is already claimed", () => {
			cy.request("POST", "/api/user/login", userCreds);
			cy.reload();

			createRoom();
			cy.contains("Settings").click();
			cy.contains("button", "Save").scrollIntoView().should("be.visible");
			cy.contains("button", "Claim Room").should("not.exist");

			cy.get(".user").should("have.class", "role-owner");
			checkPermissionsEditor();
		});
	});
});

import faker from "faker";
const uuid = require("uuid");

describe("Creating Rooms", () => {
	beforeEach(() => {
		cy.clearCookies();
		cy.clearLocalStorage();
		cy.ottEnsureToken();
		cy.ottResetRateLimit();
	});

	it("should create a temporary room", () => {
		cy.visit(Cypress.config().baseUrl);
		cy.contains("Create Room").should("be.visible").click();
		cy.get(".v-menu")
			.contains(".v-list-item", "Create Temporary Room")
			.should("be.visible")
			.click();
		cy.wait(500);
		cy.location("pathname").should(path => {
			expect(path).to.include("room");
		});
		cy.get("h1")
			.contains("Temporary Room")
			.scrollIntoView()
			.should("be.visible")
			.should("have.text", "Temporary Room");
		cy.get("#connectStatus").should("have.text", "Connected");
	});

	it("should create a permanent room", () => {
		cy.visit(Cypress.config().baseUrl);
		cy.contains("Create Room").should("be.visible").click();
		cy.get(".v-menu")
			.contains(".v-list-item", "Create Permanent Room")
			.should("be.visible")
			.click();

		let roomName: string = uuid.v4().substring(0, 20);
		cy.get("form").find("input").first().type(roomName);
		cy.get("form").submit();

		cy.wait(500);
		cy.location("pathname").should(path => {
			expect(path).to.include("room");
		});
		cy.get("h1")
			.contains(roomName)
			.scrollIntoView()
			.should("be.visible")
			.should("have.text", roomName);
		cy.get("#connectStatus").should("have.text", "Connected");
	});

	it("should create a permanent room, unload it, and be able to load it back up", () => {
		cy.ottRequest({
			method: "POST",
			url: "/api/dev/set-admin-api-key",
			body: {
				newkey: Cypress.env("OTT_API_KEY"),
			},
		});
		cy.visit(Cypress.config().baseUrl);
		cy.contains("Create Room").should("be.visible").click();
		cy.get(".v-menu")
			.contains(".v-list-item", "Create Permanent Room")
			.should("be.visible")
			.click();

		let roomName: string = uuid.v4().substring(0, 20);
		cy.get("form").find("input").first().type(roomName);
		cy.get("form").submit();

		cy.visit(Cypress.config().baseUrl);
		cy.ottRequest({
			method: "DELETE",
			url: `/api/room/${roomName}`,
			headers: {
				apikey: Cypress.env("OTT_API_KEY"),
			},
		});

		cy.visit(`${Cypress.config().baseUrl}room/${roomName}`);
		cy.get("#connectStatus").should("have.text", "Connected");
	});

	describe("Room Ownership", () => {
		let userCreds = null;
		before(() => {
			cy.ottEnsureToken();
			cy.ottRequest({
				method: "POST",
				url: "/api/dev/reset-rate-limit/user",
			});
			userCreds = {
				email: faker.internet.email(),
				username: faker.internet.userName(),
				password: faker.internet.password(12),
			};
			cy.ottCreateUser(userCreds);
			cy.ottResetRateLimit();
		});

		beforeEach(() => {
			cy.clearCookies();
			cy.clearLocalStorage();
			cy.ottEnsureToken();
			cy.reload();
		});

		function createRoom() {
			cy.visit(Cypress.config().baseUrl);
			cy.contains("Create Room").click();
			cy.get(".v-menu").contains(".v-list-item", "Create Permanent Room").click();

			let roomName = uuid.v4().substring(0, 20);
			cy.get("form").find("input").first().type(roomName);
			cy.get("form").submit();

			cy.wait(500);
			cy.location("pathname").should(path => {
				expect(path).to.include("room");
			});
		}

		function checkPermissionsEditor() {
			cy.contains("Permissions Editor")
				.should("exist")
				.should("contain", "Viewing as: Owner");
		}

		it("should create a room then claim", () => {
			createRoom();
			cy.ottLogin(userCreds);
			cy.reload();

			cy.contains("Settings").click();
			cy.contains("button", "Claim Room").should("be.visible").click();
			cy.wait(200);
			cy.contains("button", "Save")
				.should("exist")
				.scrollIntoView()
				.should("be.visible")
				.should("not.be.disabled")
				.should("not.have.css", "pointer-events", "none");
			checkPermissionsEditor();
		});

		it("should create a room that is already claimed", () => {
			cy.ottLogin(userCreds);
			cy.reload();

			createRoom();
			cy.contains("Settings").click();
			cy.contains("button", "Save").should("exist").scrollIntoView().should("be.visible");
			cy.contains("button", "Claim Room").should("not.exist");

			cy.get(".user").should("have.class", "role-owner");
			checkPermissionsEditor();
		});
	});
});

import faker from "faker";
const uuid = require("uuid");

describe("promotion and demotion", () => {
	let roomName = "";
	let userCreds;
	let roles = [
		{
			id: 4,
			name: "admin",
			display: "Administrator",
		},
		{
			id: 3,
			name: "mod",
			display: "Moderator",
		},
		{
			id: 2,
			name: "trusted",
			display: "Trusted User",
		},
	];

	before(() => {
		cy.ottEnsureToken();
		userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(faker.name.firstName(), faker.name.lastName()),
			password: faker.internet.password(12),
		};
		cy.ottCreateUser(userCreds);
	});

	beforeEach(() => {
		cy.clearCookies();
		cy.clearLocalStorage();
		cy.ottEnsureToken();
		cy.ottResetRateLimit();
		cy.ottRequest({
			method: "POST",
			url: "/api/dev/reset-rate-limit/user",
		});
		cy.ottLogin(userCreds);
		roomName = uuid.v4().substring(0, 20);
		cy.ottRequest({
			method: "POST",
			url: "/api/room/create",
			body: { name: roomName, isTemporary: false },
		});
		cy.ottRequest({
			method: "POST",
			url: `/api/dev/room/${roomName}/add-fake-user`,
			body: { register: true },
		});
		cy.visit(`/room/${roomName}`, {
			timeout: 10000,
		});
	});

	for (let role of roles) {
		it(`should promote the given user to ${role.display}`, () => {
			cy.get(".user-actions", {
				timeout: 10000,
			}).click();
			cy.contains(`Promote to ${role.display}`).click();
			cy.get(`.role-${role.name}`).should("exist");
		});

		it(`should demote the given user from ${role.display}`, () => {
			cy.get(".user-actions", {
				timeout: 10000,
			}).click();
			cy.contains(`Promote to ${role.display}`).click();
			cy.get(`.role-${role.name}`).find("button").click();
			cy.contains("Demote to Registered User").click();
			cy.get(".role-registered").should("exist");
		});
	}
});

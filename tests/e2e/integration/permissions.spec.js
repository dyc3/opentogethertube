import faker from "faker";
import uuid from "uuid";

describe("promotion and demotion", () => {
	let roomName;
	let userCreds;
	let roles = [
		{
			"id": 4,
			"name": "admin",
			"display": "Administrator",
		},
		{
			"id": 3,
			"name": "mod",
			"display": "Moderator",
		},
		{
			"id": 2,
			"name": "trusted",
			"display": "Trusted User",
		},
	];

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
		cy.request("POST", "/api/dev/reset-rate-limit");
		cy.request("POST", "/api/user/login", userCreds);
		roomName = uuid.v4().substring(0, 20);
		cy.request("POST", "/api/room/create", { name: roomName, temporary: false });
		cy.visit(`/room/${roomName}`);
		cy.request("POST", `/api/dev/room/${roomName}/add-fake-user`, { register: true });
	});

	for (let role of roles) {
		it(`should promote the given user to ${role.display}`, () => {
			cy.get(".role-owner").should("exist").siblings(".role-registered").should("exist").find("button").click();
			cy.contains(`Promote to ${role.display}`).click();
			cy.get(`.role-${role.name}`).should("exist");
		});

		it(`should demote the given user from ${role.display}`, () => {
			cy.get(".role-owner").should("exist").siblings(".role-registered").should("exist").find("button").click();
			cy.contains(`Promote to ${role.display}`).click();
			cy.get(`.role-${role.name}`).find("button").click();
			cy.contains("Demote to Registered User").click();
			cy.get(".role-registered").should("exist");
		});
	}
});

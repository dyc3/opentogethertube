import faker from "faker";

describe("User login/registration", () => {
	beforeEach(() => {
		cy.clearCookies();
		cy.clearLocalStorage();
		cy.ottEnsureToken();
		cy.ottResetRateLimit();
		cy.ottRequest({
			method: "POST",
			url: "/api/dev/reset-rate-limit/user",
		});
		cy.visit("/");
	});

	it("should register a new user", () => {
		cy.contains("button", "Log In").click();
		cy.get('[role="tablist"]').contains(".v-tab", "Register").click();
		cy.wait(500);
		let username = faker.internet.userName();
		let password = faker.internet.password(10);
		cy.get("form").contains("Register").parent().contains("label", "Email").siblings("input").click().wait(250).type(faker.internet.email());
		cy.get("form").contains("Register").parent().contains("label", "Username").siblings("input").click().wait(250).type(username);
		cy.get("form").contains("Register").parent().contains("label", "Password").siblings("input").click().wait(250).type(password);
		cy.get("form").contains("Register").parent().contains("label", "Retype Password").siblings("input").click().wait(250).type(password);
		cy.get("form").contains("Register").parent().submit();
		cy.wait(500);
		cy.get("form").contains("Register").parent().should("not.be.visible");
		cy.contains("button", username).should("be.visible");
	});

	it("should log in an existing user", () => {
		// setup
		let userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		cy.ottCreateUser(userCreds);
		cy.clearCookies();
		cy.clearLocalStorage();
		cy.ottEnsureToken();

		// test
		cy.contains("button", "Log In").click();
		cy.get("form").contains("Log in").parent().contains("label", "Email").siblings("input").click().type(userCreds.email);
		cy.get("form").contains("Log in").parent().contains("label", "Password").siblings("input").click().type(userCreds.password);
		cy.get("form").contains("Log in").parent().submit();
		cy.wait(500);
		cy.get("form").contains("Log in").parent().should("not.be.visible");
		cy.contains("button", userCreds.username).should("be.visible");
	});

	it("should keep the user logged in when the page is refreshed", () => {
		// setup
		let userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		cy.ottCreateUser(userCreds);
		cy.clearCookies();
		cy.clearLocalStorage();
		cy.ottEnsureToken();

		// log in
		cy.contains("button", "Log In").click();
		cy.get("form").contains("Log in").parent().contains("label", "Email").siblings("input").click().type(userCreds.email);
		cy.get("form").contains("Log in").parent().contains("label", "Password").siblings("input").click().type(userCreds.password);
		cy.get("form").contains("Log in").parent().submit();
		cy.wait(500);
		cy.get("form").contains("Log in").parent().should("not.be.visible");
		cy.contains("button", userCreds.username).should("be.visible");

		// check if we stay logged in
		cy.visit("/");
		cy.contains("button", userCreds.username).should("be.visible");
	});
});

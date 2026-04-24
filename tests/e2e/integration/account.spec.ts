import faker from "faker";

describe("Account management", () => {
	function loginThroughUi(user: string, password: string) {
		cy.visit("/");
		cy.contains("button", "Log In").click();
		cy.get('[data-cy="login-user"]').click().type(user);
		cy.get('[data-cy="login-password"] input').type(password);
		cy.get('[data-cy="login-button"]').click();
	}

	function visitAccount() {
		cy.visit("/account");
		cy.contains("h1", "Account").should("be.visible");
	}

	beforeEach(() => {
		cy.clearCookies();
		cy.clearLocalStorage();
		cy.ottEnsureToken();
		cy.ottResetRateLimit();
		cy.ottRequest({
			method: "POST",
			url: "/api/dev/reset-rate-limit/user",
		});
	});

	it("should redirect logged out users away from the account page", () => {
		cy.visit("/account");
		cy.url().should("eq", `${Cypress.config().baseUrl}`);
		cy.get('[data-cy="user-logged-out"]').should("be.visible");
	});

	it("should let a password-only account add an email", () => {
		const userCreds = {
			email: "",
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		const newEmail = faker.internet.email();

		cy.ottCreateUser(userCreds);
		cy.ottLogin({ user: userCreds.username, password: userCreds.password });
		visitAccount();

		cy.get('[data-cy="account-email"] input').type(newEmail);
		cy.get('[data-cy="account-save-email"]').should("not.be.disabled").click();
		cy.get('[data-cy="account-email"] input').should("have.value", newEmail);
		cy.reload();
		cy.get('[data-cy="account-email"] input').should("have.value", newEmail);
		cy.ottRequest({ method: "GET", url: "/api/user/account" }).its("body").should("include", {
			email: newEmail,
			username: userCreds.username,
		});
	});

	it("should let an account with an email change it", () => {
		const userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		const nextEmail = faker.internet.email();

		cy.ottCreateUser(userCreds);
		cy.ottLogin({ user: userCreds.username, password: userCreds.password });
		visitAccount();

		cy.get('[data-cy="account-email"] input').clear().type(nextEmail);
		cy.get('[data-cy="account-save-email"]').should("not.be.disabled").click();
		cy.get('[data-cy="account-email"] input').should("have.value", nextEmail);
		cy.ottRequest({ method: "GET", url: "/api/user/account" }).its("body").should("include", {
			email: nextEmail,
			username: userCreds.username,
		});
	});

	it("should reject changing an email to one already in use", () => {
		const existingEmail = faker.internet.email();
		const firstUser = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		const secondUser = {
			email: existingEmail,
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};

		cy.ottCreateUser(firstUser);
		cy.ottCreateUser(secondUser);
		cy.ottLogin({ user: firstUser.username, password: firstUser.password });
		visitAccount();

		cy.get('[data-cy="account-email"] input').clear().type(existingEmail);
		cy.get('[data-cy="account-save-email"]').should("not.be.disabled").click();
		cy.contains("Email is already associated with an account.").should("be.visible");
		cy.ottRequest({ method: "GET", url: "/api/user/account" }).its("body").should("include", {
			email: firstUser.email,
			username: firstUser.username,
		});
	});

	it("should let a social-only account add email and password, then log in with username/password", () => {
		const username = faker.internet.userName();
		const email = faker.internet.email();
		const password = faker.internet.password(12);

		cy.ottCreateSocialUser({ username });
		cy.ottForceLogin(username);
		visitAccount();

		cy.get('[data-cy="account-current-password"]').should("not.exist");
		cy.get('[data-cy="account-email"] input').type(email);
		cy.get('[data-cy="account-save-email"]').should("not.be.disabled").click();
		cy.get('[data-cy="account-email"] input').should("have.value", email);

		cy.get('[data-cy="account-new-password"] input').type(password);
		cy.get('[data-cy="account-new-password-confirm"] input').type(password);
		cy.get('[data-cy="account-save-password"]').should("not.be.disabled").click();
		cy.reload();
		cy.get('[data-cy="account-current-password"] input').should("exist");
		cy.ottRequest({ method: "GET", url: "/api/user/account" }).its("body").should("include", {
			email,
			username,
			hasPassword: true,
		});

		cy.clearCookies();
		cy.clearLocalStorage();
		cy.ottEnsureToken();
		loginThroughUi(username, password);
		cy.get('[data-cy="user-logged-in"]').should("contain", username);
	});

	it("should reject the wrong current password before allowing a password change", () => {
		const userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		const nextPassword = faker.internet.password(14);

		cy.ottCreateUser(userCreds);
		cy.ottLogin({ user: userCreds.username, password: userCreds.password });
		visitAccount();

		cy.get('[data-cy="account-current-password"] input').type("definitely-wrong-password");
		cy.get('[data-cy="account-new-password"] input').type(nextPassword);
		cy.get('[data-cy="account-new-password-confirm"] input').type(nextPassword);
		cy.get('[data-cy="account-save-password"]').should("not.be.disabled").click();
		cy.contains("Current password is incorrect.").should("be.visible");
		cy.ottRequest({ method: "GET", url: "/api/user/account" }).its("body").should("include", {
			email: userCreds.email,
			username: userCreds.username,
			hasPassword: true,
		});

		cy.clearCookies();
		cy.clearLocalStorage();
		cy.ottEnsureToken();
		loginThroughUi(userCreds.username, userCreds.password);
		cy.get('[data-cy="user-logged-in"]').should("contain", userCreds.username);
	});

	it("should let a local account change its password", () => {
		const userCreds = {
			email: faker.internet.email(),
			username: faker.internet.userName(),
			password: faker.internet.password(12),
		};
		const nextPassword = faker.internet.password(14);

		cy.ottCreateUser(userCreds);
		cy.ottLogin({ user: userCreds.username, password: userCreds.password });
		visitAccount();

		cy.get('[data-cy="account-current-password"] input').type(userCreds.password);
		cy.get('[data-cy="account-new-password"] input').type(nextPassword);
		cy.get('[data-cy="account-new-password-confirm"] input').type(nextPassword);
		cy.get('[data-cy="account-save-password"]').should("not.be.disabled").click();

		cy.clearCookies();
		cy.clearLocalStorage();
		cy.ottEnsureToken();
		loginThroughUi(userCreds.username, userCreds.password);
		cy.get('[data-cy="user-logged-in"]').should("not.exist");

		cy.get('[data-cy="login-password"] input').clear().type(nextPassword);
		cy.get('[data-cy="login-button"]').click();
		cy.get('[data-cy="user-logged-in"]').should("contain", userCreds.username);
	});
});

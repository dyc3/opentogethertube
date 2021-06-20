// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })

Cypress.Commands.add("ottEnsureToken", () => {
	cy.request("/api/auth/grant").then(resp => {
		window.localStorage.setItem("token", resp.body.token);
	});
});

Cypress.Commands.add("ottCreateUser", userCreds => {
	cy.window().then(win => {
		cy.request({
			method: "POST",
			url: "/api/user/register",
			body: userCreds,
			headers: {
				Authorization: `Bearer ${win.localStorage.token}`,
			},
		}).then(resp => {
			cy.wrap(resp).its("isOkStatusCode").should("be.true");
			cy.wrap(resp).its("body").its("success").should("be.true");
		});
	});
});

Cypress.Commands.add("ottLogin", userCreds => {
	cy.window().then(win => {
		cy.request({
			method: "POST",
			url: "/api/user/login",
			body: userCreds,
			headers: {
				Authorization: `Bearer ${win.localStorage.token}`,
			},
		}).then(resp => {
			cy.wrap(resp).its("isOkStatusCode").should("be.true");
			cy.wrap(resp).its("body").its("success").should("be.true");
		});
	});
});

export {};

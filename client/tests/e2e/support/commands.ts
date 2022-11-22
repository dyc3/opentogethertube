/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
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
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

import { mount } from "cypress/vue";
import { h } from "vue";
import vuetify from "../../../src/plugins/vuetify";
import { key, buildNewStore } from "../../../src/store";
import { i18n } from "../../../src/i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import { routes } from "../../../src/router";
import { VueWrapper } from "@vue/test-utils";
import { OttRoomConnectionMock, connectionInjectKey } from "../../../src/plugins/connection";

Cypress.Commands.add("mount", (component, options = {}) => {
	options.global = options.global || {};
	options.global.plugins = options.global.plugins || [];
	options.global.plugins.push(vuetify);
	options.global.plugins.push([buildNewStore(), key]);
	options.global.plugins.push(i18n);
	let mockConnection = new OttRoomConnectionMock();
	cy.wrap(mockConnection).as("connection");
	options.global.plugins.push({
		install(app) {
			console.error("INSTALLING MOCK CONNECTION");
			app.provide(connectionInjectKey, mockConnection);
		},
	});

	// create router if one is not provided
	// @ts-expect-error
	if (!options.router) {
		// @ts-expect-error
		options.router = createRouter({
			routes: [],
			history: createMemoryHistory(),
		});
	}

	options.global.plugins.push({
		install(app) {
			// @ts-expect-error
			app.use(options.router);
		},
	});

	return mount(component, options).as("wrapper");
});

Cypress.Commands.add("vue", () => {
	return cy.get("@wrapper") as any;
});

/**
 * Update the props and wait for Vue to re-render.
 * Must be chained of a chain that starts with `cy.mount`.
 */
// @ts-ignore
Cypress.Commands.add("setProps", (props: Record<string, unknown> = {}) => {
	return cy.get("@wrapper").then(async (wrapper: any) => {
		// `wrapper` in inferred as JQuery<HTMLElement> since custom commands
		// generally receive a Cypress.Chainable as the first arg (the "subject").
		// the custom `mount` command defined above returns a
		// Test Utils' `VueWrapper`, so we need to cast this as `unknown` first.
		const vueWrapper = (wrapper.wrapper || Cypress.vueWrapper) as unknown as VueWrapper<any>;
		await vueWrapper.setProps(props);
		return vueWrapper;
	});
});

Cypress.Commands.add("emitted", (selector: string, event: string) => {
	return cy.get("@wrapper").then((wrapper: any) => {
		const vueWrapper = (wrapper.wrapper || Cypress.vueWrapper) as unknown as VueWrapper<any>;
		const cmp = wrapper.component;

		if (!cmp) {
			return [];
		}

		return cmp.emitted(event);
	}) as any;
});

Cypress.Commands.add("store", () => {
	return cy.get("@wrapper").then((w: any) => {
		const vueWrapper = (w.wrapper || Cypress.vueWrapper) as unknown as VueWrapper<any>;

		return vueWrapper.vm.$store;
	}) as any;
});

Cypress.Commands.add("connection", () => {
	return cy.get("@connection") as any;
});

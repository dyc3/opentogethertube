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
import { ComponentPublicInstance, h } from "vue";
import vuetify from "../../../src/plugins/vuetify";
import { key, buildNewStore } from "../../../src/store";
import { i18n } from "../../../src/i18n";
import { createMemoryHistory, createRouter } from "vue-router";
import { routes } from "../../../src/router";
import { VueWrapper } from "@vue/test-utils";
import { OttRoomConnectionMock, connectionInjectKey } from "../../../src/plugins/connection";
import { OttSfx, sfxInjectKey } from "../../../src/plugins/sfx";
import type { Role } from "ott-common";

Cypress.Commands.add("mount", (component, options = {}) => {
	options.global = options.global || {};
	options.global.plugins = options.global.plugins || [];
	options.global.plugins.push(vuetify);
	let store = buildNewStore();
	cy.wrap(store).as("store");
	options.global.plugins.push([store, key]);
	options.global.plugins.push(i18n);
	let mockConnection = new OttRoomConnectionMock();
	cy.wrap(mockConnection).as("connection");
	options.global.plugins.push({
		install(app) {
			app.provide(connectionInjectKey, mockConnection);
		},
	});

	// create router if one is not provided
	const router = createRouter({
		routes: routes,
		history: createMemoryHistory(),
	});
	cy.wrap(router).as("router");
	options.global.plugins.push(router);

	const sfx = new OttSfx();
	options.global.plugins.push({
		install(app) {
			app.provide(sfxInjectKey, sfx);
		},
	});

	// not sure why the cast to any is necessary, it worked with typescript 4.6.4
	return mount(component as any, options).as("wrapper");
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

Cypress.Commands.add("emitted", (event: string) => {
	return cy.get("@wrapper").then((wrapper: any) => {
		const vueWrapper = (wrapper.wrapper || Cypress.vueWrapper) as unknown as VueWrapper<any>;
		if (!vueWrapper) {
			return [];
		}

		return vueWrapper.emitted(event) || [];
	}) as any;
});

Cypress.Commands.add("store", () => {
	return cy.get("@store") as any;
});

Cypress.Commands.add("router", () => {
	return cy.get("@router") as any;
});

Cypress.Commands.add("connection", () => {
	return cy.get("@connection") as any;
});

Cypress.Commands.add("getPermissionCheckbox", (permission: string, role: Role) => {
	return cy.get(`[data-cy="perm-chk-${permission}-${role}"] input`) as any;
});

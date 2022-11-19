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
import { OttRoomConnectionPlugin } from "../../../src/plugins/connection";
import { createMemoryHistory, createRouter } from "vue-router";
import { routes } from "../../../src/router";
import { createVuetify } from "vuetify";
import { VApp } from "vuetify/lib/components/VApp/index";
import { createDefaults, DefaultsSymbol } from "vuetify/lib/composables/defaults";

Cypress.Commands.add("mount", (component, options = {}) => {
	options.global = options.global || {};
	options.global.plugins = options.global.plugins || [];
	// let vuetify = createVuetify();
	options.global.plugins.push(vuetify);
	options.global.plugins.push([buildNewStore(), key]);
	options.global.plugins.push(i18n);
	options.global.plugins.push(OttRoomConnectionPlugin);

	// create router if one is not provided
	// @ts-expect-error
	if (!options.router) {
		// @ts-expect-error
		options.router = createRouter({
			routes: routes,
			history: createMemoryHistory(),
		});
	}

	options.global.plugins.push({
		install(app) {
			// @ts-expect-error
			app.use(options.router);
		},
	});

	return mount(component, options);
});

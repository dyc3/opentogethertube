// ***********************************************************
// This example support/component.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import type { VueWrapper } from "@vue/test-utils";

// Import commands.js using ES2015 syntax:
import "./commands";
import "cypress-real-events";

// Alternatively you can use CommonJS syntax:
// require('./commands')

import { mount } from "cypress/vue";
import type { FullOTTStoreState } from "../../../src/store";
import type { Store } from "vuex";
import type { OttRoomConnectionMock } from "../../../src/plugins/connection";

// Augment the Cypress namespace to include type definitions for
// your custom command.
// Alternatively, can be defined in cypress/support/component.d.ts
// with a <reference path="./component" /> at the top of your spec.
declare global {
	namespace Cypress {
		interface Chainable {
			mount: typeof mount;
			vue(): Chainable<{ wrapper: VueWrapper<any>; component: unknown }>;
			setProps(
				props: Record<string, unknown>
			): Chainable<{ wrapper: VueWrapper<any>; component: unknown }>;
			emitted(selector: string, event: string): Chainable<unknown[]>;
			store(): Chainable<Store<FullOTTStoreState>>;
			connection(): Chainable<OttRoomConnectionMock>;
		}
	}
}

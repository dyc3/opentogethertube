// ***********************************************************
// This example support/index.js is processed and
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

// Import commands.js using ES2015 syntax:
import "./commands";
import "cypress-real-events";

// Alternatively you can use CommonJS syntax:
// require('./commands')

declare global {
	namespace Cypress {
		interface Chainable {
			ottEnsureToken(): Chainable<Element>;
			ottRequest(options: Partial<Cypress.RequestOptions>): Chainable<Element>;
			ottResetRateLimit(): Chainable<Element>;
			ottCreateUser(userCreds: any): Chainable<Element>;
			ottLogin(userCreds: any): Chainable<Element>;
			/**
			 * Helper function for moving a vue-slider component to a desired percentage.
			 * @param percent number between 0 and 1
			 */
			ottSliderMove(percent: number): Chainable<JQuery<HTMLElement>>;
			ottCloseToasts(): Chainable<Element>;
		}
	}
}

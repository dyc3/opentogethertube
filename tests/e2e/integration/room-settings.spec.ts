// import faker from "faker";
// import uuid from "uuid";
import { QueueMode, Visibility } from "../../../common/models/types";

describe("Room settings", () => {
	// let roomName;
	// let userCreds;

	// before(() => {
	// 	userCreds = {
	// 		email: faker.internet.email(),
	// 		username: faker.internet.userName(),
	// 		password: faker.internet.password(12),
	// 	};
	// 	cy.request("POST", "/api/user/register", userCreds);
	// });

	beforeEach(() => {
		cy.clearCookies();
		cy.clearLocalStorage();
		cy.ottEnsureToken();
		cy.ottResetRateLimit();
		// cy.request("POST", "/api/user/login", userCreds);
		// roomName = uuid.v4().substring(0, 20);
		// cy.request("POST", "/api/room/create", { name: roomName, temporary: false });
		// cy.visit(`/room/${roomName}`);
	});

	describe("Simple settings in temporary rooms", () => {
		beforeEach(() => {
			cy.ottRequest({
				method: "POST",
				url: "/api/room/generate",
			}).then(resp => {
				// @ts-expect-error
				cy.visit(`/room/${resp.body.room}`);
			});

			cy.contains("Settings").click();
			cy.contains("button", "Save")
				.should("exist")
				.scrollIntoView()
				.should("be.visible")
				.should("not.be.disabled")
				.should("not.have.css", "pointer-events", "none");
		});

		it("should apply title", () => {
			cy.get('[data-cy="input-title"] input').type("ligma");
			cy.contains("button", "Save")
				.should("exist")
				.should("be.visible")
				.should("not.be.disabled")
				.should("not.have.css", "pointer-events", "none")
				.click();
			cy.get(".room-title").scrollIntoView().should("have.text", "ligma");
		});

		it("should apply description", () => {
			cy.get('[data-cy="input-description"] input').type("sugma");
			cy.contains("button", "Save")
				.should("exist")
				.should("be.visible")
				.should("not.be.disabled")
				.should("not.have.css", "pointer-events", "none")
				.click();
		});

		it("should apply visibility", () => {
			cy.get("[data-cy=select-visibility]").click();
			cy.contains("Unlisted").click();
			cy.contains("button", "Save")
				.should("exist")
				.should("be.visible")
				.should("not.be.disabled")
				.should("not.have.css", "pointer-events", "none")
				.click();
		});

		it("should apply queue mode", () => {
			cy.get("[data-cy=select-queueMode]").click();
			cy.contains("Vote").click();
			cy.contains("button", "Save")
				.should("exist")
				.should("be.visible")
				.should("not.be.disabled")
				.should("not.have.css", "pointer-events", "none")
				.click();
		});

		afterEach(() => {
			cy.contains("Settings applied").should("be.visible");
		});
	});
});

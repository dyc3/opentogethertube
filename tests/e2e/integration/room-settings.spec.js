import faker from "faker";
import uuid from "uuid";
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
		cy.request("POST", "/api/dev/reset-rate-limit");
		// cy.request("POST", "/api/user/login", userCreds);
		// roomName = uuid.v4().substring(0, 20);
		// cy.request("POST", "/api/room/create", { name: roomName, temporary: false });
		// cy.visit(`/room/${roomName}`);
	});

	describe("Simple settings in temporary rooms", () => {
		beforeEach(() => {
			cy.request({
				method: "POST",
				url: "/api/room/generate",
			}).then(resp => {
				cy.visit(`/room/${resp.body.room}`);
			});

			cy.contains("Settings").click();
			cy.contains("button", "Save").scrollIntoView().should("be.visible").should("not.be.disabled").should("not.have.css", "pointer-events", "none");
		});

		it("should apply title", () => {
			cy.get(".room-settings").contains("label", "Title").siblings("input").click().type("ligma");
			cy.contains("button", "Save").click().should("be.visible").should("not.be.disabled").should("not.have.css", "pointer-events", "none");
			cy.get(".room-title").scrollIntoView().should("have.text", "ligma");
		});

		it("should apply description", () => {
			cy.get(".room-settings").contains("label", "Description").siblings("input").click().type("sugma");
			cy.contains("button", "Save").click().should("be.visible").should("not.be.disabled").should("not.have.css", "pointer-events", "none");
		});

		it("should apply visibility", () => {
			cy.get("[data-cy=select-visibility]").type(Visibility.Unlisted, { force: true }); // HACK: open the dropdown, since v-select doesn't actually use <select>
			cy.contains(Visibility.Unlisted).click();
			cy.contains("button", "Save").click().should("be.visible").should("not.be.disabled").should("not.have.css", "pointer-events", "none");
		});

		it("should apply queue mode", () => {
			cy.get("[data-cy=select-queueMode]").type(QueueMode.Vote, { force: true }); // HACK: open the dropdown, since v-select doesn't actually use <select>
			cy.contains(QueueMode.Vote).click();
			cy.contains("button", "Save").click().should("be.visible").should("not.be.disabled").should("not.have.css", "pointer-events", "none");
		});

		afterEach(() => {
			cy.contains("Settings applied").should("be.visible");
		});
	});
});

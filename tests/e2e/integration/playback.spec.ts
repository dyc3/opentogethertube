import "cypress-iframe";

describe("Video playback", () => {
	beforeEach(() => {
		cy.ottEnsureToken();
		cy.ottResetRateLimit();
		cy.ottRequest({ method: "POST", url: "/api/room/generate" }).then(resp => {
			// @ts-expect-error Cypress doesn't know how to respect this return type
			cy.visit(`/room/${resp.body.room}`);
		});
	});

	it("should add and play a video", () => {
		cy.contains("button", "Add a video").click();
		cy.get('[data-cy="add-preview-input"]').type("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
		cy.get(".video button").eq(1).click();
		cy.get("#ytcontainer").should("exist").scrollIntoView();
		cy.wait(500);
		cy.enter("#ytcontainer", { timeout: 15000 }).then(getBody => {
			getBody()
				.find("video")
				.should("exist")
				.should(element => {
					expect(element[0].paused).to.be.true;
				});
		});
		cy.get(".video-controls button").eq(1).click();
		cy.get("#ytcontainer").scrollIntoView();
		cy.enter("#ytcontainer", { timeout: 15000 }).then(getBody => {
			getBody()
				.find("video")
				.should("exist")
				.should(element => {
					expect(element[0].paused).to.be.false;
				});
		});
	});
});

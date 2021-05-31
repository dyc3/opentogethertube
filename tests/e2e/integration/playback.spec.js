import 'cypress-iframe';

describe("Video playback", () => {
	beforeEach(() => {
		cy.request("POST", "/api/dev/reset-rate-limit");
		cy.request("POST", "/api/room/generate").then(resp => {
			cy.visit(`/room/${resp.body.room}`);
		});
	});

	it("should add and play a video", () => {
		cy.contains("button", "Add a video").click();
		cy.get('.video-add input[type="text"]').type("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
		cy.get('.video button').click();
		cy.get("#ytcontainer").should("exist").scrollIntoView();
		cy.wait(500);
		cy.enter("#ytcontainer").then(getBody => {
			getBody().find("video").should("exist").should(element => {
				expect(element[0].paused).to.be.true;
			});
		});
		cy.get('.video-controls button').eq(1).click();
		cy.get("#ytcontainer").scrollIntoView();
		cy.enter("#ytcontainer").then(getBody => {
			getBody().find("video").should("exist").should(element => {
				expect(element[0].paused).to.be.false;
			});
		});
	});
});

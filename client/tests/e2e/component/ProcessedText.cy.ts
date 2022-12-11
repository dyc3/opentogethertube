import ProcessedText from "../../../src/components/ProcessedText.vue";

describe("<ProcessedText />", () => {
	it("should fire event when link is clicked", () => {
		cy.mount(ProcessedText, {
			props: {
				text: "https://youtu.be/1q2w3e4r5t6",
			},
		});

		cy.get("a").click();

		cy.emitted("link-click").should("have.length", 1);
	});
});

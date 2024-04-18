import ProcessedText from "../../../src/components/ProcessedText.vue";

describe("<ProcessedText />", () => {
	it("should render text as is", () => {
		cy.mount(ProcessedText, {
			props: {
				text: "foo",
			},
		});

		cy.get('[data-cy="processed-text"]').children().should("have.text", "foo");
	});

	it("should render just the link", () => {
		cy.mount(ProcessedText, {
			props: {
				text: "https://example.com/",
			},
		});

		cy.get("a").should("contain.text", "https://example.com/");
	});

	it("should render text and link", () => {
		cy.mount(ProcessedText, {
			props: {
				text: "peter https://example.com/ griffin",
			},
		});

		cy.get('[data-cy="processed-text"]').children().should("have.length", 3);
		cy.get('[data-cy="processed-text"]').children().eq(0).should("have.text", "peter ");
		cy.get('[data-cy="processed-text"]')
			.children()
			.eq(1)
			.should("contain.text", "https://example.com/");
		cy.get('[data-cy="processed-text"]').children().eq(2).should("have.text", " griffin");
	});

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

import { defineComponent, h } from "vue";
import { useStore } from "../../../src/store";
import AddPreview from "../../../src/components/AddPreview.vue";
import Norifier from "../../../src/components/Notifier.vue";

let page = defineComponent({
	setup() {
		const store = useStore();
		store.state.production = true;
		return {};
	},
	render() {
		return h("div", {}, [h(AddPreview), h(Norifier)]);
	},
});

describe("<AddPreview />", () => {
	it("should immediately make a single query if given a URL", () => {
		cy.intercept(
			"GET",
			"/api/data/previewAdd?input=https%3A%2F%2Fyoutube.com%2Fwatch%3Fv%3DLP8GRjv6AIo",
			{
				success: true,
				result: [
					{
						service: "youtube",
						id: "1",
						title: "Foo",
						description: "Bar",
						length: 100,
					},
				],
			}
		).as("previewAdd");
		cy.mount(page);

		cy.get('[data-cy="add-preview-input"]').click();

		cy.focused().type("https://youtube.com/watch?v=LP8GRjv6AIo");

		cy.wait("@previewAdd");

		cy.get(".video").should("be.visible").should("have.length", 1);
	});

	it("should not make a query if not given a URL until the user explicitly searches", () => {
		cy.intercept("GET", "/api/data/previewAdd?input=foo", {
			success: true,
			result: [
				{
					service: "youtube",
					id: "1",
					title: "Foo",
					description: "Bar",
					length: 100,
				},
			],
		}).as("previewAdd");
		cy.mount(page);

		cy.get('[data-cy="add-preview-input"]').click();

		cy.focused().type("foo");

		cy.get(".video").should("not.exist");

		cy.get('[data-cy="add-preview-manual-search"]').should("be.visible").click();

		cy.get(".video").should("be.visible").should("have.length", 1);
	});

	it("should not show test videos in prod environment", () => {
		cy.mount(page);

		cy.get('[data-cy="test-video"]').should("not.exist");
	});

	it.skip("should show test videos in dev environment", () => {
		let page = defineComponent({
			setup() {
				const store = useStore();
				store.state.production = true;
				return {};
			},
			render() {
				return h("div", {}, [h(AddPreview), h(Norifier)]);
			},
		});
		cy.mount(page);

		cy.get('[data-cy="test-video"]').should("be.visible").should("have.length.at.least", 1);
	});
});

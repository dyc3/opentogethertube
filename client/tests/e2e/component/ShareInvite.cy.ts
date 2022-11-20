import { defineComponent, h } from "vue";
import { useStore } from "../../../src/store";
import ShareInvite from "../../../src/components/ShareInvite.vue";
import { skipOn } from "@cypress/skip-test";

function assertValueInClipboard(value: string) {
	cy.window().then(win => {
		win.navigator.clipboard.readText().then(text => {
			expect(text).to.eq(value);
		});
	});
}

describe("<ShareInvite />", () => {
	it("renders full url without query params if there is no short url present", () => {
		let page = defineComponent({
			setup() {
				const store = useStore();
				store.state.room.name = "foobar";
				return {};
			},
			render() {
				return h(ShareInvite);
			},
		});
		cy.mount(page);
		cy.get('[data-cy="share-invite-link"] input').should("not.contain.text", "foobar");
	});

	it("renders with short url if present", () => {
		let page = defineComponent({
			setup() {
				const store = useStore();
				store.state.room.name = "foobar";
				store.state.shortUrl = "ottr.cc";
				return {};
			},
			render() {
				return h(ShareInvite);
			},
		});
		cy.mount(page);

		cy.get('[data-cy="share-invite-link"] input').should(
			"have.value",
			"https://ottr.cc/foobar"
		);
	});

	it("copies the link to the clipboard when the copy button is clicked", () => {
		// This test is a bit flakey because you must have the actual page in cypress test runner focused,
		// otherwise reading the clipboard will fail with "Document not focused".
		// See: https://github.com/cypress-io/cypress/issues/18198#issuecomment-1003756021
		// also important to note that this can't test the fallback copy method because all browsers cypress supports also support navigator.clipboard

		skipOn("firefox");

		let page = defineComponent({
			setup() {
				const store = useStore();
				store.state.room.name = "foobar";
				store.state.shortUrl = "ottr.cc";
				return {};
			},
			render() {
				return h(ShareInvite);
			},
		});
		cy.mount(page);

		cy.get('[data-cy="share-invite-link"] input').should(
			"have.value",
			"https://ottr.cc/foobar"
		);

		cy.get('[data-cy="share-invite-link"] [role="button"]').click();
		assertValueInClipboard("https://ottr.cc/foobar");
	});

	it("becomes success color when you click copy", () => {
		cy.clock();
		let page = defineComponent({
			setup() {
				const store = useStore();
				store.state.room.name = "foobar";
				store.state.shortUrl = "ottr.cc";
				return {};
			},
			render() {
				return h(ShareInvite);
			},
		});
		cy.mount(page);

		cy.get('[data-cy="share-invite-link"] input').focus();
		cy.get('[data-cy="share-invite-link"] [role="button"]').click();

		cy.get('[data-cy="share-invite-link"]').should("have.class", "text-success");

		cy.tick(3000);

		cy.get('[data-cy="share-invite-link"]').should("not.have.class", "text-success");

		cy.clock().invoke("restore");
	});
});

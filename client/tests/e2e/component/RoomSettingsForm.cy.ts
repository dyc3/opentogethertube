import { defineComponent, h } from "vue";
import RoomSettingsForm from "../../../src/components/RoomSettingsForm.vue";
import Norifier from "../../../src/components/Notifier.vue";
import { useStore } from "../../../src/store";
import { parseIntoGrantMask } from "ott-common/permissions";
import { Role } from "ott-common/models/types";

let page = defineComponent({
	setup() {
		const store = useStore();
		store.state.room.name = "foo";
		store.state.users.you = {
			id: "1",
			name: "bar",
			isLoggedIn: true,
			role: Role.Owner,
			isYou: true,
			grants: parseIntoGrantMask(["*"]),
		};
		return {};
	},
	render() {
		return h("div", {}, [h(RoomSettingsForm), h(Norifier)]);
	},
});

describe("<RoomSettingsForm />", () => {
	it("should make the submit container sticky", () => {
		cy.intercept("GET", "/api/room/foo", {
			fixture: "get-room-foo.json",
		});
		cy.mount(page);

		cy.get(".submit").should("have.css", "position", "sticky");
	});

	it("should fill the form with data from the API", () => {
		cy.intercept("GET", "/api/room/foo", {
			fixture: "get-room-foo.json",
		});
		cy.mount(page);

		cy.get('[data-cy="input-title"] input').should("have.value", "Foo");
		cy.get('[data-cy="input-description"] input').should("have.value", "Bar");
		cy.get('[data-cy="select-visibility"]').contains("Public");
		cy.get('[data-cy="select-queueMode"]').contains("DJ");
	});

	it("should submit modified values", () => {
		cy.intercept("GET", "/api/room/foo", {
			fixture: "get-room-foo.json",
		});
		cy.intercept("PATCH", "/api/room/foo", {
			fixture: "patch-room-foo.json",
		});
		cy.mount(page);

		cy.get('[data-cy="input-title"] input').clear().type("Baz");
		cy.get('[data-cy="save"]').click();
	});

	it("should disable inputs if the user does not have permission", () => {
		cy.intercept("GET", "/api/room/foo", {
			fixture: "get-room-foo.json",
		});
		let page = defineComponent({
			setup() {
				const store = useStore();
				store.state.room.name = "foo";
				store.state.users.you = {
					id: "1",
					name: "bar",
					isLoggedIn: false,
					role: Role.UnregisteredUser,
					isYou: true,
					grants: parseIntoGrantMask(["*"]) ^ parseIntoGrantMask(["configure-room"]),
				};
				return () =>
					h("div", {}, [
						h("div", {}, [`Grants: ${store.state.users.you.grants}`]),
						h(RoomSettingsForm),
						h(Norifier),
					]);
			},
		});

		cy.mount(page);

		cy.get('[data-cy="input-title"] input').should("be.disabled");
		cy.get('[data-cy="input-description"] input').should("be.disabled");
		cy.get('[data-cy="select-visibility"]').should("have.class", "v-input--disabled");
		cy.get('[data-cy="select-queueMode"]').should("have.class", "v-input--disabled");
		cy.get('[data-cy="input-auto-skip"] input').should("be.disabled");
	});
});

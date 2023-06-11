import { defineComponent, h } from "vue";
import RoomSettingsForm from "../../../src/components/RoomSettingsForm.vue";
import Notifier from "../../../src/components/Notifier.vue";
import { useStore } from "../../../src/store";
import { Grants, parseIntoGrantMask } from "ott-common/permissions";
import { PlayerStatus, Role, RoomUserInfo } from "ott-common/models/types";

let page = defineComponent({
	setup() {
		const store = useStore();
		store.state.room.name = "foo";
		store.state.users.users = new Map([
			[
				"1",
				{
					id: "1",
					name: "bar",
					isLoggedIn: true,
					role: Role.Owner,
					isYou: true,
					status: PlayerStatus.ready,
				},
			],
		]);
		store.state.users.you = {
			id: "1",
		};
		return {};
	},
	render() {
		return h("div", {}, [h(RoomSettingsForm), h(Notifier)]);
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
				store.state.room.grants = new Grants();
				store.state.room.grants.setRoleGrants(
					Role.UnregisteredUser,
					parseIntoGrantMask(["*"]) ^ parseIntoGrantMask(["configure-room"])
				);
				store.state.users.users = new Map([
					[
						"1",
						{
							id: "1",
							name: "bar",
							isLoggedIn: true,
							role: Role.UnregisteredUser,
							status: PlayerStatus.ready,
						},
					],
				]);
				store.state.users.you = {
					id: "1",
				};
				return () =>
					h("div", {}, [
						h("div", {}, [`Grants: ${store.getters["users/grants"]}`]),
						h(RoomSettingsForm),
						h(Notifier),
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

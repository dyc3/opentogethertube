import {
	ClientMessageRoomRequest,
	RoomRequestType,
	ServerMessage,
} from "ott-common/models/messages";
import { PlayerStatus, Role } from "ott-common/models/types";
import { defineComponent, h } from "vue";
import Chat from "../../../src/components/Chat.vue";

describe("<Chat />", () => {
	describe("open and close behavior", () => {
		it("opens (as a manual open) when you click the icon", () => {
			cy.mount(Chat);

			cy.get('[data-cy="chat-activate"]').should("be.visible").click();

			cy.get('[data-cy="chat-activate"]').should("not.exist");
			cy.get('[data-cy="chat-deactivate"]').should("be.visible");
			cy.get('[data-cy="chat-input"]').should("be.visible");

			// should remain open after unfocusing the input
			cy.focused().should("exist").blur();

			cy.get('[data-cy="chat-deactivate"]').should("be.visible");
			cy.get('[data-cy="chat-input"]').should("be.visible");
		});

		it("closes when you click the button", () => {
			cy.mount(Chat);

			cy.get('[data-cy="chat-activate"]').should("be.visible").click();

			cy.get('[data-cy="chat-deactivate"]').should("be.visible").click();

			cy.get('[data-cy="chat-activate"]').should("be.visible");
			cy.get('[data-cy="chat-deactivate"]').should("not.exist");
			cy.get('[data-cy="chat-input"]').should("not.exist");
		});

		it("closes when the input is focused and you hit escape", () => {
			cy.mount(Chat);

			cy.get('[data-cy="chat-activate"]').should("be.visible").click();

			cy.focused().should("exist").type("{esc}");

			cy.get('[data-cy="chat-activate"]').should("be.visible");
			cy.get('[data-cy="chat-deactivate"]').should("not.exist");
			cy.get('[data-cy="chat-input"]').should("not.exist");
		});

		it("closes when you type a message and send it", () => {
			cy.mount(Chat);

			cy.get('[data-cy="chat-activate"]').should("be.visible").click();

			cy.focused().should("exist").type("foo{enter}");

			cy.get('[data-cy="chat-activate"]').should("be.visible");
			cy.get('[data-cy="chat-deactivate"]').should("not.exist");
			cy.get('[data-cy="chat-input"]').should("not.exist");
		});

		it("should close if you unfocus the text box and if the button was not used to activate", () => {
			cy.mount(Chat).then(w => {
				w.wrapper.vm.setActivated(true, false);
			});

			cy.focused().should("exist").blur();

			cy.get('[data-cy="chat-activate"]').should("be.visible");
			cy.get('[data-cy="chat-deactivate"]').should("not.exist");
			cy.get('[data-cy="chat-input"]').should("not.exist");
		});
	});

	it("sends the message when you hit enter", () => {
		cy.mount(Chat);

		cy.get('[data-cy="chat-activate"]').should("be.visible").click();

		cy.focused().should("exist").type("foo{enter}");

		cy.connection().then(connection => {
			const expected: ClientMessageRoomRequest = {
				action: "req",
				request: {
					type: RoomRequestType.ChatRequest,
					text: "foo",
				},
			};
			expect(connection.sent).to.deep.equal([expected]);
		});
	});

	it("does not send the message if you hit escape", () => {
		cy.mount(Chat);

		cy.get('[data-cy="chat-activate"]').should("be.visible").click();

		cy.focused().should("exist").type("foo{esc}");

		cy.connection().then(connection => {
			expect(connection.sent).to.deep.equal([]);
		});
	});

	it("does not send the message if it's empty or all whitespace", () => {
		cy.mount(Chat);

		cy.get('[data-cy="chat-activate"]').should("be.visible").click();

		cy.focused().should("exist").type("{enter}");

		cy.connection().then(connection => {
			expect(connection.sent).to.deep.equal([]);
		});

		cy.get('[data-cy="chat-activate"]').should("be.visible").click();

		cy.focused().should("exist").type("   {enter}");

		cy.connection().then(connection => {
			expect(connection.sent).to.deep.equal([]);
		});
	});

	it("should display received messages", () => {
		cy.mount(Chat);

		cy.get('[data-cy="chat-activate"]').should("be.visible").click();

		const message: ServerMessage = {
			action: "chat",
			from: {
				id: "1",
				name: "goober",
				isLoggedIn: false,
				status: PlayerStatus.ready,
				role: Role.UnregisteredUser,
			},
			text: "foo",
		};

		cy.connection().then(connection => {
			connection.mockReceive(message);
		});

		cy.get(".messages").should("have.length", 1);
		cy.get(".from").contains("goober");
		cy.get(".text").contains("foo");
	});

	for (let activated of [false, true]) {
		it(`should automatically scroll to the bottom when receiving new messages (activated: ${activated})`, () => {
			let page = defineComponent({
				name: "Page",
				components: { Chat },
				setup() {},
				render() {
					return h(
						"div",
						{
							style: {
								position: "absolute",
								height: "400px",
								width: "300px",
							},
						},
						[h(Chat)]
					);
				},
			});
			cy.mount(page);

			if (activated) {
				cy.get('[data-cy="chat-activate"]').should("be.visible").click();
			}

			cy.connection().then(connection => {
				for (let i = 0; i < 30; i++) {
					const message: ServerMessage = {
						action: "chat",
						from: {
							id: "1",
							name: "goober",
							isLoggedIn: false,
							status: PlayerStatus.ready,
							role: Role.UnregisteredUser,
						},
						text: "foo " + i,
					};
					connection.mockReceive(message);
				}
			});

			cy.get(".message").should("have.length", 30);

			// HACK: the `be.visible` assertion does not work here, because
			// cypress does not include element scrolling in its visibility check
			// See: https://github.com/cypress-io/cypress/issues/877
			// So we have to manually check visibility ourselves
			cy.get(".messages").then(elems => {
				let msgs = elems[0];
				expect(msgs.scrollTop).to.be.greaterThan(0);
			});
			cy.get(".messages, .message:last-of-type").then(elems => {
				let msgs = elems[0];
				let last = elems[1];
				let boxRect = msgs.getBoundingClientRect();
				let msgRect = last.getBoundingClientRect();
				expect(msgRect.top).to.be.lessThan(boxRect.bottom);
				expect(msgRect.bottom).to.be.lessThan(boxRect.bottom);
			});
		});
	}
});

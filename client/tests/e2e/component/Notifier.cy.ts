import Notifier from "../../../src/components/Notifier.vue";
import { ToastStyle } from "../../../src/models/toast";

describe("<Notifier />", () => {
	beforeEach(() => {
		cy.clock();
	});

	afterEach(() => {
		cy.get("@wrapper").then((w: any) => {
			w.wrapper.vm.$store.state.toast.notifications = [];
		});
		cy.clock().invoke("restore");
	});

	it("renders a toast notification", () => {
		cy.mount(Notifier)
			.then(wrapper => {
				wrapper.wrapper.vm.$store.commit("toast/ADD_TOAST", { content: "test" });
			})
			.as("wrapper");

		cy.get(".toast").should("have.length", 1).should("be.visible");
	});

	it("renders a toast notification with a custom duration", () => {
		cy.mount(Notifier)
			.then(wrapper => {
				wrapper.wrapper.vm.$store.commit("toast/ADD_TOAST", {
					content: "test",
					duration: 1000,
				});
			})
			.as("wrapper");

		cy.get(".toast").should("have.length", 1).should("be.visible");

		cy.clock().tick(1000);

		cy.get(".toast").should("have.length", 0);
	});

	for (let [style, cssClass] of [
		[ToastStyle.Success, "bg-success"],
		[ToastStyle.Error, "bg-error"],
	]) {
		it(`renders a toast notification with ${style} style`, () => {
			cy.mount(Notifier)
				.then(wrapper => {
					wrapper.wrapper.vm.$store.commit("toast/ADD_TOAST", {
						content: "test",
						style: style,
					});
				})
				.as("wrapper");

			cy.get(".toast").should("have.length", 1).should("be.visible");
			cy.get(".toast").should("have.class", cssClass);
		});
	}

	it("should show a close all button if there is more than 1 toast", () => {
		cy.mount(Notifier)
			.then(wrapper => {
				wrapper.wrapper.vm.$store.commit("toast/ADD_TOAST", { content: "test" });
				wrapper.wrapper.vm.$store.commit("toast/ADD_TOAST", { content: "test" });
			})
			.as("wrapper");

		cy.get(".toast").should("have.length", 2).should("be.visible");

		cy.get('[data-cy="toast-close-all"]').should("be.visible").click();

		cy.get(".toast").should("have.length", 0);
	});
});

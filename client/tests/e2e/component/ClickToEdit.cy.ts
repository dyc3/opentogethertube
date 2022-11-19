import ClickToEdit from "../../../src/components/ClickToEdit.vue";

describe("<ClickToEdit />", () => {
	it("renders .editable", () => {
		cy.mount(ClickToEdit);

		cy.get(".editable").should("exist");
	});

	it("renders a string", () => {
		cy.mount(ClickToEdit, {
			props: {
				modelValue: "Hello World",
			},
		});

		cy.get(".editable").should("contain", "Hello World");
	});

	it("can edit a string", () => {
		const changeSpy = cy.spy().as("changeSpy");
		const updateModelValueSpy = cy.spy().as("updateModelValueSpy");
		cy.mount(ClickToEdit, {
			props: {
				"modelValue": "Hello World",
				"onChange": changeSpy,
				"onUpdate:modelValue": updateModelValueSpy,
			},
		});

		cy.get(".editable").click();

		cy.focused().clear().type("foo{enter}");

		cy.get("@changeSpy").should("have.been.calledWith", "foo");
		cy.get("@updateModelValueSpy").should("have.been.calledWith", "foo");
	});

	it("should not edit the value when escape is pressed or focus is lost", () => {
		const changeSpy = cy.spy().as("changeSpy");
		const updateModelValueSpy = cy.spy().as("updateModelValueSpy");
		cy.mount(ClickToEdit, {
			props: {
				"modelValue": "Hello World",
				"onChange": changeSpy,
				"onUpdate:modelValue": updateModelValueSpy,
			},
		});

		cy.get(".editable").click();

		cy.focused().clear().type("foo{esc}");

		cy.get(".editable").click();

		cy.focused().clear().type("foo").blur();

		cy.get("@changeSpy").should("not.have.been.called");
		cy.get("@updateModelValueSpy").should("not.have.been.called");
	});

	it("renders a number", () => {
		cy.mount(ClickToEdit, {
			props: {
				modelValue: 420,
			},
		});

		cy.get(".editable").should("contain", "420");
	});

	it("can edit a number", () => {
		const changeSpy = cy.spy().as("changeSpy");
		const updateModelValueSpy = cy.spy().as("updateModelValueSpy");
		cy.mount(ClickToEdit, {
			props: {
				"modelValue": 420,
				"onChange": changeSpy,
				"onUpdate:modelValue": updateModelValueSpy,
			},
		});

		cy.get(".editable").click();

		cy.focused().clear().type("123{enter}");

		cy.get("@changeSpy").should("have.been.calledWith", 123);
		cy.get("@updateModelValueSpy").should("have.been.calledWith", 123);
	});
});

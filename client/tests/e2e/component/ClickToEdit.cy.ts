import ClickToEdit from '../../../src/components/ClickToEdit.vue'

describe('<ClickToEdit />', () => {
	it('renders .editable', () => {
		cy.mount(ClickToEdit)

		cy.get(".editable").should("exist")
	})

	it('renders the model value', () => {
		cy.mount(ClickToEdit, {
			props: {
				modelValue: "Hello World"
			}
		})

		cy.get(".editable").should("contain", "Hello World")
	})

	it('can edit the value', () => {
		const changeSpy = cy.spy().as('changeSpy')
		const updateModelValueSpy = cy.spy().as('updateModelValueSpy')
		cy.mount(ClickToEdit, {
			props: {
				modelValue: "Hello World",
				onChange: changeSpy,
				"onUpdate:modelValue": updateModelValueSpy,
			}
		})

		cy.get(".editable").click()

		cy.focused().clear().type("foo\n")

		cy.get('@changeSpy').should('have.been.calledWith', "foo")
		cy.get('@updateModelValueSpy').should('have.been.calledWith', "foo")
	})
})
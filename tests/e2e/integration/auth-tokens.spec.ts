describe("Auth tokens", () => {
	beforeEach(() => {
		cy.clearCookies();
		cy.clearLocalStorage();
	});

	it("should request a new auth token on page load and save it to localstorage", () => {
		cy.window().then(win => {
			expect(win.localStorage.token).to.be.undefined;
		});
		cy.visit("/");
		cy.window().then(win => {
			expect(win.localStorage.token).to.not.be.undefined;
		});
	});
});

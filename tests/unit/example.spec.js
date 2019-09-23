describe('Example spec', () => {
  it('checks string concatination', () => {
    let s = "Hello ";
    s += "World!";
    expect(s).toMatch("Hello World!");
  });
});

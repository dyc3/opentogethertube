module.exports = {
  plugins: ["cypress"],
  env: {
    jest: false,
    mocha: true,
    "cypress/globals": true,
  },
  rules: {
    strict: "off",
    "jest/expect-expect": "off",
  },
};

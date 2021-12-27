module.exports = {
  env: {
    jest: true,
    browser: true,
  },
  plugins: ["jest"],
  rules: {
    'no-console': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    "@typescript-eslint/require-await": "off",
    "@typescript-eslint/no-floating-promises": "off",

    'jest/consistent-test-it': ["error", {"fn": "it"}],
    'jest/expect-expect': 'warn',
    'jest/no-duplicate-hooks': 'error',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/no-if': 'error',
    'jest/no-expect-resolves': 'error',
    'jest/no-export': 'error',
    'jest/no-standalone-expect': 'error',
    'jest/no-truthy-falsy': 'error',
    'jest/prefer-spy-on': 'error',
    'jest/require-top-level-describe': 'warn',
  },
};

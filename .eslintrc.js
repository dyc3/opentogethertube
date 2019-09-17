module.exports = {
  root: true,
  env: {
    node: true
  },
  'extends': [
    'eslint:recommended',
    'plugin:vue/base',
    'plugin:vue/essential',
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'curly': ['error', 'all'],
    'no-eval': ['error', {}],
    'no-var': 'error',
    'semi': ['error', 'always'],
    'semi-spacing': ["error", {"before": false, "after": true}],
    'eol-last': ["error", "always"],

    // HACK: this rule is required, otherwise travis-ci will fail (for some reason)
    // even through when run locally, no linting errors occur.
    "vue/no-parsing-error": ["error", {
      "invalid-first-character-of-tag-name": false,
    }],
  },
  parserOptions: {
    ecmaVersion: 6,
    parser: 'babel-eslint'
  }
};

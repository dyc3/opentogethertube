module.exports = {
  root: true,
  env: {
    node: true
  },
  plugins: [
    "jest",
  ],
  'extends': [
    'eslint:recommended',
    'plugin:vue/base',
    'plugin:vue/essential',
    "@vue/typescript/recommended",
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-debugger': 'error',
    'array-bracket-newline': ['error', { "multiline": true, "minItems": 3 }],
    'array-bracket-spacing': ['error', 'never'],
    'brace-style': ['error', 'stroustrup', { 'allowSingleLine': false }],
    'comma-dangle': ['error', {
      'arrays': 'always-multiline',
      'objects': 'always-multiline',
      'imports': 'never',
      'exports': 'always-multiline',
      'functions': 'never',
    }],
    'comma-spacing': ['error', {'before': false, 'after': true}],
    'curly': ['error', 'all'],
    'func-call-spacing': ['error', 'never'],
    'implicit-arrow-linebreak': ['error', 'beside'],
    'keyword-spacing': ['error', { 'before': true, 'after': true }],
    'no-eval': ['error', {}],
    'no-multiple-empty-lines': ['error', { 'max': 1, 'maxBOF': 0 }],
    'no-var': 'error',
    'no-dupe-keys': 'error',
    'no-prototype-builtins': 'error',
    'prefer-arrow-callback': 'error',
    'semi': ['error', 'always'],
    'semi-spacing': ["error", {"before": false, "after": true}],
    'space-before-blocks': ['error', 'always'],
    'eol-last': ["error", "always"],
    'eqeqeq': ["error", "always"],
    'no-unused-vars': process.env.NODE_ENV === 'production' ? 'error' : 'warn',

    // HACK: this rule is required, otherwise travis-ci will fail (for some reason)
    // even through when run locally, no linting errors occur.
    "vue/no-parsing-error": ["error", {
      "invalid-first-character-of-tag-name": false,
    }],

    'jest/consistent-test-it': ["error", {"fn": "it"}],
    'jest/expect-expect': 'warn',
    'jest/no-duplicate-hooks': 'error',
    'jest/no-focused-tests': 'error',
    'jest/no-identical-title': 'error',
    'jest/no-if': 'error',
    'jest/no-expect-resolves': 'error',
    'jest/no-export': 'error',
    'jest/no-standalone-expect': 'error',
    'jest/no-truthy-falsy': 'warn',
    'jest/prefer-spy-on': 'error',
    'jest/require-top-level-describe': 'warn',

    '@typescript-eslint/no-var-requires': 'warn',
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
  },
  overrides: [
    {
      files: ["*.js"],
      rules: {
        "@typescript-eslint/explicit-module-boundary-types": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-unused-vars": "off",
      }
    },
    {
      files: ["*.ts"],
      rules: {
        "no-unused-vars": "off",
      }
    },
    {
      files: ["migrations/**"],
      rules: {
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": "off",
      },
    },
  ]
};

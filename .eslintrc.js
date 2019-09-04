module.exports = {
  root: true,
  env: {
    node: true
  },
  'extends': [
    'plugin:vue/essential',
    'eslint:recommended'
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
  },
  parserOptions: {
    ecmaVersion: 6,
    parser: 'babel-eslint'
  }
};

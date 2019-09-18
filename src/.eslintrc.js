module.exports = {
  env: {
    node: true,
  },
  'extends': [
    'plugin:vue/base',
    'plugin:vue/essential',
  ],
  rules: {
    'vue/attribute-hyphenation': ['error', 'always'],
    'vue/html-self-closing': ['error', {
      'html': {
        'void': 'any',
        'normal': 'never',
        'component': 'always',
      },
      'svg': 'always',
    }],
    'vue/mustache-interpolation-spacing': ['error', 'always'],
    'vue/no-multi-spaces': ['warn', {
      'ignoreProperties': false,
    }],
    'vue/no-v-html': 'error',
    'vue/v-bind-style': ['error', 'shorthand'],
    'vue/v-on-style': ['error', 'shorthand'],
  },
  parserOptions: {
    ecmaVersion: 6,
    parser: 'babel-eslint'
  },
};

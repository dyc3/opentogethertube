module.exports = {
  env: {
    node: true,
    es6: true,
  },
  plugins: [
    "vue",
  ],
  'extends': [
    'plugin:vue/base',
    'plugin:vue/essential',
  ],
  rules: {
    'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
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
    ecmaVersion: "next",
    parser: 'babel-eslint',
    sourceType: "module",
  },
  ecmaFeatures: {
    modules: true,
  },
};

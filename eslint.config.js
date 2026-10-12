import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'output/**'] },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    files: ['extension/**/*.js'],
    languageOptions: { globals: { ...globals.browser, ...globals.serviceworker, ...globals.webextensions } },
  },
  {
    files: ['tests/**/*.js', 'scripts/**/*.js', '*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.webextensions } },
  },
];

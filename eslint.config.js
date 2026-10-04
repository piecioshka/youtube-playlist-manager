import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: [
      'dist/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'tmp/',
      '.superpowers/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Tylko kod Reacta: fixture Playwrighta ma parametr `use`, który reguła hooków bierze za hook
    files: ['src/**/*.{ts,tsx}'],
    ...reactHooks.configs.flat.recommended,
  },
  {
    files: ['src/**/*.tsx'],
    ...jsxA11y.flatConfigs.recommended,
  },
  {
    // Tabele na telefonie są siatką kart (`display: grid`), co zdejmuje z nich role natywne; jawne role je przywracają
    files: ['src/**/*.tsx'],
    rules: {
      'jsx-a11y/no-redundant-roles': 'off',
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'off',
    },
  },
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  prettier,
]);

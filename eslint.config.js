import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/generated/**', '**/coverage/**', 'services/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': ['warn', { allow: ['error', 'log'] }],
      // Native dialogs are banned in this project. Use the app's own alert components.
      'no-alert': 'error',
      'no-restricted-globals': [
        'error',
        { name: 'alert', message: 'Use the custom alert component.' },
        { name: 'confirm', message: 'Use the custom confirm dialog.' },
        { name: 'prompt', message: 'Use a custom input dialog.' },
      ],
    },
  },
);

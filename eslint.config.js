import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/dist-staging/**', '**/node_modules/**', '**/generated/**', '**/coverage/**', 'services/**', '**/.expo/**', 'apps/app/expo-env.d.ts'],
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
  {
    // The Expo app: browser and React Native globals, hooks rules, and require()
    // for bundled assets (images, sounds, video), which is how Metro loads them.
    files: ['apps/app/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
);

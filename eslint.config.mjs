// Flat ESLint config (ESLint 9). Applies to all TS in libs/services/apps.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.nx/**', '**/coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      // Money safety: discourage `any` leaking into financial code paths.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Migration/contract scripts run under ts-node as CLIs.
    files: ['libs/db/src/**/*.ts', 'libs/contracts/src/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);

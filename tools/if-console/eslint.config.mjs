// ESLint for the extension (0043-if-console FR-035): the recommended rules and the type-checked recommended rules of typescript-eslint, on
// the TypeScript of src/ and test/; the plain JavaScript that VS Code loads (test/vscode) and the build script get the plain rules.
import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  { ignores: ['dist/**', 'out/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: { parserOptions: { project: ['./tsconfig.json', './src/webview/tsconfig.json'], tsconfigRootDir: import.meta.dirname } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports', prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // The tests drive a stand-in for VS Code's API and replay recorded JSON, and load the code fresh under each stand-in. Their values are
    // typed `Loose` (an explicit `any`, named once in test/support) and their shapes are asserted at run time, so the rules that follow a value's
    // type through the code cannot say anything about them. The extension's own code (src/) keeps every rule.
    files: ['test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-floating-promises': 'off',   // node:test registers each test and awaits it itself
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
  { files: ['src/webview/**/*.ts'], languageOptions: { globals: globals.browser } },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }] },
  },
  { files: ['**/*.mjs'], languageOptions: { sourceType: 'module' } },
);

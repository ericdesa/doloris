import js from '@eslint/js';
import angular from 'angular-eslint';
import importPlugin from 'eslint-plugin-import-x';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['node_modules', 'dist', '.angular', 'coverage', 'tmp'],
  },

  // Dépendances circulaires
  {
    files: ['**/*.ts'],
    ...importPlugin.flatConfigs.typescript,
    rules: {
      'import-x/no-cycle': 'error',
    },
  },

  // Config TypeScript / Angular
  {
    files: ['**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
    extends: [js.configs.recommended, ...tseslint.configs.recommended, ...angular.configs.tsRecommended, prettier],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-class-suffix': ['warn', { suffixes: ['Component', 'Page', 'Dialog'] }],
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-require-imports': 'off',
      'no-irregular-whitespace': 'off',
      'no-async-promise-executor': 'off',
      'no-extra-boolean-cast': 'off',
      'no-debugger': 'off',
    },
  },

  // Config templates HTML Angular
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility, prettier],
    rules: {
      '@angular-eslint/template/click-events-have-key-events': 'off',
      '@angular-eslint/template/alt-text': 'off',
      '@angular-eslint/template/interactive-supports-focus': 'off',
      '@angular-eslint/template/label-has-associated-control': 'off',
      '@angular-eslint/template/elements-content': 'off',
      '@angular-eslint/template/no-call-expression': 'warn',
    },
  },
);

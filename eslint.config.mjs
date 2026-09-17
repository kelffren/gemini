import js from '@eslint/js';
import globals from 'globals';

const evergreenSources = [
  'scripts/evergreen-*.mjs',
  'src/core/evergreen-*.mjs',
  'src/creators/content/content-schema-migrations.mjs'
];

export default [
  {
    ignores: [
      'node_modules/**',
      'server/node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'artifacts/**',
      'vendor/**'
    ]
  },
  {
    ...js.configs.recommended,
    files: evergreenSources,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrors: 'none'}]
    }
  },
  {
    files: ['scripts/evergreen-*.mjs'],
    languageOptions: {
      globals: globals.node
    }
  }
];

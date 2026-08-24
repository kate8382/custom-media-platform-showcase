const prettierPlugin = require('eslint-plugin-prettier'); // Plugin to run Prettier as an ESLint rule
const prettierConfig = require('eslint-config-prettier/flat'); // Config to disable ESLint rules that conflict with Prettier (flat version)
const { defineConfig } = require('eslint/config'); // Importing the defineConfig function from ESLint's config module for better type support and configuration structure
// Note: avoid optional 'globals' package to keep devDependencies minimal

module.exports = defineConfig([
  {
    // Limit linting to our  source files only
    files: ['frontend/src/**/*.{js,jsx}'],
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '.github/**',
      '.vscode/**',
      'frontend/src/assets/video/**',
      'frontend/src/assets/audio/**',
      '.husky/**',
      '**/*.lock',
      '**/*.yml',
      '**/*.png',
      '**/*.jpg',
      '**/*.jpeg',
      '**/*.gif',
      '**/*.ico',
      '**/*.svg',
      '**/*.webp',
      '**/*.woff',
      '**/*.woff2',
      '**/*.ttf',
      '**/*.eot',
      '**/*.otf',
      '**/*.zip',
      '**/*.pdf',
      '**/*.bin'
    ]
  },
  {
    files: ['frontend/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    },

    plugins: { prettier: prettierPlugin },
    rules: {
      'no-console': 'off', // Allow console statements for debugging
      'func-names': 'off', // Allow unnamed functions for flexibility
      'spaced-comment': ['error', 'always'], // Enforce spacing after comment markers
      'no-inline-comments': 'off', // Allow inline comments for clarity
      'multiline-comment-style': 'off', // Allow any style of multiline comments
      // Prettier controls quote style; disable ESLint's quote rule
      quotes: 'off', // Disable ESLint's quote rule
      semi: ['error', 'always'], // Enforce semicolons at the end of statements
      'no-unused-vars': ['warn'], // Warn about unused variables to keep code clean
      indent: ['error', 2], // Enforce consistent indentation of 2 spaces
      'no-var': 'error', // Disallow var, use let or const instead
      'linebreak-style': ['error', 'unix'], // Enforce Unix linebreaks for cross-platform consistency
      'keyword-spacing': ['error', { before: true, after: true }], // Enforce spacing around keywords for readability
      'no-restricted-globals': 'off', // Allow all global variables
      'no-alert': 'off', // Allow alert for simple debugging purposes
      'no-plusplus': 'off', // Allow ++ operator for incrementing values
      'max-len': 'off', // Disable max line length to allow flexibility in code formatting
      'no-param-reassign': ['off'], // Allow reassignment of function parameters
      'prefer-const': 'off', // Allow let even when variables are not reassigned
      'no-undef': 'off', // Allow usage of undefined variables
      'no-restricted-syntax': 'off', // Allow all syntax
      'import/no-extraneous-dependencies': 'off', // Allow importing devDependencies
      'prettier/prettier': ['warn', { singleQuote: true, endOfLine: 'auto' }] // Prettier: use single quotes and auto-detect line endings
    }
  },
  // Prettier config should be last to disable conflicting ESLint rules
  prettierConfig
]);

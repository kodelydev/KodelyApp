module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // Add any specific rules here
    '@typescript-eslint/no-unused-vars': ['warn', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_' 
    }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': 'off', // Allow console for extension development
  },
  env: {
    node: true,
    es6: true,
  },
  ignorePatterns: [
    'out',
    'dist',
    '**/*.d.ts',
    'node_modules',
    '.vscode-test',
  ],
};

module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:o1js/recommended',
    'next',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'o1js'],
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off', 

    '@typescript-eslint/no-explicit-any': 'off', 
    'react-hooks/exhaustive-deps': 'warn', 
    'no-irregular-whitespace': 'warn', 
    'prefer-const': 'warn', 
  },
};
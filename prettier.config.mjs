/** @type {import('prettier').Config} */
export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  overrides: [
    {
      files: '*.md',
      // Avoid reflowing long spec docs unless we opt in later
      options: { proseWrap: 'preserve' },
    },
  ],
};

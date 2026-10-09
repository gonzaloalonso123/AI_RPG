import ts from "typescript-eslint";
export default ts.config(
  {
    ignores: [
      "**/lib/**",
      "**/dist/**",
      "**/node_modules/**",
      "playwright-report/**",
    ],
  },
  ...ts.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
);

// eslint.config.mjs
import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";
import securityPlugin from "eslint-plugin-security";
import prettierPlugin from "eslint-plugin-prettier";

export default [
  js.configs.recommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: ["*.config.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ["./tsconfig.json"],
        sourceType: "module",
      },
      globals: {
        fetch: "readonly",
        process: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        NodeJS: "readonly",
        __dirname: "readonly",
        Buffer: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin,
      security: securityPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...securityPlugin.configs.recommended.rules,
      ...tsPlugin.configs["recommended-requiring-type-checking"].rules,
      "prettier/prettier": "error",
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unnecessary-type-assertion": "warn",
      "@typescript-eslint/no-unnecessary-condition": "warn",
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/prefer-nullish-coalescing": "warn",
      "@typescript-eslint/prefer-optional-chain": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-console": "warn",
      "import/order": [
        "warn",
        {
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
        },
      ],
    },
  },
];

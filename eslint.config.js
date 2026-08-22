import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Architecture guard: Gradr stays on Vite + React Router.
      // React Router, React Query and TanStack Table remain allowed.
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@tanstack/start",
                "@tanstack/start/*",
                "@tanstack/start-*",
                "@tanstack/react-start",
                "@tanstack/react-start/*",
                "@tanstack/react-router",
                "@tanstack/react-router/*",
                "@tanstack/router",
                "@tanstack/router/*",
              ],
              message:
                "TanStack Start / TanStack Router are not allowed in Gradr. Use react-router-dom — see README 'Architecture boundaries'.",
            },
          ],
        },
      ],
      // Design system guard: colors must come from semantic tokens, never literals.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(className|class)$/] > Literal[value=/#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?)\\(/]",
          message:
            "Hardcoded colors are not allowed. Use a Gradr semantic token (bg-primary, text-muted-foreground, border-border, …).",
        },
        {
          selector:
            "JSXAttribute[name.name=/^(className|class)$/] JSXExpressionContainer Literal[value=/#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?)\\(/]",
          message:
            "Hardcoded colors are not allowed. Use a Gradr semantic token (bg-primary, text-muted-foreground, border-border, …).",
        },
        {
          selector:
            "JSXAttribute[name.name='style'] Property[key.name=/[Cc]olor$|^fill$|^stroke$|^background$/] > Literal[value=/^\\s*(#|rgb|hsl)/]",
          message:
            "Inline color literals are not allowed. Use a Gradr semantic token or CSS variable (var(--primary)).",
        },
      ],
    },

  },
  {
    // Token sources, generated artifacts and design-system vendor code define the literals.
    files: [
      "src/design-system/**",
      "src/styles/**",
      "scripts/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
);

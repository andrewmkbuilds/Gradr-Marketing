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
      // Values that resolve a CSS custom property (hsl(var(--primary))) are fine.
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "JSXAttribute[name.name=/^(className|class)$/] Literal[value=/^(?!.*var\\(--)(?=[\\s\\S]*(#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?)\\(\\s*[0-9.]))/]",
          message:
            "Hardcoded color in a class name. Replace it with a Gradr semantic token: " +
            "surfaces bg-background / bg-surface / bg-surface-muted, text text-foreground / text-muted-foreground, " +
            "brand bg-primary / text-primary / bg-accent, lines border-border, focus ring-ring, errors text-destructive. " +
            "Full list: .lovable/rules/libraries/gradr-9b9b95/design-tokens.md — live preview at /design-system.",
        },
        {
          selector:
            "JSXAttribute[name.name='style'] Property[key.name=/[Cc]olor$|^fill$|^stroke$|^background$|^backgroundImage$/] > Literal[value=/^(?!.*var\\(--)(?=[\\s\\S]*(#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?)\\(\\s*[0-9.]))/]",
          message:
            "Inline color literal in a style prop. Use a Gradr semantic token class (bg-primary, text-muted-foreground, border-border) " +
            "or reference the variable directly (hsl(var(--primary))). " +
            "Full list: .lovable/rules/libraries/gradr-9b9b95/design-tokens.md — live preview at /design-system.",
        },
      ],
    },

  },
  {
    // Token sources, generated artifacts and design-system vendor code define the literals.
    files: [
      "src/design-system/**",
      "src/components/ui/chart.tsx",
      "src/styles/**",
      "scripts/**",
      "**/*.test.ts",
      "**/*.test.tsx",
    ],
    rules: { "no-restricted-syntax": "off" },
  },
);

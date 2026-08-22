/**
 * CI color gate: enforces only the hardcoded-color rule, so the blocking PR
 * check fails on design-system violations and nothing else.
 *
 *   bun run lint:colors
 */
import tseslint from "typescript-eslint";
import { colorRuleExemptions, noHardcodedColorSyntax } from "./eslint-rules/no-hardcoded-colors.js";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "supabase/functions/**"] },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { parser: tseslint.parser, ecmaVersion: 2022, sourceType: "module" },
    rules: { "no-restricted-syntax": ["error", ...noHardcodedColorSyntax] },
  },
  {
    files: colorRuleExemptions,
    rules: { "no-restricted-syntax": "off" },
  },
);

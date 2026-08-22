/**
 * Shared "no hardcoded colors" guard.
 *
 * Used by the main eslint config and by the CI-only color config
 * (eslint.colors.config.js), so the PR gate and local linting enforce exactly
 * the same rule with the same developer-facing message.
 */
const TOKEN_HINT =
  "Use a Gradr semantic token instead: surfaces bg-background / bg-surface / bg-surface-muted, " +
  "text text-foreground / text-muted-foreground, brand bg-primary / text-primary / bg-accent, " +
  "lines border-border, focus ring-ring, errors text-destructive. " +
  "Full list: .lovable/rules/libraries/gradr-9b9b95/design-tokens.md — live preview at /design-system.";

export const noHardcodedColorSyntax = [
  {
    selector:
      "JSXAttribute[name.name=/^(className|class)$/] Literal[value=/^(?!.*var\\(--)(?=[\\s\\S]*(#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?)\\(\\s*[0-9.]))/]",
    message: `Hardcoded color in a class name. ${TOKEN_HINT}`,
  },
  {
    selector:
      "JSXAttribute[name.name='style'] Property[key.name=/[Cc]olor$|^fill$|^stroke$|^background$|^backgroundImage$/] > Literal[value=/^(?!.*var\\(--)(?=[\\s\\S]*(#[0-9a-fA-F]{3,8}\\b|\\b(rgba?|hsla?)\\(\\s*[0-9.]))/]",
    message: `Inline color literal in a style prop. ${TOKEN_HINT} Or reference the variable directly: hsl(var(--primary)).`,
  },
];

/** Files that legitimately define or generate raw color values. */
export const colorRuleExemptions = [
  "src/design-system/**",
  "src/components/ui/chart.tsx",
  "src/styles/**",
  "scripts/**",
  "**/*.test.ts",
  "**/*.test.tsx",
];

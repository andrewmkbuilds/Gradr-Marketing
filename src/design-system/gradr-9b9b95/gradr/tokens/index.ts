import tokens from "./tokens.json";
import { baseTokens, semanticTokens, tokenCategories } from "./tokens.gen";

export { baseTokens, semanticTokens, tokenCategories };
export type {
  BaseTokenName,
  SemanticTokenName,
  GradrTokenName,
  ThemeName,
  TokenCategory,
} from "./tokens.gen";

import type { BaseTokenName, GradrTokenName, SemanticTokenName, ThemeName } from "./tokens.gen";

export type TokenMap = Record<string, string>;

export interface GradrTokens {
  base: {
    color: TokenMap;
    typography: TokenMap;
    radius: TokenMap;
    shadow: TokenMap;
    other: TokenMap;
  };
  semantic: { light: TokenMap; dark: TokenMap };
}

/** Structured Gradr tokens, generated from the canonical theme.css. */
export const gradrTokens = tokens as unknown as GradrTokens;

/**
 * Resolve any token's value for a theme, with autocomplete on the name:
 * `token("--primary", "dark")`.
 */
export function token(name: GradrTokenName, theme: ThemeName = "light"): string {
  const scoped = semanticTokens[theme] as Record<string, string>;
  return scoped[name] ?? (baseTokens as Record<string, string>)[name];
}

/** The CSS `var()` reference for a token, e.g. `cssVar("--primary")`. */
export function cssVar(name: GradrTokenName): string {
  return `var(${name})`;
}

export type { BaseTokenName as GradrBaseTokenName, SemanticTokenName as GradrSemanticTokenName };
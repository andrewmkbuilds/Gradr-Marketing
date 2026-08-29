/**
 * Official Gradr social profiles. Keep this list in sync with the
 * Organization schema `sameAs` in src/lib/structuredData.ts.
 */
export const INSTAGRAM_URL = "https://www.instagram.com/gradr.me";
export const DISCORD_URL = "https://discord.gg/uujhVW5f";

export const SOCIAL_PROFILES = [
  { label: "Instagram", href: INSTAGRAM_URL },
  { label: "Discord", href: DISCORD_URL },
] as const;

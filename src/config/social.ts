/**
 * Official Gradr social profiles. Keep this list in sync with the
 * Organization schema `sameAs` in src/lib/structuredData.ts.
 */
export const INSTAGRAM_URL = "https://www.instagram.com/gradr.me/";
export const X_URL = "https://x.com/gradr_me";
export const FACEBOOK_URL = "https://www.facebook.com/gradr.me/";
export const YOUTUBE_URL = "https://www.youtube.com/@gradr-me";
export const DISCORD_URL = "https://discord.gg/uujhVW5f";

export const SOCIAL_PROFILES = [
  { label: "Instagram", href: INSTAGRAM_URL },
  { label: "X", href: X_URL },
  { label: "Facebook", href: FACEBOOK_URL },
  { label: "YouTube", href: YOUTUBE_URL },
  { label: "Discord", href: DISCORD_URL },
] as const;

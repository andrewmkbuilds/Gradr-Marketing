import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Gradr's custom `--text-*` roles are font sizes, not colours. Without this
 *  they land in the text-color group and get dropped next to `text-foreground`. */
const fontSizes = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "body-lg", "body", "body-sm",
  "caption", "overline", "button", "code",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...fontSizes] }],
      "text-color": [
        { text: ["foreground", "muted-foreground", "primary", "primary-foreground", "accent", "accent-foreground", "destructive", "destructive-foreground"] },
      ],
    },
  },
});

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
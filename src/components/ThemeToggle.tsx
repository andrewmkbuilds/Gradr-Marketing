import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/design-system/gradr-9b9b95";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme, type ThemePreference } from "@/hooks/useTheme";
import { useReducedMotionPref } from "@/hooks/useMotionPreference";
import { springSnappy } from "@/lib/motion/tokens";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/**
 * Icon-button theme switcher for headers and navigation bars.
 * Click flips light/dark; the menu exposes the explicit System option.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const reduced = useReducedMotionPref();
  const iconKey = resolvedTheme === "dark" ? "moon" : "sun";
  const Icon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Theme: ${theme}. Change theme`}
          className={cn("interactive press-scale min-h-11 min-w-11", className)}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={iconKey}
              initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.5 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.5 }}
              transition={reduced ? { duration: 0.14 } : springSnappy}
              className="grid place-items-center"
            >
              <Icon className="size-5" aria-hidden="true" />
            </motion.span>
          </AnimatePresence>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
          {OPTIONS.map(({ value, label, icon: OptionIcon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="gap-2 text-sm">
              <OptionIcon className="h-4 w-4" aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Full-width segmented control used inside Settings, where the choice
 * deserves to be visible rather than hidden behind a menu.
 */
export function ThemeSegmentedControl({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className={cn("inline-flex w-full max-w-sm rounded-lg border border-border bg-surface-secondary p-1", className)}
    >
      {OPTIONS.map(({ value, label, icon: OptionIcon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "interactive press-scale flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
              active
                ? "bg-surface text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <OptionIcon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ALL_OFF,
  ALL_ON,
  CONSENT_CATEGORIES,
  type ConsentChoices,
  hasGlobalPrivacyControl,
  readConsent,
  writeConsent,
} from "@/lib/cookieConsent";
import { isKnownChildDevice } from "@/lib/compliance/coppa";

/** Opens the preferences dialog from anywhere (footer link, cookie policy page). */
export function openCookiePreferences() {
  window.dispatchEvent(new CustomEvent("gradr:consent-open"));
}

/**
 * GDPR-style consent banner.
 *
 * Nothing optional runs until the visitor chooses. Strictly necessary cookies
 * are always on and are shown as a locked row rather than a toggle. A Global
 * Privacy Control signal is auto-honoured as "reject optional".
 */
export function CookieConsent() {
  const [decided, setDecided] = useState(() => readConsent() !== null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [choices, setChoices] = useState<ConsentChoices>(() => readConsent()?.choices ?? ALL_OFF);

  useEffect(() => {
    // COPPA: a device that declared an age under 13 never gets the optional
    // categories offered to it — everything optional stays off, no prompt.
    if (!decided && isKnownChildDevice()) {
      writeConsent(ALL_OFF);
      setDecided(true);
      return;
    }
    // Honour GPC without prompting.
    if (!decided && hasGlobalPrivacyControl()) {
      writeConsent(ALL_OFF);
      setDecided(true);
    }
  }, [decided]);

  useEffect(() => {
    const open = () => {
      setChoices(readConsent()?.choices ?? ALL_OFF);
      setDialogOpen(true);
    };
    window.addEventListener("gradr:consent-open", open);
    return () => window.removeEventListener("gradr:consent-open", open);
  }, []);

  const save = useCallback((next: ConsentChoices) => {
    writeConsent(next);
    setChoices(next);
    setDecided(true);
    setDialogOpen(false);
  }, []);

  return (
    <>
      {!decided && (
        <div
          role="region"
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-[60] p-3 sm:p-4"
        >
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-border/70 bg-card/95 p-4 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-start gap-3">
              <Cookie className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                We use strictly necessary cookies to keep you signed in. With your consent we also use
                analytics, attribution and functional cookies to improve Gradr.{" "}
                <Link to="/cookie-policy" className="font-medium text-primary underline-offset-4 hover:underline">
                  Cookie Policy
                </Link>
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button variant="ghost" size="sm" onClick={() => save(ALL_OFF)}>
                Reject optional
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setChoices(ALL_OFF);
                  setDialogOpen(true);
                }}
              >
                Customize
              </Button>
              <Button size="sm" onClick={() => save(ALL_ON)}>
                Accept all
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Choose what Gradr may store on this device. Saved for 12 months and changeable any time.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-foreground">Strictly necessary</p>
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Always on
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Sign-in sessions, checkout security, theme and your cookie choice. Required for Gradr to work.
              </p>
            </div>

            {CONSENT_CATEGORIES.map((category) => (
              <div key={category.id} className="rounded-lg border border-border/60 p-3">
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor={`consent-${category.id}`} className="text-sm font-medium text-foreground">
                    {category.label}
                  </label>
                  <Switch
                    id={`consent-${category.id}`}
                    checked={choices[category.id]}
                    onCheckedChange={(value) => setChoices((prev) => ({ ...prev, [category.id]: value }))}
                    aria-describedby={`consent-${category.id}-description`}
                  />
                </div>
                <p id={`consent-${category.id}-description`} className="mt-1 text-xs text-muted-foreground">
                  {category.description}
                </p>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="ghost" onClick={() => save(ALL_OFF)}>
              Reject optional
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => save(ALL_ON)}>
                Accept all
              </Button>
              <Button onClick={() => save(choices)}>Save preferences</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Footer / cookie-policy entry point into the preferences dialog. */
export function CookiePreferencesButton({ className }: { className?: string }) {
  return (
    <Button variant="outline" size="sm" className={className} onClick={openCookiePreferences}>
      <Cookie className="mr-2 h-4 w-4" aria-hidden="true" />
      Cookie preferences
    </Button>
  );
}

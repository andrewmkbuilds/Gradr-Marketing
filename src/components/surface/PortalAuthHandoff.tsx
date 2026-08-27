import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { appLoginHref, appSignupHref } from "@/lib/appLinks";
import { handoffToApp } from "@/lib/authHandoff";

type Mode = "login" | "signup" | "reset";

/**
 * Sign-in hand-off for the public portals in this project.
 *
 * No credential form, OAuth request or password-reset flow may run on a public
 * host: authentication happens on app.gradr.me and the session is established
 * there. The destination the visitor was heading for is preserved through
 * `?next=`, so a partner asked to sign in for /resources comes back to it.
 */
export function PortalAuthHandoff({ mode = "login" }: { mode?: Mode }) {
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next") ?? undefined;
  const href =
    mode === "signup"
      ? appSignupHref(next)
      : mode === "reset"
        ? appLoginHref(next).replace("/auth", "/auth?mode=reset").replace("?mode=reset?", "?mode=reset&")
        : appLoginHref(next);

  useEffect(() => {
    handoffToApp(href, { source: "portal_auth", mode });
  }, [href, mode]);

  return (
    <div className="page-shell section-y flex flex-col items-center gap-4 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">
        Taking you to Gradr sign-in…{" "}
        <a className="underline underline-offset-4" href={href}>
          Continue
        </a>
      </p>
    </div>
  );
}

export default PortalAuthHandoff;

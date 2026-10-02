import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { SpatialLoader } from "@/components/three-d";
import { appLoginHref, appResetHref, appSignupHref } from "@/lib/appLinks";
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
    mode === "signup" ? appSignupHref(next) : mode === "reset" ? appResetHref(next) : appLoginHref(next);

  useEffect(() => {
    handoffToApp(href, { location: `portal_auth_${mode}`, next });
  }, [href, mode, next]);

  return (
    <div className="page-shell section-y flex flex-col items-center gap-4 text-center">
      <SpatialLoader size={28} />
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

import { useEffect, useState } from "react";
import { markSignupIntent } from "@/lib/telemetry/signup";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { urlFor } from "@/config/domains";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { Button, FormField, Input } from "@/design-system/gradr-9b9b95";
import { AuthLayout } from "@/components/AuthLayout";
import { ArrowRight, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import {
  authCallbackUrl,
  consumeAuthCallbackError,
  readNext,
} from "@/lib/nextRedirect";
import { EXPECTED_CALLBACK_URL, recordOAuthHop } from "@/lib/oauth/forensics";
import { OAuthHostMismatchNotice } from "@/components/auth/OAuthHostMismatchNotice";
import { toast } from "sonner";
import { reportAuthFailure } from "@/lib/monitoring/reliability";
import { AgeBlockedNotice, AgeGate } from "@/components/auth/AgeGate";
import { clearAgeGate, isKnownChildDevice, readAgeGate } from "@/lib/compliance/coppa";
import { z } from "zod";
import { emailSchema, friendlyAuthError } from "@/lib/authErrors";

/** Client-side field validation — mirrors the server rules, fails fast and inline. */
const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters.")
  .max(72, "Password must be under 72 characters.");
const nameSchema = z
  .string()
  .trim()
  .min(1, "Enter your full name.")
  .max(80, "Name must be under 80 characters.");

type FieldErrors = { fullName?: string; email?: string; password?: string };

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isGuest = user?.is_anonymous === true;
  // Anyone already carrying a session passed the screen when the account was
  // made, so signing in / upgrading never re-runs the age gate for them.
  const isReturningUser = Boolean(user);
  const [isSignUp, setIsSignUp] = useState(
    () => searchParams.get("mode") === "signup" || user?.is_anonymous === true,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // COPPA age screen — gates every path that can create an account.
  const [ageOk, setAgeOk] = useState(() => readAgeGate()?.eligible === true);
  const [ageBlocked, setAgeBlocked] = useState(() => isKnownChildDevice());
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  // Single source of truth for the post-auth destination (validated, loop-safe).
  const nextParam = readNext(location.search);
  const nextTarget = nextParam ?? "/";
  // Email links and OAuth always come back to /auth: the session is established
  // from the URL first, then AuthRoute forwards to `next`.
  const postAuthUrl = authCallbackUrl(nextParam);

  // Surface expired/invalid confirmation links instead of silently showing the form.
  useEffect(() => {
    const message = consumeAuthCallbackError();
    if (message) toast.error(message);
  }, []);

  // Forensics: record where the provider actually landed us, and whether the
  // state/nonce parameters survived the round trip. Runs once per mount, before
  // `consumeAuthCallbackError` strips anything from the address bar.
  useEffect(() => {
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    const has = (key: string) => url.searchParams.has(key) || hash.has(key);
    const isOAuthLanding = has("code") || has("access_token") || has("state") || has("error");
    if (!isOAuthLanding) return;

    void recordOAuthHop({
      stage: "callback",
      sourceUrl: document.referrer || undefined,
      destinationUrl: `${url.origin}${url.pathname}`,
      finalUrl: `${url.origin}${url.pathname}`,
      stateResult: has("state") ? "ok" : "missing",
      nonceResult: has("nonce") ? "ok" : "not_applicable",
      note: has("error") ? "provider returned an error parameter" : "provider callback received",
    });
  }, []);



  // Belt and braces: AuthRoute redirects once a real session exists, but if this
  // page is ever rendered with one (e.g. session restored after confirmation),
  // forward to the destination rather than stranding the user on the form.
  useEffect(() => {
    if (user && user.is_anonymous !== true) {
      const finalPath = nextTarget === "/" ? "/dashboard" : nextTarget;
      // Resolved against the *active* hostname: on app.gradr.me this stays a
      // client-side navigation, and it never hardcodes the apex origin.
      const finalUrl = urlFor("app", finalPath);
      if (finalUrl.startsWith(window.location.origin)) {
        navigate(finalPath, { replace: true });
      } else if (window.location.hostname.endsWith("gradr.me")) {
        window.location.replace(finalUrl);
      } else {
        navigate(finalPath, { replace: true });
      }
    }
  }, [user, nextTarget, navigate]);


  // Countdown for the "resend verification email" cooldown.
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  /** Validate the visible fields; returns the cleaned values or null. */
  const validateForm = () => {
    const errors: FieldErrors = {};
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) errors.email = emailResult.error.issues[0].message;
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) errors.password = passwordResult.error.issues[0].message;
    let cleanName = "";
    if (isSignUp) {
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success) errors.fullName = nameResult.error.issues[0].message;
      else cleanName = nameResult.data;
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return null;
    return { email: emailResult.data!, password: passwordResult.data!, fullName: cleanName };
  };

  /**
   * Runs `action` only once this device has passed the age screen. Account
   * creation (email, OAuth, guest) never starts before that.
   */
  const requireAge = (action: () => void) => {
    if (ageBlocked) {
      setIsSignUp(true);
      return;
    }
    if (ageOk) {
      action();
      return;
    }
    setPendingAction(() => action);
  };

  const handleResendVerification = async () => {
    if (!pendingEmail || resending || resendIn > 0) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
        options: { emailRedirectTo: postAuthUrl },
      });
      if (error) throw error;
      toast.success("Verification email sent again — check your inbox.");
      setResendIn(60);
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : "Could not resend the email.";
      reportAuthFailure("resend_confirmation", error, { message: raw });
      toast.error(friendlyAuthError(raw));
      setResendIn(30);
    } finally {
      setResending(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const valid = validateForm();
    if (!valid) return;
    // New accounts must clear the age screen first; existing sign-ins do not.
    if (isSignUp && !isReturningUser && !ageOk) {
      setPendingAction(() => () => void runEmailAuth(valid));
      return;
    }
    void runEmailAuth(valid);
  };

  const runEmailAuth = async (valid: { email: string; password: string; fullName: string }) => {
    const { email, password, fullName } = valid;
    setLoading(true);
    if (isSignUp) markSignupIntent("email");
    try {
      if (isSignUp) {
        if (isGuest) {
          // Upgrade the existing anonymous session so guest data is preserved.
          const { error } = await supabase.auth.updateUser(
            { email, password, data: { full_name: fullName } },
            { emailRedirectTo: postAuthUrl },
          );
          if (error) throw error;
          setPendingEmail(email);
          toast.success("Check your email to confirm your new account!");
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: postAuthUrl,
          },
        });
        if (error) throw error;
        if (data.session) {
          // Email confirmation is disabled — the user is signed in right now.
          navigate(nextTarget, { replace: true });
          return;
        }
        setPendingEmail(email);
        toast.success("Check your email to confirm your account!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate(nextTarget, { replace: true });
      }
    } catch (error: unknown) {
      const raw = error instanceof Error ? error.message : "Something went wrong. Please try again.";
      reportAuthFailure(isSignUp ? "sign_up" : "sign_in", error, { message: raw });
      setFormError(friendlyAuthError(raw));
    } finally {
      setLoading(false);
    }
  };




  const handleOAuth = async (provider: "google" | "apple" | "microsoft") => {
    // Existing members may sign in regardless of a device-level age marker.
    // Sign-up mode still screens before an OAuth request that could create an account.
    if (isSignUp && !ageOk && !isReturningUser) {
      requireAge(() => void handleOAuth(provider));
      return;
    }
    // Recorded before the redirect so the funnel survives the round trip.
    if (isSignUp) markSignupIntent(provider);

    // Forensics: record the outbound hop before we hand control to the provider.
    void recordOAuthHop({
      provider,
      stage: "initiate",
      sourceUrl: window.location.href,
      destinationUrl:
        window.location.hostname === "app.gradr.me"
          ? EXPECTED_CALLBACK_URL
          : `${window.location.origin}/~oauth/callback`,
      note: "managed auth callback requested",
      metadata: {
        origin: window.location.origin,
        provider_callback:
          window.location.hostname === "app.gradr.me"
            ? EXPECTED_CALLBACK_URL
            : `${window.location.origin}/~oauth/callback`,
        post_auth_return: postAuthUrl,
        final_landing: new URL(nextTarget === "/" ? "/dashboard" : nextTarget, "https://app.gradr.me").toString(),
      },
    });

    const { error } = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: postAuthUrl,
    });
    if (error) {
      void recordOAuthHop({
        provider,
        stage: "deviation",
        sourceUrl: window.location.href,
        deviationType: "provider_error",
        note: "provider sign-in request failed",
      });
      reportAuthFailure("oauth_sign_in", error, { context: { provider } });
      toast.error(`${provider} sign-in failed`);
    }
  };

  const handleGuest = async () => {
    // A returning member (or an existing guest session) has already been screened.
    if (!ageOk && !isReturningUser) {
      requireAge(() => void handleGuest());
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      toast.success("Signed in as guest");
      // Guests stay allowed on /auth (so they can upgrade later), so navigate explicitly.
      navigate(nextTarget, { replace: true });

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Guest sign-in failed";
      reportAuthFailure("guest_sign_in", error, { message });
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (ageBlocked && isSignUp) {
    return (
      <AuthLayout>
        <AgeBlockedNotice
          onSignIn={() => {
            // Safe reset: drop the local block and land on the sign-in form.
            clearAgeGate();
            setPendingAction(null);
            setAgeBlocked(false);
            setIsSignUp(false);
          }}
          onRecheck={() => {
            // `clearAgeGate()` already ran in the notice; re-open the screen.
            setAgeBlocked(false);
            setAgeOk(false);
            setPendingAction(() => () => setIsSignUp(true));
          }}
        />
      </AuthLayout>
    );
  }

  if (pendingAction && !ageOk) {
    return (
      <AuthLayout>
        <AgeGate
          onVerified={() => {
            setAgeOk(true);
            const action = pendingAction;
            setPendingAction(null);
            action();
          }}
          onBlocked={() => {
            setPendingAction(null);
            setAgeBlocked(true);
          }}
          onCancel={() => setPendingAction(null)}
        />
      </AuthLayout>
    );
  }

  if (pendingEmail) {
    return (
      <AuthLayout>
        <div className="space-y-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
            <CheckCircle className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-foreground">Confirm your email</h1>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to{" "}
              <span className="font-medium text-foreground">{pendingEmail}</span>. Open it and
              you'll land straight on{" "}
              <span className="font-medium text-foreground">{nextTarget}</span>.
            </p>
          </div>
          {isGuest && (
            <p className="text-caption text-muted-foreground">
              Your guest work is saved — keep using the app while you confirm.
            </p>
          )}
          <div className="space-y-2">
            {isGuest && (
              <Button size="lg" className="w-full" onClick={() => navigate(nextTarget, { replace: true })}>
                Continue for now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              onClick={handleResendVerification}
              disabled={resending || resendIn > 0}
            >
              <RefreshCw className={resending ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
              {resendIn > 0
                ? `Resend verification email in ${resendIn}s`
                : resending
                  ? "Sending…"
                  : "Resend verification email"}
            </Button>
            <p className="text-caption text-muted-foreground">
              No email after a minute? Check your spam folder before resending.
            </p>
            <Button
              variant="ghost"
              size="lg"
              className="w-full"
              onClick={() => setPendingEmail(null)}
            >
              Use a different email
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <OAuthHostMismatchNotice />


      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-foreground">
          {isSignUp ? "Create your account" : "Sign in to Gradr"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSignUp
            ? "Start dominating your job search."
            : "Sign in to continue your career strategy."}
        </p>
      </div>

      {/* OAuth buttons */}
      <div className="space-y-2.5">
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => handleOAuth("google")}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/> {/* theme-token-ok */}
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/> {/* theme-token-ok */}
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/> {/* theme-token-ok */}
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/> {/* theme-token-ok */}
          </svg>
          Continue with Google
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => handleOAuth("apple")}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          Continue with Apple
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => handleOAuth("microsoft")}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
          </svg>
          Continue with Microsoft
        </Button>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-caption uppercase tracking-wider">
          <span className="bg-background px-3 text-muted-foreground">or</span>
        </div>
      </div>

      {/* Email form */}
      <form onSubmit={handleEmailAuth} noValidate className="space-y-3.5">
        {isSignUp && (
          <FormField label="Full name" error={fieldErrors.fullName}>
            {(control) => (
              <Input
                {...control}
                name="name"
                autoComplete="name"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setFieldErrors((p) => ({ ...p, fullName: undefined })); }}
              />
            )}
          </FormField>
        )}
        <FormField label="Email address" error={fieldErrors.email}>
          {(control) => (
            <Input
              {...control}
              invalid={control.invalid || !!formError}
              name="email"
              autoComplete="email"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setFormError(null); setFieldErrors((p) => ({ ...p, email: undefined })); }}
            />
          )}
        </FormField>
        <FormField label="Password" error={fieldErrors.password}>
          {(control) => (
            <Input
              {...control}
              name="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setFormError(null); setFieldErrors((p) => ({ ...p, password: undefined })); }}
            />
          )}
        </FormField>




        {!isSignUp && (
          <div className="flex justify-end">
            <Link
              to={nextParam ? `/forgot-password?next=${encodeURIComponent(nextParam)}` : "/forgot-password"}
              className="text-caption text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot password?
            </Link>

          </div>
        )}

        {formError && (
          <p
            role="alert"
            aria-live="polite"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={loading}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            <>
              {isSignUp ? "Create account" : "Sign in"}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        {isSignUp && (
          <p className="text-center text-caption leading-relaxed text-muted-foreground">
            By creating an account you agree to our{" "}
            <Link to="/terms" className="text-primary underline underline-offset-2">
              Terms &amp; Conditions
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-primary underline underline-offset-2">
              Privacy Notice
            </Link>
            .
          </p>
        )}
      </form>

      <Button
        type="button"
        variant="ghost"
        size="lg"
        className="w-full"
        onClick={handleGuest}
        disabled={loading}
      >
        Continue as guest
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "No account yet?"}{" "}
        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setFormError(null); setFieldErrors({}); }}
          className="text-primary hover:underline font-medium"

        >
          {isSignUp ? "Sign in" : "Create one"}
        </button>
      </p>
    </AuthLayout>
  );
}
